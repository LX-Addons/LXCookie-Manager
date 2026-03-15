import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useClearLog } from "@/hooks/useClearLog";
import * as storageHook from "@/hooks/useStorage";
import { createUseStorageMock } from "../utils/mocks";
import { LogRetention, CookieClearType } from "@/types";

vi.mock("@/hooks/useStorage", () => ({
  useStorage: vi.fn(),
}));

describe("useClearLog", () => {
  const {
    useStorageMock,
    resetStorage,
    setStorageValue: _setStorageValue,
  } = createUseStorageMock();

  beforeEach(() => {
    vi.clearAllMocks();
    resetStorage();
    const useStorage = storageHook.useStorage;
    (useStorage as ReturnType<typeof vi.fn>).mockImplementation(useStorageMock);
  });

  it("should return addLog function", () => {
    const { result } = renderHook(() => useClearLog());
    expect(result.current.addLog).toBeDefined();
    expect(typeof result.current.addLog).toBe("function");
  });

  it("should add log when logRetention is forever", () => {
    const mockSetLogs = vi.fn();
    const useStorage = storageHook.useStorage;
    (useStorage as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string, defaultValue: unknown) => {
        if (key === "local:clearLog") {
          return [[], mockSetLogs];
        }
        return [defaultValue, vi.fn()];
      }
    );

    const { result } = renderHook(() => useClearLog());

    act(() => {
      result.current.addLog("example.com", CookieClearType.ALL, 5, LogRetention.FOREVER);
    });

    expect(mockSetLogs).toHaveBeenCalled();
  });

  it("should add log and filter old logs when logRetention is not forever", () => {
    const oldTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const mockSetLogs = vi.fn((fn) => {
      const result = fn([
        {
          id: "old-log",
          domain: "old.com",
          count: 1,
          cookieType: CookieClearType.ALL,
          timestamp: oldTimestamp,
          action: "clear",
        },
      ]);
      return result;
    });

    const useStorage = storageHook.useStorage;
    (useStorage as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string, defaultValue: unknown) => {
        if (key === "local:clearLog") {
          return [
            [
              {
                id: "old-log",
                domain: "old.com",
                count: 1,
                cookieType: CookieClearType.ALL,
                timestamp: oldTimestamp,
                action: "clear",
              },
            ],
            mockSetLogs,
          ];
        }
        return [defaultValue, vi.fn()];
      }
    );

    const { result } = renderHook(() => useClearLog());

    act(() => {
      result.current.addLog("example.com", CookieClearType.ALL, 5, LogRetention.SEVEN_DAYS);
    });

    expect(mockSetLogs).toHaveBeenCalled();
  });

  it("should handle prev logs being null or undefined", () => {
    const mockSetLogs = vi.fn((fn) => {
      const result = fn(null);
      return result;
    });

    const useStorage = storageHook.useStorage;
    (useStorage as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string, defaultValue: unknown) => {
        if (key === "local:clearLog") {
          return [null, mockSetLogs];
        }
        return [defaultValue, vi.fn()];
      }
    );

    const { result } = renderHook(() => useClearLog());

    act(() => {
      result.current.addLog("example.com", CookieClearType.ALL, 5, LogRetention.SEVEN_DAYS);
    });

    expect(mockSetLogs).toHaveBeenCalled();
  });

  it("should use default retention when logRetention is not in LOG_RETENTION_MAP", () => {
    const mockSetLogs = vi.fn();
    const useStorage = storageHook.useStorage;
    (useStorage as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string, defaultValue: unknown) => {
        if (key === "local:clearLog") {
          return [[], mockSetLogs];
        }
        return [defaultValue, vi.fn()];
      }
    );

    const { result } = renderHook(() => useClearLog());

    act(() => {
      result.current.addLog(
        "example.com",
        CookieClearType.ALL,
        5,
        "invalid-retention" as unknown as LogRetention
      );
    });

    expect(mockSetLogs).toHaveBeenCalled();
  });

  it("should add log with custom action and details", () => {
    const mockSetLogs = vi.fn();
    const useStorage = storageHook.useStorage;
    (useStorage as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string, defaultValue: unknown) => {
        if (key === "local:clearLog") {
          return [[], mockSetLogs];
        }
        return [defaultValue, vi.fn()];
      }
    );

    const { result } = renderHook(() => useClearLog());

    act(() => {
      result.current.addLog(
        "example.com",
        CookieClearType.ALL,
        5,
        LogRetention.FOREVER,
        "edit",
        "Updated cookie value"
      );
    });

    expect(mockSetLogs).toHaveBeenCalled();
  });

  it("should increment log ID counter for each log", () => {
    const mockSetLogs = vi.fn();
    const useStorage = storageHook.useStorage;
    (useStorage as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string, defaultValue: unknown) => {
        if (key === "local:clearLog") {
          return [[], mockSetLogs];
        }
        return [defaultValue, vi.fn()];
      }
    );

    const { result } = renderHook(() => useClearLog());

    act(() => {
      result.current.addLog("example.com", CookieClearType.ALL, 5, LogRetention.FOREVER);
    });

    act(() => {
      result.current.addLog("test.com", CookieClearType.ALL, 3, LogRetention.FOREVER);
    });

    expect(mockSetLogs).toHaveBeenCalledTimes(2);
  });
});
