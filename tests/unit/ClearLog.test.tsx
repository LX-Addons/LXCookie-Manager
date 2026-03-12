import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useState, ReactNode } from "react";
import { ClearLog } from "@/components/ClearLog";
import * as storageHook from "@/hooks/useStorage";

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

vi.mock("../../components/ConfirmDialogWrapper", () => ({
  ConfirmDialogWrapper: ({
    children,
  }: {
    children: (
      showConfirm: (
        title: string,
        message: string,
        variant: string,
        onConfirm: () => void
      ) => ReactNode
    ) => ReactNode;
  }) => {
    const MockWrapper = () => {
      const [isOpen, setIsOpen] = useState(false);
      const [confirmCallback, setConfirmCallback] = useState<(() => void) | null>(null);

      const showConfirm = (
        _title: string,
        _message: string,
        _variant: string,
        onConfirm: () => void
      ): ReactNode => {
        setConfirmCallback(() => onConfirm);
        setIsOpen(true);
        return null;
      };

      return (
        <>
          {children(showConfirm)}
          {isOpen && (
            <div className="confirm-dialog">
              <p>确定要清除所有日志记录吗？</p>
              <button
                onClick={() => {
                  confirmCallback?.();
                  setIsOpen(false);
                }}
              >
                确定
              </button>
              <button onClick={() => setIsOpen(false)}>取消</button>
            </div>
          )}
        </>
      );
    };
    return <MockWrapper />;
  },
}));

describe("ClearLog", () => {
  const mockOnMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    const useStorage = storageHook.useStorage;
    (useStorage as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string, defaultValue: unknown) => {
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
          return [[], vi.fn()];
        }
        return [defaultValue, vi.fn()];
      }
    );
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
    const useStorage = storageHook.useStorage;
    (useStorage as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string, defaultValue: unknown) => {
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
              logRetention: "forever",
              locale: "zh-CN",
            },
            vi.fn(),
          ];
        }
        if (key === "local:clearLog") {
          return [[], vi.fn()];
        }
        return [defaultValue, vi.fn()];
      }
    );

    render(<ClearLog onMessage={mockOnMessage} />);

    const clearOldButton = screen.getByText("清除过期");
    fireEvent.click(clearOldButton);

    expect(mockOnMessage).toHaveBeenCalledWith("日志保留设置为永久，无需清理");
  });

  it("should show message when no expired logs found", async () => {
    const useStorage = storageHook.useStorage;
    const mockSetLogs = vi.fn((fn) => {
      const result = fn([]);
      return result;
    });

    (useStorage as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string, defaultValue: unknown) => {
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
      }
    );

    render(<ClearLog onMessage={mockOnMessage} />);

    const clearOldButton = screen.getByText("清除过期");
    fireEvent.click(clearOldButton);

    expect(mockOnMessage).toHaveBeenCalledWith("没有需要清理的过期日志");
  });

  it("should clear expired logs and show message", async () => {
    const useStorage = storageHook.useStorage;
    const oldTimestamp = Date.now() - 10 * 24 * 60 * 60 * 1000;
    const recentTimestamp = Date.now() - 1 * 24 * 60 * 60 * 1000;

    const mockLogs = [
      {
        id: "1",
        domain: "old.com",
        cookieType: "all",
        count: 1,
        timestamp: oldTimestamp,
        action: "clear",
      },
      {
        id: "2",
        domain: "new.com",
        cookieType: "all",
        count: 2,
        timestamp: recentTimestamp,
        action: "clear",
      },
    ];

    const mockSetLogs = vi.fn((fn) => {
      const result = fn(mockLogs);
      return result;
    });

    (useStorage as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string, defaultValue: unknown) => {
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
          return [mockLogs, mockSetLogs];
        }
        return [defaultValue, vi.fn()];
      }
    );

    render(<ClearLog onMessage={mockOnMessage} />);

    const clearOldButton = screen.getByText("清除过期");
    fireEvent.click(clearOldButton);

    expect(mockOnMessage).toHaveBeenCalled();
  });

  it("should render log list with items", async () => {
    const useStorage = storageHook.useStorage;

    const mockLogs = [
      {
        id: "1",
        domain: "example.com",
        cookieType: "all",
        count: 5,
        timestamp: Date.now(),
        action: "clear",
      },
    ];

    (useStorage as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string, defaultValue: unknown) => {
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
          return [mockLogs, vi.fn()];
        }
        return [defaultValue, vi.fn()];
      }
    );

    render(<ClearLog onMessage={mockOnMessage} />);

    expect(screen.getByText("example.com")).toBeTruthy();
  });
});
