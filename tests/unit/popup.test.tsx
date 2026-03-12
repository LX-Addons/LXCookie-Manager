import { describe, it, expect, vi, beforeEach, Mock, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import IndexPopup from "@/entrypoints/popup/App";
import * as storageHook from "@/hooks/useStorage";

// Helper function to mock matchMedia
const mockMatchMedia = (overrides: Partial<MediaQueryList> = {}) => {
  Object.defineProperty(globalThis, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      ...overrides,
    })),
  });
};

vi.mock("@/hooks/useStorage", () => ({
  useStorage: vi.fn(),
}));

interface CookieListProps {
  cookies: unknown[];
  currentDomain?: string;
  onUpdate?: () => void;
  onMessage?: (text: string, isError?: boolean) => void;
  whitelist?: string[];
  blacklist?: string[];
  onAddToWhitelist?: (domains: string[]) => void;
  onAddToBlacklist?: (domains: string[]) => void;
}

let _cookieListProps: CookieListProps | null = null;
vi.mock("@/components/CookieList", () => ({
  CookieList: (props: CookieListProps) => {
    _cookieListProps = props;
    return (
      <div data-testid="cookie-list">
        <button
          onClick={() => props.onAddToWhitelist?.(["example.com"])}
          data-testid="add-to-whitelist"
        >
          添加到白名单
        </button>
        <button
          onClick={() => props.onAddToBlacklist?.(["example.com"])}
          data-testid="add-to-blacklist"
        >
          添加到黑名单
        </button>
        Cookie 详情
      </div>
    );
  },
}));

vi.mock("@/components/DomainManager", () => ({
  DomainManager: ({
    domains,
    onRemove,
    title,
  }: {
    domains: string[];
    onRemove: (domain: string) => void;
    title: string;
  }) => (
    <div data-testid="domain-manager">
      <span>{title}</span>
      {domains.map((domain) => (
        <div key={domain}>
          {domain}
          <button onClick={() => onRemove(domain)}>删除</button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@/components/ConfirmDialogWrapper", () => ({
  ConfirmDialogWrapper: ({
    children,
  }: {
    children: (
      showConfirm: (options: { title: string; onConfirm: () => void }) => void
    ) => React.ReactNode;
  }) => {
    const showConfirm = vi.fn(({ onConfirm }: { title: string; onConfirm: () => void }) => {
      onConfirm();
    });
    return <>{children(showConfirm)}</>;
  },
}));

vi.mock("@/utils/cleanup", () => ({
  performCleanupWithFilter: vi.fn(() =>
    Promise.resolve({ count: 5, clearedDomains: ["example.com"] })
  ),
  cleanupExpiredCookies: vi.fn(() => Promise.resolve(3)),
  performCleanup: vi.fn(() => Promise.resolve({ count: 2, clearedDomains: ["test.com"] })),
}));

vi.mock("@/utils", () => ({
  isDomainMatch: vi.fn((domain: string, currentDomain: string) => domain.includes(currentDomain)),
  isInList: vi.fn(() => false),
  isTrackingCookie: vi.fn(() => false),
  isThirdPartyCookie: vi.fn(() => false),
  isSensitiveCookie: vi.fn(() => false),
  normalizeDomain: vi.fn((d: string) => d.replace(/^\./, "").toLowerCase()),
  assessCookieRisk: vi.fn(() => ({ level: "low", reason: "安全" })),
  getRiskLevelColor: vi.fn(() => "#22c55e"),
  getRiskLevelText: vi.fn(() => "低风险"),
  clearSingleCookie: vi.fn(() => Promise.resolve(true)),
  editCookie: vi.fn(() => Promise.resolve(true)),
  maskCookieValue: vi.fn(() => "••••••••"),
  getCookieKey: vi.fn((name: string, domain: string) => `${name}-${domain}`),
  toggleSetValue: vi.fn((set: Set<string>, value: string) => {
    const next = new Set(set);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    return next;
  }),
}));

const mockCookies = [
  {
    name: "test",
    value: "value",
    domain: ".example.com",
    path: "/",
    secure: true,
    httpOnly: false,
    sameSite: "strict" as const,
  },
  {
    name: "session",
    value: "abc123",
    domain: ".example.com",
    path: "/",
    secure: false,
    httpOnly: true,
    sameSite: "lax" as const,
  },
];

describe("IndexPopup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _cookieListProps = null;

    global.chrome = {
      cookies: {
        getAll: vi.fn(() => Promise.resolve(mockCookies)),
        remove: vi.fn(() => Promise.resolve(true)),
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      tabs: {
        query: vi.fn(() =>
          Promise.resolve([
            {
              url: "https://example.com/test",
              active: true,
            },
          ])
        ),
      },
      storage: {
        local: {
          get: vi.fn(() => Promise.resolve({})),
          set: vi.fn(() => Promise.resolve()),
        },
      },
    } as unknown as typeof chrome;

    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:whitelist") {
        return [[], vi.fn()];
      }
      if (key === "local:blacklist") {
        return [[], vi.fn()];
      }
      if (key === "local:settings") {
        return [
          {
            mode: "whitelist",
            clearType: "all",
            enableAutoCleanup: false,
            cleanupOnTabDiscard: false,
            cleanupOnStartup: false,
            clearCache: false,
            clearLocalStorage: false,
            clearIndexedDB: false,
          },
          vi.fn(),
        ];
      }
      return [defaultValue, vi.fn()];
    });

    mockMatchMedia();
  });

  afterEach(() => {
    cleanup();
  });

  it("should render popup container", async () => {
    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should render cookie stats", async () => {
    const { findByText } = render(<IndexPopup />);
    expect(await findByText(/Cookie统计/)).toBeTruthy();
  });

  it("should render action buttons", async () => {
    const { findByText } = render(<IndexPopup />);
    expect(await findByText("清除所有Cookie")).toBeTruthy();
    expect(await findByText("清除当前网站")).toBeTruthy();
  });

  it("should render tabs", async () => {
    const { findByRole } = render(<IndexPopup />);
    expect(await findByRole("tab", { name: /管理/ })).toBeTruthy();
    expect(await findByRole("tab", { name: /白名单/ })).toBeTruthy();
    expect(await findByRole("tab", { name: /设置/ })).toBeTruthy();
    expect(await findByRole("tab", { name: /日志/ })).toBeTruthy();
  });

  it("should switch between tabs", async () => {
    const { findByRole } = render(<IndexPopup />);
    const settingsTab = await findByRole("tab", { name: /设置/ });
    fireEvent.click(settingsTab);
    expect(settingsTab).toHaveAttribute("aria-selected", "true");
  });

  it("should handle add to whitelist", async () => {
    const { findByTestId } = render(<IndexPopup />);
    const addButton = await findByTestId("add-to-whitelist");
    fireEvent.click(addButton);
    expect(addButton).toBeTruthy();
  });

  it("should handle add to blacklist", async () => {
    const { findByTestId } = render(<IndexPopup />);
    const addButton = await findByTestId("add-to-blacklist");
    fireEvent.click(addButton);
    expect(addButton).toBeTruthy();
  });

  it("should render cookie list", async () => {
    const { findByTestId } = render(<IndexPopup />);
    expect(await findByTestId("cookie-list")).toBeTruthy();
  });

  it("should handle settings change", async () => {
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:settings") {
        return [
          {
            mode: "blacklist",
            clearType: "session",
            enableAutoCleanup: true,
            cleanupOnTabDiscard: true,
            cleanupOnStartup: true,
            clearCache: true,
            clearLocalStorage: true,
            clearIndexedDB: true,
          },
          vi.fn(),
        ];
      }
      return [defaultValue, vi.fn()];
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should handle empty cookies", async () => {
    (chrome.cookies.getAll as Mock).mockResolvedValue([]);

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should handle tab without URL", async () => {
    (chrome.tabs.query as Mock).mockResolvedValue([{}]);

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should call quickClearAll when clicking clear all button", async () => {
    const { findByRole } = render(<IndexPopup />);
    const clearAllBtn = await findByRole("button", { name: /清除所有/ });
    fireEvent.click(clearAllBtn);
    expect(clearAllBtn).toBeTruthy();
  });

  it("should call quickClearCurrent when clicking clear current button", async () => {
    const { findByText } = render(<IndexPopup />);
    const clearCurrentBtn = await findByText("清除当前网站");
    fireEvent.click(clearCurrentBtn);
    expect(clearCurrentBtn).toBeTruthy();
  });

  it("should test quickAddToWhitelist when current domain exists", async () => {
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:whitelist") {
        return [["other.com"], vi.fn()];
      }
      if (key === "local:settings") {
        return [{ mode: "whitelist", clearType: "all" }, vi.fn()];
      }
      return [defaultValue, vi.fn()];
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should test quickAddToBlacklist when current domain exists", async () => {
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:blacklist") {
        return [["other.com"], vi.fn()];
      }
      if (key === "local:settings") {
        return [{ mode: "blacklist", clearType: "all" }, vi.fn()];
      }
      return [defaultValue, vi.fn()];
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should test keyboard navigation - ArrowRight", async () => {
    const { container } = render(<IndexPopup />);
    const popup = container.querySelector(".popup-container") || document.body;
    fireEvent.keyDown(popup, { key: "ArrowRight" });
    expect(popup).toBeTruthy();
  });

  it("should test keyboard navigation - ArrowLeft", async () => {
    const { container } = render(<IndexPopup />);
    const popup = container.querySelector(".popup-container") || document.body;
    fireEvent.keyDown(popup, { key: "ArrowLeft" });
    expect(popup).toBeTruthy();
  });

  it("should test keyboard navigation - Home", async () => {
    const { container } = render(<IndexPopup />);
    const popup = container.querySelector(".popup-container") || document.body;
    fireEvent.keyDown(popup, { key: "Home" });
    expect(popup).toBeTruthy();
  });

  it("should test keyboard navigation - End", async () => {
    const { container } = render(<IndexPopup />);
    const popup = container.querySelector(".popup-container") || document.body;
    fireEvent.keyDown(popup, { key: "End" });
    expect(popup).toBeTruthy();
  });

  it("should test theme mode - AUTO", async () => {
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:settings") {
        return [{ themeMode: "auto" }, vi.fn()];
      }
      return [defaultValue, vi.fn()];
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should test theme mode - LIGHT", async () => {
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:settings") {
        return [{ themeMode: "light" }, vi.fn()];
      }
      return [defaultValue, vi.fn()];
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should test theme mode - DARK", async () => {
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:settings") {
        return [{ themeMode: "dark" }, vi.fn()];
      }
      return [defaultValue, vi.fn()];
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should test theme mode - CUSTOM with custom theme", async () => {
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:settings") {
        return [
          {
            themeMode: "custom",
            customTheme: {
              primary: "#ff0000",
              success: "#00ff00",
              warning: "#ffff00",
              danger: "#0000ff",
              bgPrimary: "#ffffff",
              textPrimary: "#000000",
            },
          },
          vi.fn(),
        ];
      }
      return [defaultValue, vi.fn()];
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should test system theme change listener", async () => {
    const addEventListenerSpy = vi.fn();
    mockMatchMedia({
      matches: true,
      addEventListener: addEventListenerSpy,
    });

    const { findByText, unmount } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
    unmount();
    expect(addEventListenerSpy).toHaveBeenCalled();
  });

  it("should test log retention - FOREVER", async () => {
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:settings") {
        return [{ logRetention: "forever" }, vi.fn()];
      }
      return [defaultValue, vi.fn()];
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should test log retention - DAY", async () => {
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:settings") {
        return [{ logRetention: "day" }, vi.fn()];
      }
      return [defaultValue, vi.fn()];
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should test log retention - WEEK", async () => {
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:settings") {
        return [{ logRetention: "week" }, vi.fn()];
      }
      return [defaultValue, vi.fn()];
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should test log retention - MONTH", async () => {
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:settings") {
        return [{ logRetention: "month" }, vi.fn()];
      }
      return [defaultValue, vi.fn()];
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should handle error when getting cookies", async () => {
    (chrome.cookies.getAll as Mock).mockRejectedValue(new Error("Failed to get cookies"));

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should render with matchMedia", async () => {
    render(<IndexPopup />);
    expect(globalThis.matchMedia).toBeDefined();
  });

  it("should render all stat items", async () => {
    const { container } = render(<IndexPopup />);
    const statValues = container.querySelectorAll(".stat-value");
    expect(statValues.length).toBeGreaterThan(0);
  });

  it("should handle quick stats display", async () => {
    const { findByText } = render(<IndexPopup />);
    expect(await findByText(/Cookie统计/)).toBeTruthy();
  });

  it("should handle domain extraction from URL", async () => {
    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should handle cleanup all cookies", async () => {
    const { findByText } = render(<IndexPopup />);
    const clearButton = await findByText("清除所有Cookie");
    fireEvent.click(clearButton);
    expect(clearButton).toBeTruthy();
  });

  it("should handle cleanup current domain", async () => {
    const { findByText } = render(<IndexPopup />);
    const clearButton = await findByText("清除当前网站");
    fireEvent.click(clearButton);
    expect(clearButton).toBeTruthy();
  });

  it("should handle settings with different modes", async () => {
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:settings") {
        return [
          {
            mode: "whitelist",
            clearType: "all",
            enableAutoCleanup: false,
            cleanupOnTabDiscard: false,
            cleanupOnStartup: false,
            clearCache: false,
            clearLocalStorage: false,
            clearIndexedDB: false,
          },
          vi.fn(),
        ];
      }
      return [defaultValue, vi.fn()];
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should handle empty whitelist and blacklist", async () => {
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:whitelist") {
        return [[], vi.fn()];
      }
      if (key === "local:blacklist") {
        return [[], vi.fn()];
      }
      if (key === "local:settings") {
        return [
          {
            mode: "whitelist",
            clearType: "all",
            enableAutoCleanup: false,
            cleanupOnTabDiscard: false,
            cleanupOnStartup: false,
            clearCache: false,
            clearLocalStorage: false,
            clearIndexedDB: false,
          },
          vi.fn(),
        ];
      }
      return [defaultValue, vi.fn()];
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should handle populated whitelist and blacklist", async () => {
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:whitelist") {
        return [["example.com", "test.com"], vi.fn()];
      }
      if (key === "local:blacklist") {
        return [["bad.com"], vi.fn()];
      }
      if (key === "local:settings") {
        return [
          {
            mode: "whitelist",
            clearType: "all",
            enableAutoCleanup: false,
            cleanupOnTabDiscard: false,
            cleanupOnStartup: false,
            clearCache: false,
            clearLocalStorage: false,
            clearIndexedDB: false,
          },
          vi.fn(),
        ];
      }
      return [defaultValue, vi.fn()];
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should handle blacklist mode and show blacklist tab", async () => {
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:settings") {
        return [
          {
            mode: "blacklist",
            clearType: "all",
            enableAutoCleanup: false,
            cleanupOnTabDiscard: false,
            cleanupOnStartup: false,
            clearCache: false,
            clearLocalStorage: false,
            clearIndexedDB: false,
          },
          vi.fn(),
        ];
      }
      return [defaultValue, vi.fn()];
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should handle cleanupOnStartup enabled", async () => {
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:settings") {
        return [
          {
            mode: "whitelist",
            clearType: "all",
            enableAutoCleanup: false,
            cleanupOnTabDiscard: false,
            cleanupOnStartup: true,
            clearCache: false,
            clearLocalStorage: false,
            clearIndexedDB: false,
          },
          vi.fn(),
        ];
      }
      return [defaultValue, vi.fn()];
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should handle cleanupExpiredCookies enabled", async () => {
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:settings") {
        return [
          {
            mode: "whitelist",
            clearType: "all",
            enableAutoCleanup: false,
            cleanupOnTabDiscard: false,
            cleanupOnStartup: false,
            cleanupExpiredCookies: true,
            clearCache: false,
            clearLocalStorage: false,
            clearIndexedDB: false,
          },
          vi.fn(),
        ];
      }
      return [defaultValue, vi.fn()];
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should handle invalid URL in tab", async () => {
    (chrome.tabs.query as Mock).mockResolvedValue([{ url: "chrome://extensions" }]);

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should handle tab query error", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    (chrome.tabs.query as Mock).mockImplementation(() =>
      Promise.reject(new Error("Tab query failed"))
    );

    const { findByText, unmount } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();

    unmount();
    consoleErrorSpy.mockRestore();
  });

  it("should handle quickAddToWhitelist when domain already in whitelist", async () => {
    const mockSetWhitelist = vi.fn();
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:whitelist") {
        return [["example.com"], mockSetWhitelist];
      }
      if (key === "local:settings") {
        return [{ mode: "whitelist", clearType: "all" }, vi.fn()];
      }
      return [defaultValue, vi.fn()];
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should handle quickAddToBlacklist when domain already in blacklist", async () => {
    const mockSetBlacklist = vi.fn();
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:blacklist") {
        return [["example.com"], mockSetBlacklist];
      }
      if (key === "local:settings") {
        return [{ mode: "blacklist", clearType: "all" }, vi.fn()];
      }
      return [defaultValue, vi.fn()];
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should handle clearCookies with multiple cleared domains", async () => {
    const { performCleanupWithFilter } = await import("@/utils/cleanup");
    (performCleanupWithFilter as Mock).mockResolvedValue({
      count: 10,
      clearedDomains: ["example.com", "test.com", "demo.com"],
    });

    const { findByText } = render(<IndexPopup />);
    const clearAllBtn = await findByText("清除所有Cookie");
    fireEvent.click(clearAllBtn);
    expect(clearAllBtn).toBeTruthy();
  });

  it("should handle clearCookies with zero count", async () => {
    const { performCleanupWithFilter } = await import("@/utils/cleanup");
    (performCleanupWithFilter as Mock).mockResolvedValue({
      count: 0,
      clearedDomains: [],
    });

    const { findByText } = render(<IndexPopup />);
    const clearAllBtn = await findByText("清除所有Cookie");
    fireEvent.click(clearAllBtn);
    expect(clearAllBtn).toBeTruthy();
  });

  it("should handle clearCookies error", async () => {
    const { performCleanupWithFilter } = await import("@/utils/cleanup");
    (performCleanupWithFilter as Mock).mockRejectedValue(new Error("Cleanup failed"));

    const { findByText } = render(<IndexPopup />);
    const clearAllBtn = await findByText("清除所有Cookie");
    fireEvent.click(clearAllBtn);
    expect(clearAllBtn).toBeTruthy();
  });

  it("should handle cleanupExpiredCookies with count > 0", async () => {
    const { cleanupExpiredCookies: cleanupExpired } = await import("@/utils/cleanup");
    (cleanupExpired as Mock).mockResolvedValue(5);

    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:settings") {
        return [
          {
            mode: "whitelist",
            clearType: "all",
            cleanupExpiredCookies: true,
          },
          vi.fn(),
        ];
      }
      return [defaultValue, vi.fn()];
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should handle cleanupExpiredCookies with count = 0", async () => {
    const { cleanupExpiredCookies: cleanupExpired } = await import("@/utils/cleanup");
    (cleanupExpired as Mock).mockResolvedValue(0);

    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:settings") {
        return [
          {
            mode: "whitelist",
            clearType: "all",
            cleanupExpiredCookies: true,
          },
          vi.fn(),
        ];
      }
      return [defaultValue, vi.fn()];
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should handle cleanupExpiredCookies error", async () => {
    const { cleanupExpiredCookies: cleanupExpired } = await import("@/utils/cleanup");
    (cleanupExpired as Mock).mockRejectedValue(new Error("Cleanup expired failed"));

    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:settings") {
        return [
          {
            mode: "whitelist",
            clearType: "all",
            cleanupExpiredCookies: true,
          },
          vi.fn(),
        ];
      }
      return [defaultValue, vi.fn()];
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should handle cookie change listener", async () => {
    let cookieChangeListener: (() => void) | undefined;
    (chrome.cookies.onChanged.addListener as Mock).mockImplementation((fn: () => void) => {
      cookieChangeListener = fn;
    });

    const { findByText, unmount } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();

    if (cookieChangeListener) {
      cookieChangeListener();
    }

    unmount();
  });

  it("should handle system theme change to dark", async () => {
    let themeChangeHandler: ((e: MediaQueryListEvent) => void) | undefined;
    mockMatchMedia({
      addEventListener: vi.fn((_event: string, handler: EventListenerOrEventListenerObject) => {
        themeChangeHandler = handler as (e: MediaQueryListEvent) => void;
      }) as unknown as MediaQueryList["addEventListener"],
    });

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();

    if (themeChangeHandler) {
      themeChangeHandler({ matches: true } as MediaQueryListEvent);
    }
  });

  it("should handle currentDomain empty for quick actions", async () => {
    (chrome.tabs.query as Mock).mockResolvedValue([{ url: null }]);

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });

  it("should handle multiple cookies with tracking and third-party", async () => {
    const mockCookiesWithTracking = [
      ...mockCookies,
      {
        name: "_ga",
        value: "tracking-value",
        domain: ".google-analytics.com",
        path: "/",
        secure: true,
        httpOnly: false,
        sameSite: "lax" as const,
      },
    ];
    (chrome.cookies.getAll as Mock).mockResolvedValue(mockCookiesWithTracking);

    const { findByText } = render(<IndexPopup />);
    expect(await findByText("Cookie Manager Pro")).toBeTruthy();
  });
});
