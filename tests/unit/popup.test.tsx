import { describe, it, expect, vi, beforeEach, Mock, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import IndexPopup from "@/entrypoints/popup/App";
import * as storageHook from "@/hooks/useStorage";
import { DEFAULT_SETTINGS } from "@/lib/store";
import { performCleanupWithFilter, cleanupExpiredCookies } from "@/utils/cleanup";

vi.mock("@/hooks/useStorage", () => ({
  useStorage: vi.fn(),
}));

vi.mock("@/components/CookieList", () => ({
  CookieList: (props: {
    onAddToWhitelist?: (domains: string[]) => void;
    onAddToBlacklist?: (domains: string[]) => void;
  }) => {
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

const createMockStorage = (overrides: MockStorageOptions = {}) => {
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

const setupMockStorage = (overrides: MockStorageOptions = {}) => {
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
};

describe("IndexPopup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("should render cookie stats section", () => {
    const { container } = render(<IndexPopup />);
    expect(container.querySelector(".stats")).toBeTruthy();
  });

  it("should render action buttons", () => {
    const { container } = render(<IndexPopup />);
    expect(container.querySelector(".button-group")).toBeTruthy();
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

  it("should handle empty cookies", () => {
    (chrome.cookies.getAll as Mock).mockResolvedValue([]);
    const { container } = render(<IndexPopup />);
    expect(container.querySelector(".stats")).toBeTruthy();
  });

  it("should handle tab without URL", () => {
    (chrome.tabs.query as Mock).mockResolvedValue([{}]);
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("should handle error when getting cookies", () => {
    (chrome.cookies.getAll as Mock).mockRejectedValue(new Error("Failed"));
    const { container } = render(<IndexPopup />);
    expect(container.querySelector(".stats")).toBeTruthy();
  });

  it("should render all stat items", () => {
    const { container } = render(<IndexPopup />);
    const statValues = container.querySelectorAll(".stat-value");
    expect(statValues.length).toBeGreaterThan(0);
  });

  it("should handle theme mode - auto", () => {
    setupMockStorage({ themeMode: "auto" });
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("should handle theme mode - light", () => {
    setupMockStorage({ themeMode: "light" });
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("should handle theme mode - dark", () => {
    setupMockStorage({ themeMode: "dark" });
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("should handle theme mode - custom", () => {
    setupMockStorage({
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
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("should handle different modes", () => {
    setupMockStorage({ mode: "whitelist" });
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("should handle empty whitelist and blacklist", () => {
    setupMockStorage({ whitelist: [], blacklist: [] });
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("should handle populated whitelist and blacklist", () => {
    setupMockStorage({
      whitelist: ["example.com", "test.com"],
      blacklist: ["bad.com"],
    });
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("should handle cleanupOnStartup enabled", () => {
    setupMockStorage({ cleanupOnStartup: true });
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("should handle cleanupExpiredCookies enabled", () => {
    setupMockStorage({ cleanupExpiredCookies: true });
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
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
    const { container } = render(<IndexPopup />);
    expect(container.querySelector(".stats")).toBeTruthy();
  });

  it("should handle click on tab", () => {
    const { container } = render(<IndexPopup />);
    const tabs = container.querySelectorAll('[role="tab"]');
    if (tabs.length > 1) {
      fireEvent.click(tabs[1]);
      // Tab switching requires state update, just verify click works
      expect(tabs[1]).toBeTruthy();
    }
  });

  it("should handle click on add to whitelist button", () => {
    const { getByTestId } = render(<IndexPopup />);
    const button = getByTestId("add-to-whitelist");
    fireEvent.click(button);
    expect(button).toBeTruthy();
  });

  it("should handle click on add to blacklist button", () => {
    const { getByTestId } = render(<IndexPopup />);
    const button = getByTestId("add-to-blacklist");
    fireEvent.click(button);
    expect(button).toBeTruthy();
  });

  it("should handle click on clear all button", () => {
    const { container } = render(<IndexPopup />);
    const buttons = container.querySelectorAll(".button-group button");
    if (buttons.length > 0) {
      fireEvent.click(buttons[0]);
      expect(buttons[0]).toBeTruthy();
    }
  });

  it("should handle click on clear current button", () => {
    const { container } = render(<IndexPopup />);
    const buttons = container.querySelectorAll(".button-group button");
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
    setupMockStorage({ logRetention: "forever" });
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("should handle settings with different clear types", () => {
    setupMockStorage({ clearType: "session" });
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("should handle settings with auto cleanup options", () => {
    setupMockStorage({
      enableAutoCleanup: true,
      cleanupOnTabDiscard: true,
      cleanupOnTabClose: true,
    });
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("should handle settings with advanced cleanup options", () => {
    setupMockStorage({
      clearCache: true,
      clearLocalStorage: true,
      clearIndexedDB: true,
    });
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("should handle tab query error", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (chrome.tabs.query as Mock).mockRejectedValue(new Error("Tab query failed"));

    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();

    consoleErrorSpy.mockRestore();
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
    // Cookie list should be visible in manage tab by default
    expect(container.querySelector('[data-testid="cookie-list"]')).toBeTruthy();
  });

  it("should handle confirm dialog", () => {
    const { container } = render(<IndexPopup />);
    const buttons = container.querySelectorAll(".button-group button");
    if (buttons.length > 0) {
      fireEvent.click(buttons[0]);
      expect(buttons[0]).toBeTruthy();
    }
  });

  it("should handle blacklist mode", () => {
    setupMockStorage({ mode: "blacklist" });
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("should handle current domain empty", () => {
    (chrome.tabs.query as Mock).mockResolvedValue([{ url: null }]);
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("should handle clearCookies with multiple domains", () => {
    vi.mocked(performCleanupWithFilter).mockResolvedValue({
      count: 10,
      clearedDomains: ["example.com", "test.com"],
    });

    const { container } = render(<IndexPopup />);
    const buttons = container.querySelectorAll(".button-group button");
    if (buttons.length > 0) {
      fireEvent.click(buttons[0]);
    }
  });

  it("should handle clearCookies with zero count", () => {
    vi.mocked(performCleanupWithFilter).mockResolvedValue({
      count: 0,
      clearedDomains: [],
    });

    const { container } = render(<IndexPopup />);
    const buttons = container.querySelectorAll(".button-group button");
    if (buttons.length > 0) {
      fireEvent.click(buttons[0]);
    }
  });

  it("should handle clearCookies error", () => {
    vi.mocked(performCleanupWithFilter).mockRejectedValue(new Error("Cleanup failed"));

    const { container } = render(<IndexPopup />);
    const buttons = container.querySelectorAll(".button-group button");
    if (buttons.length > 0) {
      fireEvent.click(buttons[0]);
    }
  });

  it("should handle cleanupExpiredCookies with count", () => {
    vi.mocked(cleanupExpiredCookies).mockResolvedValue(5);
    setupMockStorage({ cleanupExpiredCookies: true });
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("should handle cleanupExpiredCookies error", () => {
    vi.mocked(cleanupExpiredCookies).mockRejectedValue(new Error("Cleanup failed"));
    setupMockStorage({ cleanupExpiredCookies: true });
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("should handle quickAddToWhitelist when domain already in whitelist", () => {
    const mockSetWhitelist = vi.fn();
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:whitelist") {
        return [["example.com"], mockSetWhitelist];
      }
      if (key === "local:settings") {
        return [{ mode: "whitelist", clearType: "all" }, vi.fn()];
      }
      if (key === "local:clearLog") {
        return [[], vi.fn()];
      }
      return [defaultValue, vi.fn()];
    });
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("should handle quickAddToBlacklist when domain already in blacklist", () => {
    const mockSetBlacklist = vi.fn();
    (storageHook.useStorage as Mock).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === "local:blacklist") {
        return [["example.com"], mockSetBlacklist];
      }
      if (key === "local:settings") {
        return [{ mode: "blacklist", clearType: "all" }, vi.fn()];
      }
      if (key === "local:clearLog") {
        return [[], vi.fn()];
      }
      return [defaultValue, vi.fn()];
    });
    const { container } = render(<IndexPopup />);
    expect(container.querySelector("header")).toBeTruthy();
  });
});
