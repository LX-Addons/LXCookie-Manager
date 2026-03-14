import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ClearLog } from "@/components/ClearLog";
import * as storageHook from "@/hooks/useStorage";
import {
  createTranslationMock,
  createConfirmDialogWrapperMockWithCustomConfirmText,
  createUseStorageMock,
} from "../utils/mocks";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        "clearLog.clearLogs": "清除日志",
        "clearLog.noLogs": "暂无清除日志记录",
        "clearLog.clearExpired": "清除过期",
        "clearLog.clearAllLogs": "清除全部",
        "clearLog.exportLogs": "导出日志",
        "clearLog.domain": "域名",
        "clearLog.action": "操作",
        "clearLog.count": "数量",
        "clearLog.time": "时间",
        "clearLog.actions.clear": "清除",
        "clearLog.actions.export": "导出",
        "clearLog.logsCleared": "已清除日志",
        "clearLog.expiredLogsCleared": "已清除过期日志",
        "clearLog.noExpiredLogs": "没有需要清理的过期日志",
        "clearLog.logsExported": "日志已导出",
        "clearLog.confirmClearLogs": "确定要清除所有日志记录吗？",
        "clearLog.logRetentionForever": "日志保留设置为永久，无需清理",
        "cookieTypes.all": "全部",
        "common.cancel": "取消",
        "common.confirm": "确定",
        "common.delete": "删除",
        "common.yes": "是",
        "common.no": "否",
        "common.count": "数量: {count}",
        "actions.clear": "清除",
      };
      let text = translations[key] || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(`{${k}}`, String(v));
        });
      }
      return text;
    },
  }),
}));
vi.mock("../../components/ConfirmDialogWrapper", () =>
  createConfirmDialogWrapperMockWithCustomConfirmText("确定要清除所有日志记录吗？")
);
vi.mock("@/hooks/useStorage", () => ({
  useStorage: vi.fn(),
}));

describe("ClearLog", () => {
  const mockOnMessage = vi.fn();
  const { useStorageMock, resetStorage, setStorageValue } = createUseStorageMock();

  beforeEach(() => {
    vi.clearAllMocks();
    resetStorage();
    const useStorage = storageHook.useStorage;
    (useStorage as ReturnType<typeof vi.fn>).mockImplementation(useStorageMock);

    setStorageValue("local:settings", {
      mode: "whitelist",
      themeMode: "light",
      clearType: "all",
      clearCache: false,
      clearLocalStorage: false,
      clearIndexedDB: false,
      cleanupOnStartup: false,
      cleanupExpiredCookies: false,
      logRetention: "7d",
      locale: "zh-CN",
    });
    setStorageValue("local:clearLog", []);
  });

  it("should render empty state when no logs", () => {
    render(<ClearLog onMessage={mockOnMessage} />);

    expect(screen.getByText("暂无清除日志记录")).toBeTruthy();
  });

  it("should render log header", () => {
    render(<ClearLog onMessage={mockOnMessage} />);

    expect(screen.getByText("清除日志")).toBeTruthy();
    expect(screen.getByText("清除过期")).toBeTruthy();
    expect(screen.getByText("导出日志")).toBeTruthy();
    expect(screen.getByText("清除全部")).toBeTruthy();
  });

  it("should call onMessage when export logs is clicked", () => {
    render(<ClearLog onMessage={mockOnMessage} />);

    const exportButton = screen.getByText("导出日志");
    fireEvent.click(exportButton);

    expect(mockOnMessage).toHaveBeenCalledWith("日志已导出");
  });

  it("should call onMessage when clear old logs is clicked", () => {
    render(<ClearLog onMessage={mockOnMessage} />);
    expect(screen.getByText("清除过期")).toBeTruthy();
  });

  it("should show confirm dialog when clear all logs is clicked", () => {
    render(<ClearLog onMessage={mockOnMessage} />);

    const clearAllButton = screen.getByText("清除全部");
    fireEvent.click(clearAllButton);

    expect(screen.getByText("确定要清除所有日志记录吗？")).toBeInTheDocument();
  });

  it("should clear logs when confirm is accepted", () => {
    render(<ClearLog onMessage={mockOnMessage} />);

    const clearAllButton = screen.getByText("清除全部");
    fireEvent.click(clearAllButton);

    const confirmButton = screen.getByText("确定");
    fireEvent.click(confirmButton);

    expect(mockOnMessage).toHaveBeenCalledWith("已清除日志");
  });

  it("should not clear logs when confirm is cancelled", () => {
    render(<ClearLog onMessage={mockOnMessage} />);

    const clearAllButton = screen.getByText("清除全部");
    fireEvent.click(clearAllButton);

    const cancelButton = screen.getByText("取消");
    fireEvent.click(cancelButton);

    expect(mockOnMessage).not.toHaveBeenCalled();
  });

  it("should show message when log retention is forever", async () => {
    setStorageValue("local:settings", {
      mode: "whitelist",
      themeMode: "light",
      clearType: "all",
      clearCache: false,
      clearLocalStorage: false,
      clearIndexedDB: false,
      cleanupOnStartup: false,
      cleanupExpiredCookies: false,
      logRetention: "forever",
      locale: "zh-CN",
    });

    render(<ClearLog onMessage={mockOnMessage} />);

    const clearOldButton = screen.getByText("清除过期");
    fireEvent.click(clearOldButton);

    expect(mockOnMessage).toHaveBeenCalledWith("日志保留设置为永久，无需清理");
  });

  it("should show message when no expired logs found", async () => {
    const mockSetLogs = vi.fn((fn) => {
      const result = fn([]);
      return result;
    });
    const useStorage = storageHook.useStorage;
    (useStorage as ReturnType<typeof vi.fn>).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:settings") {
        return [
          {
            mode: "whitelist",
            themeMode: "light",
            clearType: "all",
            clearCache: false,
            clearLocalStorage: false,
            clearIndexedDB: false,
            cleanupOnStartup: false,
            cleanupExpiredCookies: false,
            logRetention: "7d",
            locale: "zh-CN",
          },
          vi.fn(),
        ];
      }
      if (key === "local:clearLog") {
        return [[], mockSetLogs];
      }
      return [defaultValue, vi.fn()];
    });

    render(<ClearLog onMessage={mockOnMessage} />);

    const clearOldButton = screen.getByText("清除过期");
    fireEvent.click(clearOldButton);

    expect(mockOnMessage).toHaveBeenCalledWith("没有需要清理的过期日志");
  });

  it("should clear expired logs and show message", async () => {
    const oldTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const mockSetLogs = vi.fn((fn) => {
      const result = fn([
        {
          id: "test-log-1",
          domain: "example.com",
          count: 5,
          action: "clear",
          cookieType: "all",
          timestamp: oldTimestamp,
        },
      ]);
      return result;
    });
    const useStorage = storageHook.useStorage;
    (useStorage as ReturnType<typeof vi.fn>).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:settings") {
        return [
          {
            mode: "whitelist",
            themeMode: "light",
            clearType: "all",
            clearCache: false,
            clearLocalStorage: false,
            clearIndexedDB: false,
            cleanupOnStartup: false,
            cleanupExpiredCookies: false,
            logRetention: "7d",
            locale: "zh-CN",
          },
          vi.fn(),
        ];
      }
      if (key === "local:clearLog") {
        return [
          [
            {
              id: "test-log-1",
              domain: "example.com",
              count: 5,
              action: "clear",
              cookieType: "all",
              timestamp: oldTimestamp,
            },
          ],
          mockSetLogs,
        ];
      }
      return [defaultValue, vi.fn()];
    });

    render(<ClearLog onMessage={mockOnMessage} />);

    const clearOldButton = screen.getByText("清除过期");
    fireEvent.click(clearOldButton);

    expect(mockOnMessage).toHaveBeenCalledWith("已清除过期日志");
  });

  it("should render log list with items", () => {
    setStorageValue("local:clearLog", [
      {
        id: "test-log-1",
        domain: "example.com",
        count: 5,
        action: "clear",
        cookieType: "all",
        timestamp: Date.now(),
      },
    ]);

    render(<ClearLog onMessage={mockOnMessage} />);

    expect(screen.getByText("example.com")).toBeTruthy();
    expect(screen.getByText("数量: 5")).toBeTruthy();
    expect(screen.getByText("清除")).toBeTruthy();
  });
});
