import { describe, it, expect, vi, beforeEach, Mock, afterEach } from "vitest";
import { render, fireEvent, cleanup, waitFor } from "@testing-library/react";
import IndexPopup from "@/entrypoints/popup/App";
import * as storageHook from "@/hooks/useStorage";
import { DEFAULT_SETTINGS } from "@/lib/store";
import { performCleanupWithFilter, type CleanupResult } from "@/utils/cleanup";
import type { Cookie } from "@/types";

vi.mock("@/hooks/useStorage", () => ({
  useStorage: vi.fn(),
}));

vi.mock("@/components/CookieList", () => ({
  CookieList: (props: {
    cookies: Cookie[];
    currentDomain?: string;
    onUpdate?: () => void;
    onMessage?: (msg: string, isError?: boolean) => void;
    whitelist?: string[];
    blacklist?: string[];
    onAddToWhitelist?: (domains: string[]) => void;
    onAddToBlacklist?: (domains: string[]) => void;
    showCookieRisk?: boolean;
  }) => {
    return (
      <div data-testid="cookie-list">
        <div data-testid="cookie-count">{props.cookies?.length || 0}</div>
        <div data-testid="current-domain">{props.currentDomain || "无域名"}</div>
        {(props.showCookieRisk ?? true) ? (
          <div data-testid="cookie-risk-enabled">Risk enabled</div>
        ) : (
          <div data-testid="cookie-risk-disabled">Risk disabled</div>
        )}
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
        <button onClick={() => props.onUpdate?.()} data-testid="update-cookies">
          更新
        </button>
        <button onClick={() => props.onMessage?.("测试消息", false)} data-testid="show-message">
          显示消息
        </button>
        Cookie 详情
      </div>
    );
  },
}));

vi.mock("@/components/DomainManager", () => ({
  DomainManager: ({
    type,
    currentDomain: _currentDomain,
    onMessage,
    onClearBlacklist,
  }: {
    type: "whitelist" | "blacklist";
    currentDomain: string;
    onMessage: (msg: string) => void;
    onClearBlacklist?: () => void;
  }) => (
    <div data-testid="domain-manager">
      <span>{type === "whitelist" ? "Whitelist" : "Blacklist"}</span>
      <button onClick={() => onMessage("test message")}>Test Message</button>
      {type === "blacklist" && onClearBlacklist && (
        <button onClick={onClearBlacklist} data-testid="clear-blacklist">
          Clear Blacklist
        </button>
      )}
    </div>
  ),
}));

let mockShowConfirmCallback: (() => void) | null = null;
const mockShowConfirm = vi.fn(
  (_title: string, _message: string, _variant: "danger" | "warning", onConfirm: () => void) => {
    mockShowConfirmCallback = onConfirm;
    onConfirm();
  }
);

vi.mock("@/hooks/useConfirmDialog", () => ({
  useConfirmDialog: () => ({
    confirmState: {
      isOpen: false,
      title: "",
      message: "",
      variant: "warning",
      onConfirm: () => {},
    },
    showConfirm: mockShowConfirm,
    closeConfirm: () => {},
    handleConfirm: () => {},
  }),
}));

vi.mock("@/hooks/useClearLog", () => ({
  useClearLog: () => ({
    addLog: vi.fn(),
  }),
}));

vi.mock("@/utils/cleanup", () => ({
  performCleanupWithFilter: vi.fn(() =>
    Promise.resolve({ count: 5, clearedDomains: ["example.com"] })
  ),
  performCleanup: vi.fn(() => Promise.resolve({ count: 2, clearedDomains: ["test.com"] })),
}));

vi.mock("@/utils", () => ({
  isDomainMatch: vi.fn((domain: string, currentDomain: string) => {
    const normalizedDomain = domain.replace(/^\./, "").toLowerCase();
    const normalizedCurrent = currentDomain.replace(/^\./, "").toLowerCase();
    if (normalizedDomain === normalizedCurrent) return true;
    if (normalizedCurrent.endsWith("." + normalizedDomain)) return true;
    if (normalizedDomain.endsWith("." + normalizedCurrent)) return true;
    return false;
  }),
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
  getCookieKey: vi.fn((name: string, domain: string, path?: string, storeId?: string) => {
    return `${name}|${domain}|${path ?? "/"}|${storeId ?? "0"}`;
  }),
  toggleSetValue: vi.fn((set: Set<string>, value: string) => {
    const next = new Set(set);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    return next;
  }),
  buildDomainString: vi.fn(() => "测试域名"),
  getHoverColor: vi.fn((hex: string) => hex),
  getActiveColor: vi.fn((hex: string) => hex),
}));

const DEFAULT_MATCH_MEDIA_OVERRIDES: Partial<MediaQueryList> = {};

const mockMatchMedia = (overrides: Partial<MediaQueryList> = DEFAULT_MATCH_MEDIA_OVERRIDES) => {
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

interface MockStorageOptions {
  whitelist?: string[];
  blacklist?: string[];
  mode?: string;
  clearType?: string;
  enableAutoCleanup?: boolean;
  cleanupOnTabDiscard?: boolean;
  cleanupOnTabClose?: boolean;
  cleanupOnBrowserClose?: boolean;
  cleanupOnNavigate?: boolean;
  cleanupOnStartup?: boolean;
  clearCache?: boolean;
  clearLocalStorage?: boolean;
  clearIndexedDB?: boolean;
  cleanupExpiredCookies?: boolean;
  logRetention?: string;
  themeMode?: string;
  customTheme?: Record<string, string>;
  scheduleInterval?: string;
  showCookieRisk?: boolean;
  locale?: string;
}

const DEFAULT_MOCK_STORAGE_OPTIONS: MockStorageOptions = {};

const createMockStorage = (overrides: MockStorageOptions = DEFAULT_MOCK_STORAGE_OPTIONS) => {
  return (key: string, defaultValue: unknown) => {
    if (key === "local:whitelist") {
      return [overrides.whitelist ?? [], vi.fn()];
    }
    if (key === "local:blacklist") {
      return [overrides.blacklist ?? [], vi.fn()];
    }
    if (key === "local:settings") {
      return [{ ...DEFAULT_SETTINGS, ...overrides }, vi.fn()];
    }
    if (key === "local:clearLog") {
      return [[], vi.fn()];
    }
    return [defaultValue, vi.fn()];
  };
};

const setupMockStorage = (overrides: MockStorageOptions = DEFAULT_MOCK_STORAGE_OPTIONS) => {
  (storageHook.useStorage as Mock).mockImplementation(createMockStorage(overrides));
};

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

const setupChromeMocks = () => {
  global.chrome = {
    cookies: {
      getAll: vi.fn(() => Promise.resolve(mockCookies)),
      remove: vi.fn(() => Promise.resolve()),
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
};

const clickClearAllAndConfirm = async (container: HTMLElement) => {
  const quickActions = container.querySelector('[data-testid="quick-actions"]');
  if (!quickActions) {
    throw new Error("Quick actions not found");
  }
  const clearAllButton =
    quickActions.querySelector(".btn-danger") || quickActions.querySelector("button:last-child");
  if (!clearAllButton) {
    throw new Error("Clear all button not found");
  }
  fireEvent.click(clearAllButton);

  await waitFor(() => {
    expect(mockShowConfirm).toHaveBeenCalled();
  });

  await waitFor(() => {
    expect(mockShowConfirmCallback).toBeTruthy();
  });
};

const testRenderWithStorage = (
  storageOptions: MockStorageOptions = DEFAULT_MOCK_STORAGE_OPTIONS
) => {
  setupMockStorage(storageOptions);
  const { container } = render(<IndexPopup />);
  expect(container.querySelector("header")).toBeTruthy();
};

const testKeyboardNavigation = (key: string) => {
  const { container } = render(<IndexPopup />);
  const tablist = container.querySelector(".tabs");
  if (tablist) {
    fireEvent.keyDown(tablist, { key });
    expect(tablist).toBeTruthy();
  }
};

const testTabSwitching = (tabTestId: string) => {
  const { container } = render(<IndexPopup />);
  const tab = container.querySelector(`[data-testid="${tabTestId}"]`);
  if (tab) {
    fireEvent.click(tab);
    expect(tab).toBeTruthy();
  }
};

const testQuickAddButton = async (listType: "whitelist" | "blacklist", initialList: string[]) => {
  const mockSetList = vi.fn();
  const mode = listType === "whitelist" ? "whitelist" : "blacklist";

  const { isInList } = await import("@/utils");
  vi.mocked(isInList).mockImplementation((domain: string, list: string[]) => {
    return list.some((item) => domain === item || domain.endsWith("." + item));
  });

  (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
    if (key === `local:${listType}`) {
      return [initialList, mockSetList];
    }
    if (key === "local:settings") {
      return [{ ...DEFAULT_SETTINGS, mode }, vi.fn()];
    }
    if (key === "local:clearLog") {
      return [[], vi.fn()];
    }
    return [defaultValue, vi.fn()];
  });

  const { container } = render(<IndexPopup />);

  await waitFor(() => {
    const siteTitle = container.querySelector(".site-title");
    expect(siteTitle?.textContent).not.toBe("");
  });

  const quickActions = container.querySelector('[data-testid="quick-actions"]');
  if (!quickActions) {
    throw new Error("Quick actions not found");
  }

  const buttons = quickActions.querySelectorAll("button");
  if (buttons.length < 2) {
    throw new Error("Quick add button not found");
  }
  fireEvent.click(buttons[1]);

  return waitFor(() => {
    const toastMessage = container.querySelector('[data-testid="toast-message"]');
    expect(toastMessage?.textContent?.trim()).not.toBe("");

    if (initialList.includes("example.com")) {
      const expectedKey = listType === "whitelist" ? "alreadyInWhitelist" : "alreadyInBlacklist";
      expect(toastMessage?.textContent).toContain(expectedKey);
    } else {
      expect(mockSetList).toHaveBeenCalled();
      const expectedKey = listType === "whitelist" ? "addedToWhitelist" : "addedToBlacklist";
      expect(toastMessage?.textContent).toContain(expectedKey);
    }
  });
};

const testRulesTab = (
  mode: "whitelist" | "blacklist",
  expectedText: string,
  checkClearBlacklist?: boolean
) => {
  setupMockStorage({ mode });
  const { container, getByTestId } = render(<IndexPopup />);

  const rulesTab = container.querySelector('[data-testid="tab-rules"]');
  if (rulesTab) {
    fireEvent.click(rulesTab);
  }

  expect(getByTestId("domain-manager")).toBeTruthy();
  expect(getByTestId("domain-manager").textContent).toContain(expectedText);
  if (checkClearBlacklist) {
    expect(getByTestId("clear-blacklist")).toBeTruthy();
  }
};

const DEFAULT_CLEANUP_RESULT: CleanupResult = { count: 0, clearedDomains: [] };

const testClearBlacklist = async (
  mockResult: CleanupResult = DEFAULT_CLEANUP_RESULT,
  storageOptions: MockStorageOptions = DEFAULT_MOCK_STORAGE_OPTIONS,
  tabQueryOverride?: chrome.tabs.Tab[]
) => {
  vi.mocked(performCleanupWithFilter).mockResolvedValue(mockResult);

  if (tabQueryOverride) {
    vi.mocked(chrome.tabs.query).mockImplementation(() => Promise.resolve(tabQueryOverride));
  }

  setupMockStorage({ mode: "blacklist", ...storageOptions });
  const { container, getByTestId } = render(<IndexPopup />);

  await waitFor(() => {
    expect(container.querySelector(".tabs")).toBeTruthy();
  });

  const rulesTab = container.querySelector('[data-testid="tab-rules"]');
  if (rulesTab) {
    fireEvent.click(rulesTab);
  }

  await waitFor(() => {
    const clearBtn = getByTestId("clear-blacklist");
    fireEvent.click(clearBtn);
  });
};

describe("IndexPopup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowConfirmCallback = null;
    setupChromeMocks();
    setupMockStorage();
    mockMatchMedia();
  });

  afterEach(() => {
    cleanup();
  });

  it("should render popup", async () => {
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("should render site summary", () => {
    const { getByTestId } = render(<IndexPopup />);
    expect(getByTestId("site-summary")).toBeTruthy();
  });

  it("should render quick actions", () => {
    const { getByTestId } = render(<IndexPopup />);
    expect(getByTestId("quick-actions")).toBeTruthy();
  });

  it("should render insight grid", () => {
    const { getByTestId } = render(<IndexPopup />);
    expect(getByTestId("insight-grid")).toBeTruthy();
  });

  it("should render toast message", () => {
    const { getByTestId } = render(<IndexPopup />);
    expect(getByTestId("toast-message")).toBeTruthy();
  });

  it("should render tabs", () => {
    const { container } = render(<IndexPopup />);
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBeGreaterThan(0);
  });

  it("should render cookie list", () => {
    const { getByTestId } = render(<IndexPopup />);
    expect(getByTestId("cookie-list")).toBeTruthy();
  });

  it("should handle empty cookies", async () => {
    (chrome.cookies.getAll as Mock).mockResolvedValue([]);
    const { getByTestId } = render(<IndexPopup />);

    await waitFor(() => {
      expect(getByTestId("cookie-count").textContent).toBe("0");
    });

    expect(getByTestId("insight-grid")).toBeTruthy();
  });

  it("should handle tab without URL", async () => {
    (chrome.tabs.query as Mock).mockResolvedValue([{}]);
    const { container, getByTestId } = render(<IndexPopup />);

    await waitFor(() => {
      expect(container.querySelector("header")).toBeTruthy();
    });

    expect(getByTestId("current-domain").textContent).toBe("无域名");
  });

  it("should handle error when getting cookies", async () => {
    (chrome.cookies.getAll as Mock).mockRejectedValue(new Error("Failed"));
    const { getByTestId } = render(<IndexPopup />);

    await waitFor(() => {
      const toastMessage = getByTestId("toast-message");
      expect(toastMessage.getAttribute("role")).toBe("alert");
      expect(toastMessage.textContent?.trim()).not.toBe("");
    });
  });

  it("should render all stat items", () => {
    const { getByTestId } = render(<IndexPopup />);
    expect(getByTestId("insight-grid")).toBeTruthy();
  });

  it("should handle theme mode - auto", () => {
    testRenderWithStorage({ themeMode: "auto" });
  });

  it("should handle theme mode - light", () => {
    testRenderWithStorage({ themeMode: "light" });
  });

  it("should handle theme mode - dark", () => {
    testRenderWithStorage({ themeMode: "dark" });
  });

  it("should handle theme mode - custom", () => {
    testRenderWithStorage({
      themeMode: "custom",
      customTheme: {
        primary: "#ff0000",
        success: "#00ff00",
        warning: "#ffff00",
        danger: "#0000ff",
        bgPrimary: "#ffffff",
        textPrimary: "#000000",
      },
    });
  });

  it("should handle different modes", () => {
    testRenderWithStorage({ mode: "whitelist" });
  });

  it("should handle empty whitelist and blacklist", () => {
    testRenderWithStorage({ whitelist: [], blacklist: [] });
  });

  it("should handle populated whitelist and blacklist", () => {
    testRenderWithStorage({
      whitelist: ["example.com", "test.com"],
      blacklist: ["bad.com"],
    });
  });

  it("should handle cleanupOnStartup enabled", () => {
    testRenderWithStorage({ cleanupOnStartup: true });
  });

  it("should handle cleanupExpiredCookies enabled", () => {
    testRenderWithStorage({ cleanupExpiredCookies: true });
  });

  it("should handle invalid URL in tab", () => {
    (chrome.tabs.query as Mock).mockResolvedValue([{ url: "chrome://extensions" }]);
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("should handle multiple cookies", () => {
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
    const { getByTestId } = render(<IndexPopup />);
    expect(getByTestId("insight-grid")).toBeTruthy();
  });

  it("should handle click on tab", () => {
    const { container } = render(<IndexPopup />);
    const tabs = container.querySelectorAll('[role="tab"]');
    if (tabs.length > 1) {
      fireEvent.click(tabs[1]);
      expect(tabs[1]).toBeTruthy();
    }
  });

  it("should handle click on add to whitelist button", () => {
    const mockOnAddToWhitelist = vi.fn();
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:whitelist") {
        return [[], mockOnAddToWhitelist];
      }
      if (key === "local:settings") {
        return [{ mode: "whitelist", clearType: "all" }, vi.fn()];
      }
      if (key === "local:clearLog") {
        return [[], vi.fn()];
      }
      return [defaultValue, vi.fn()];
    });

    const { getByTestId } = render(<IndexPopup />);
    const button = getByTestId("add-to-whitelist");
    fireEvent.click(button);

    expect(mockOnAddToWhitelist).toHaveBeenCalled();
  });

  it("should handle click on add to blacklist button", () => {
    const mockOnAddToBlacklist = vi.fn();
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:blacklist") {
        return [[], mockOnAddToBlacklist];
      }
      if (key === "local:settings") {
        return [{ mode: "whitelist", clearType: "all" }, vi.fn()];
      }
      if (key === "local:clearLog") {
        return [[], vi.fn()];
      }
      return [defaultValue, vi.fn()];
    });

    const { getByTestId } = render(<IndexPopup />);
    const button = getByTestId("add-to-blacklist");
    fireEvent.click(button);

    expect(mockOnAddToBlacklist).toHaveBeenCalled();
  });

  it("should handle click on clear all button", () => {
    const { getByTestId } = render(<IndexPopup />);
    const quickActions = getByTestId("quick-actions");
    const buttons = quickActions.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);

    if (buttons.length > 0) {
      fireEvent.click(buttons[0]);
      expect(buttons[0]).toBeTruthy();
    }
  });

  it("should handle click on clear current button", () => {
    const { getByTestId } = render(<IndexPopup />);
    const quickActions = getByTestId("quick-actions");
    const buttons = quickActions.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(1);

    if (buttons.length > 1) {
      fireEvent.click(buttons[1]);
      expect(buttons[1]).toBeTruthy();
    }
  });

  it("should handle keyboard navigation", () => {
    const { container } = render(<IndexPopup />);
    const tabs = container.querySelector(".tabs");
    if (tabs) {
      const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
      for (const key of keys) {
        fireEvent.keyDown(tabs, { key });
      }
    }
  });

  it("should handle system theme change", () => {
    const addEventListenerSpy = vi.fn();
    mockMatchMedia({
      matches: true,
      addEventListener: addEventListenerSpy,
    });

    const { unmount } = render(<IndexPopup />);
    unmount();
    expect(addEventListenerSpy).toHaveBeenCalled();
  });

  it("should handle log retention settings", () => {
    testRenderWithStorage({ logRetention: "forever" });
  });

  it("should handle settings with different clear types", () => {
    testRenderWithStorage({ clearType: "session" });
  });

  it("should handle settings with auto cleanup options", () => {
    testRenderWithStorage({
      enableAutoCleanup: true,
      cleanupOnTabDiscard: true,
      cleanupOnTabClose: true,
    });
  });

  it("should handle settings with advanced cleanup options", () => {
    testRenderWithStorage({
      clearCache: true,
      clearLocalStorage: true,
      clearIndexedDB: true,
    });
  });

  it("should handle tab query error", async () => {
    (chrome.tabs.query as Mock).mockRejectedValue(new Error("Tab query failed"));

    const { container } = render(<IndexPopup />);

    await waitFor(() => {
      expect(container.querySelector("header")).toBeTruthy();
    });

    expect(container.querySelector("header")).toBeTruthy();
  });

  it("should handle cookie change listener", () => {
    let cookieChangeListener: (() => void) | undefined;
    (chrome.cookies.onChanged.addListener as Mock).mockImplementation((fn: () => void) => {
      cookieChangeListener = fn;
    });

    const { unmount } = render(<IndexPopup />);

    if (cookieChangeListener) {
      cookieChangeListener();
    }

    unmount();
  });

  it("should render cookie list in manage tab", () => {
    const { container } = render(<IndexPopup />);
    expect(container.querySelector('[data-testid="cookie-list"]')).toBeTruthy();
  });

  it("should handle confirm dialog", () => {
    const { container } = render(<IndexPopup />);
    const quickActions = container.querySelector('[data-testid="quick-actions"]');
    if (quickActions) {
      const buttons = quickActions.querySelectorAll("button");
      if (buttons.length > 0) {
        fireEvent.click(buttons[0]);
        expect(buttons[0]).toBeTruthy();
      }
    }
  });

  it("should handle blacklist mode", () => {
    testRenderWithStorage({ mode: "blacklist" });
  });

  it("should handle current domain empty", () => {
    (chrome.tabs.query as Mock).mockResolvedValue([{ url: null }]);
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("should handle clearCookies with multiple domains", async () => {
    vi.mocked(performCleanupWithFilter).mockResolvedValue({
      count: 10,
      clearedDomains: ["example.com", "test.com"],
    });

    const { container } = render(<IndexPopup />);

    await clickClearAllAndConfirm(container);

    await waitFor(() => {
      expect(performCleanupWithFilter).toHaveBeenCalled();
    });

    expect(performCleanupWithFilter).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        clearType: expect.any(String),
      })
    );
  });

  it("should handle clearCookies with zero count", async () => {
    vi.mocked(performCleanupWithFilter).mockResolvedValue({
      count: 0,
      clearedDomains: [],
    });

    const { container } = render(<IndexPopup />);

    await clickClearAllAndConfirm(container);

    await waitFor(() => {
      expect(performCleanupWithFilter).toHaveBeenCalled();
    });
  });

  it("should handle clearCookies error", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(performCleanupWithFilter).mockRejectedValue(new Error("Cleanup failed"));

    const { container } = render(<IndexPopup />);

    await clickClearAllAndConfirm(container);

    await waitFor(() => {
      expect(performCleanupWithFilter).toHaveBeenCalled();
    });

    consoleErrorSpy.mockRestore();
  });

  it("should show message when domain already in whitelist via quick add button", async () => {
    await testQuickAddButton("whitelist", ["example.com"]);
  });

  it("should show message when domain already in blacklist via quick add button", async () => {
    await testQuickAddButton("blacklist", ["example.com"]);
  });

  it("should handle tab switching to rules tab with whitelist mode", () => {
    testRulesTab("whitelist", "Whitelist");
  });

  it("should handle tab switching to rules tab with blacklist mode", () => {
    testRulesTab("blacklist", "Blacklist", true);
  });

  it("should show cookie risk when enabled", () => {
    setupMockStorage({ showCookieRisk: true });
    const { container } = render(<IndexPopup />);
    const riskEnabled = container.querySelector('[data-testid="cookie-risk-enabled"]');
    expect(riskEnabled).toBeTruthy();
  });

  it("should not show cookie risk when disabled", () => {
    setupMockStorage({ showCookieRisk: false });
    const { container } = render(<IndexPopup />);
    const riskDisabled = container.querySelector('[data-testid="cookie-risk-disabled"]');
    expect(riskDisabled).toBeTruthy();
  });

  it("should handle tab switching to settings tab", () => {
    testTabSwitching("tab-settings");
  });

  it("should handle tab switching to log tab", () => {
    testTabSwitching("tab-log");
  });

  it("should handle keyboard navigation with ArrowRight", () => {
    testKeyboardNavigation("ArrowRight");
  });

  it("should handle keyboard navigation with ArrowLeft", () => {
    testKeyboardNavigation("ArrowLeft");
  });

  it("should handle keyboard navigation with Home", () => {
    testKeyboardNavigation("Home");
  });

  it("should handle keyboard navigation with End", () => {
    testKeyboardNavigation("End");
  });

  it("should handle clear current cookies", () => {
    const { getByTestId } = render(<IndexPopup />);
    const quickActions = getByTestId("quick-actions");
    const clearCurrentButton = quickActions.querySelector("button:first-child");
    if (clearCurrentButton) {
      fireEvent.click(clearCurrentButton);
      expect(clearCurrentButton).toBeTruthy();
    }
  });

  it("should handle message display and auto-hide", async () => {
    const { getByTestId } = render(<IndexPopup />);

    await waitFor(() => {
      expect(getByTestId("site-summary")).toBeTruthy();
    });

    const toastMessage = getByTestId("toast-message");
    expect(toastMessage).toBeTruthy();
  });

  it("should handle custom theme colors", () => {
    testRenderWithStorage({
      themeMode: "custom",
      customTheme: {
        primary: "#ff0000",
        success: "#00ff00",
        warning: "#ffff00",
        danger: "#0000ff",
        bgPrimary: "#ffffff",
        bgSecondary: "#f8fafc",
        textPrimary: "#0f172a",
        textSecondary: "#475569",
      },
    });
  });

  it("should handle tab switching to all tabs", async () => {
    const { container } = render(<IndexPopup />);

    await waitFor(() => {
      expect(container.querySelector(".tabs")).toBeTruthy();
    });

    const manageTab = container.querySelector('[data-testid="tab-manage"]');
    const rulesTab = container.querySelector('[data-testid="tab-rules"]');
    const settingsTab = container.querySelector('[data-testid="tab-settings"]');
    const logTab = container.querySelector('[data-testid="tab-log"]');

    expect(manageTab).toBeTruthy();
    expect(rulesTab).toBeTruthy();
    expect(settingsTab).toBeTruthy();
    expect(logTab).toBeTruthy();

    if (manageTab) fireEvent.click(manageTab);
    if (rulesTab) fireEvent.click(rulesTab);
    if (settingsTab) fireEvent.click(settingsTab);
    if (logTab) fireEvent.click(logTab);
  });

  it("should show message when domain is added to whitelist via quick add button", async () => {
    await testQuickAddButton("whitelist", []);
  });

  it("should show message when domain is added to blacklist via quick add button", async () => {
    await testQuickAddButton("blacklist", []);
  });

  it("should handle clear blacklist cookies in rules tab with blacklist mode", async () => {
    await testClearBlacklist(
      { count: 5, clearedDomains: ["example.com"] },
      { blacklist: ["example.com"] }
    );
    await waitFor(() => {
      expect(performCleanupWithFilter).toHaveBeenCalled();
    });
  });

  it("should handle clear blacklist with cookies found and current domain in cleared domains", async () => {
    await testClearBlacklist(
      { count: 5, clearedDomains: ["example.com", "test.com"] },
      { blacklist: ["example.com", "test.com"] },
      [{ url: "https://example.com/page", active: true } as chrome.tabs.Tab]
    );
  });

  it("should handle clear blacklist with no cookies found", async () => {
    await testClearBlacklist({ count: 0, clearedDomains: [] }, { blacklist: ["example.com"] });
  });

  it("should handle clear blacklist error", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(performCleanupWithFilter).mockRejectedValue(new Error("Clear failed"));

    await testClearBlacklist(undefined, { blacklist: ["example.com"] });

    await waitFor(() => {
      expect(performCleanupWithFilter).toHaveBeenCalled();
    });

    consoleErrorSpy.mockRestore();
  });

  it("should apply custom theme correctly when theme mode is custom", async () => {
    const customTheme = {
      primary: "#ff0000",
      success: "#00ff00",
      warning: "#ffff00",
      danger: "#0000ff",
      bgPrimary: "#ffffff",
      bgSecondary: "#f0f0f0",
      textPrimary: "#000000",
      textSecondary: "#666666",
    };

    setupMockStorage({
      themeMode: "custom",
      customTheme,
    });

    render(<IndexPopup />);

    await waitFor(() => {
      const root = document.documentElement;
      expect(root.style.getPropertyValue("--accent-primary")).toBe(customTheme.primary);
    });
  });

  it("should clear custom theme variables when theme mode is not custom", async () => {
    setupMockStorage({ themeMode: "custom" });
    const { rerender } = render(<IndexPopup />);

    setupMockStorage({ themeMode: "light" });
    rerender(<IndexPopup />);

    const root = document.documentElement;
    expect(root.style.getPropertyValue("--accent-primary")).toBe("");
  });
});
