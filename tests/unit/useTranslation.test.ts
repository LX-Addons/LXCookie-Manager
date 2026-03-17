import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.unmock("@/hooks/useTranslation");
vi.unmock("wxt/utils/storage");
vi.unmock("@/i18n");

const mockStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  watch: vi.fn(),
};

const mockI18n = {
  setLocale: vi.fn(),
  detectBrowserLocale: vi.fn(),
  t: vi.fn((key: string) => key),
};

vi.doMock("wxt/utils/storage", () => ({
  storage: mockStorage,
}));

vi.doMock("@/i18n", () => mockI18n);

describe("useTranslation", () => {
  let useTranslation: () => {
    t: (path: string, params?: Record<string, string | number>) => string;
    locale: "zh-CN" | "en-US";
    setLocale: (newLocale: "zh-CN" | "en-US") => void;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockStorage.getItem.mockResolvedValue(null);
    mockStorage.watch.mockReturnValue(() => {});
    mockStorage.setItem.mockResolvedValue(undefined);
    mockI18n.detectBrowserLocale.mockReturnValue("zh-CN");
    vi.resetModules();
    const module = await import("@/hooks/useTranslation");
    useTranslation = module.useTranslation;
  });

  describe("basic functionality", () => {
    it("should provide translation function", () => {
      const { result } = renderHook(() => useTranslation());
      expect(typeof result.current.t).toBe("function");
      result.current.t("test.key");
      expect(mockI18n.t).toHaveBeenCalledWith("test.key", undefined);
    });

    it("should pass parameters to translation function", () => {
      const { result } = renderHook(() => useTranslation());
      result.current.t("test.key", { param: "value" });
      expect(mockI18n.t).toHaveBeenCalledWith("test.key", { param: "value" });
    });
  });

  describe("setLocale", () => {
    it("should update locale immediately", () => {
      const { result } = renderHook(() => useTranslation());
      act(() => {
        result.current.setLocale("en-US");
      });
      expect(result.current.locale).toBe("en-US");
      expect(mockI18n.setLocale).toHaveBeenCalledWith("en-US");
    });
  });

  describe("storage watcher", () => {
    it("should set up storage watcher on mount", () => {
      renderHook(() => useTranslation());
      expect(mockStorage.watch).toHaveBeenCalledWith("local:settings", expect.any(Function));
    });

    it("should clean up watcher on unmount", () => {
      const unwatch = vi.fn();
      mockStorage.watch.mockReturnValue(unwatch);
      const { unmount } = renderHook(() => useTranslation());
      unmount();
      expect(unwatch).toHaveBeenCalled();
    });
  });
});
