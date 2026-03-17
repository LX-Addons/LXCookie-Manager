import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.unmock("@/hooks/useStorage");
vi.unmock("wxt/utils/storage");

const mockStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  watch: vi.fn(),
};

vi.doMock("wxt/utils/storage", () => ({
  storage: mockStorage,
}));

describe("useStorage", () => {
  let useStorage: <T>(
    key: `local:${string}` | `session:${string}` | `sync:${string}` | `managed:${string}`,
    defaultValue: T
  ) => readonly [T, (newValue: T | ((prev: T) => T)) => void];

  beforeEach(async () => {
    vi.clearAllMocks();
    mockStorage.getItem.mockResolvedValue(null);
    mockStorage.watch.mockReturnValue(() => {});
    mockStorage.setItem.mockResolvedValue(undefined);
    vi.resetModules();
    const module = await import("@/hooks/useStorage");
    useStorage = module.useStorage;
  });

  describe("basic functionality", () => {
    it("should use default value when no stored value exists", () => {
      const { result } = renderHook(() => useStorage("local:test", "default"));
      expect(result.current[0]).toBe("default");
    });

    it("should update value with set function", () => {
      const { result } = renderHook(() => useStorage("local:test", "default"));
      act(() => {
        result.current[1]("new value");
      });
      expect(result.current[0]).toBe("new value");
      expect(mockStorage.setItem).toHaveBeenCalledWith("local:test", "new value");
    });

    it("should update value with function updater", () => {
      const { result } = renderHook(() => useStorage("local:test", 0));
      act(() => {
        result.current[1]((prev: number) => prev + 1);
      });
      expect(result.current[0]).toBe(1);
      expect(mockStorage.setItem).toHaveBeenCalledWith("local:test", 1);
    });
  });

  describe("storage watcher", () => {
    it("should set up storage watcher on mount", () => {
      renderHook(() => useStorage("local:test", "default"));
      expect(mockStorage.watch).toHaveBeenCalledWith("local:test", expect.any(Function));
    });

    it("should update value when watcher triggers", () => {
      let watchCallback: ((newValue: unknown) => void) | undefined;
      mockStorage.watch.mockImplementation((key: string, callback: (newValue: unknown) => void) => {
        watchCallback = callback;
        return () => {};
      });
      const { result } = renderHook(() => useStorage("local:test", "default"));
      act(() => {
        watchCallback?.("updated value");
      });
      expect(result.current[0]).toBe("updated value");
    });

    it("should clean up watcher on unmount", () => {
      const unwatch = vi.fn();
      mockStorage.watch.mockReturnValue(unwatch);
      const { unmount } = renderHook(() => useStorage("local:test", "default"));
      unmount();
      expect(unwatch).toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should support different storage areas", () => {
      renderHook(() => useStorage("session:test", "default"));
      expect(mockStorage.getItem).toHaveBeenCalledWith("session:test");
      renderHook(() => useStorage("sync:test", "default"));
      expect(mockStorage.getItem).toHaveBeenCalledWith("sync:test");
    });
  });
});
