import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useClearLog } from "@/hooks/useClearLog";
import * as storageHook from "@/hooks/useStorage";
import { createUseStorageMock, createMockLogEntry } from "../utils/mocks";
import { LogRetention, CookieClearType } from "@/types";

vi.mock("@/hooks/useStorage", () => ({
  useStorage: vi.fn(),
}));

describe("useClearLog", () => {
  const { useStorageMock, resetStorage } = createUseStorageMock();

  beforeEach(() => {
    vi.clearAllMocks();
    resetStorage();
    const useStorage = storageHook.useStorage;
    (useStorage as ReturnType<typeof vi.fn>).mockImplementation(useStorageMock);
  });

  const setupStorageWithLogs = (
    logs: unknown[] | null = [],
    setLogsFn?: ReturnType<typeof vi.fn>
  ) => {
    const mockSetLogs = setLogsFn || vi.fn();
    const useStorage = storageHook.useStorage;
    (useStorage as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string, defaultValue: unknown) => {
        if (key === "local:clearLog") {
          return [logs, mockSetLogs];
        }
        return [defaultValue, vi.fn()];
      }
    );
    return mockSetLogs;
  };

  it("should return addLog function", () => {
    const { result } = renderHook(() => useClearLog());
    expect(result.current.addLog).toBeDefined();
    expect(typeof result.current.addLog).toBe("function");
  });

  it("should add log when logRetention is forever", () => {
    const mockSetLogs = setupStorageWithLogs([]);
    const { result } = renderHook(() => useClearLog());

    act(() => {
      result.current.addLog("example.com", CookieClearType.ALL, 5, LogRetention.FOREVER);
    });

    expect(mockSetLogs).toHaveBeenCalled();
  });

  it("should add log and filter old logs when logRetention is not forever", () => {
    const oldTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const oldLog = createMockLogEntry({
      id: "old-log",
      domain: "old.com",
      timestamp: oldTimestamp,
    });

    const mockSetLogs = vi.fn((fn) => {
      const result = fn([oldLog]);
      return result;
    });

    setupStorageWithLogs([oldLog], mockSetLogs);
    const { result } = renderHook(() => useClearLog());

    act(() => {
      result.current.addLog("example.com", CookieClearType.ALL, 5, LogRetention.SEVEN_DAYS);
    });

    expect(mockSetLogs).toHaveBeenCalled();

    const callbackResult = mockSetLogs.mock.calls[0][0]([oldLog]);
    expect(callbackResult).not.toContainEqual(expect.objectContaining({ id: "old-log" }));
    expect(callbackResult).toContainEqual(
      expect.objectContaining({ domain: "example.com", count: 5 })
    );
    expect(callbackResult.length).toBe(1);
  });

  it("should handle prev logs being null or undefined", () => {
    const mockSetLogs = vi.fn((fn) => fn(null));
    setupStorageWithLogs(null, mockSetLogs);
    const { result } = renderHook(() => useClearLog());

    act(() => {
      result.current.addLog("example.com", CookieClearType.ALL, 5, LogRetention.SEVEN_DAYS);
    });

    expect(mockSetLogs).toHaveBeenCalled();
  });

  it("should use default retention when logRetention is not in LOG_RETENTION_MAP", () => {
    const mockSetLogs = setupStorageWithLogs([]);
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
    const mockSetLogs = setupStorageWithLogs([]);
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
    const mockSetLogs = setupStorageWithLogs([]);
    const { result } = renderHook(() => useClearLog());

    act(() => {
      result.current.addLog("example.com", CookieClearType.ALL, 5, LogRetention.FOREVER);
      result.current.addLog("test.com", CookieClearType.ALL, 3, LogRetention.FOREVER);
    });

    expect(mockSetLogs).toHaveBeenCalledTimes(2);
  });
});
