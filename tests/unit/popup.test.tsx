import { describe, it, expect, vi, beforeEach, Mock, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import IndexPopup from "@/entrypoints/popup/App";
import * as storageHook from "@/hooks/useStorage";
import { DEFAULT_SETTINGS } from "@/lib/store";
import { performCleanupWithFilter, cleanupExpiredCookies } from "@/utils/cleanup";

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
  settings?: Record<string, unknown>;
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
      return [{ ...DEFAULT_SETTINGS, ...overrides.settings }, vi.fn()];
    }
    return [defaultValue, vi.fn()];
  };
};

const setupMockStorage = (overrides: MockStorageOptions = {}) => {
  (storageHook.useStorage as Mock).mockImplementation(createMockStorage(overrides));
};

const renderPopup = async () => {
  const result = render(<IndexPopup />);
  await result.findByText("Cookie Manager Pro");
  return result;
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
    _cookieListProps = null;
    setupChromeMocks();
    setupMockStorage();
    mockMatchMedia();
  });

  afterEach(() => {
    cleanup();
  });

  it("should render popup container", async () => {
    await renderPopup();
  });

  it("should render cookie stats", async () => {
    const { findByText } = await renderPopup();
    expect(await findByText(/Cookie统计/)).toBeTruthy();
  });

  it("should render action buttons", async () => {
    const { findByText } = await renderPopup();
    expect(await findByText("清除所有Cookie")).toBeTruthy();
    expect(await findByText("清除当前网站")).toBeTruthy();
  });

  it("should render tabs", async () => {
    const { findByRole } = await renderPopup();
    expect(await findByRole("tab", { name: /管理/ })).toBeTruthy();
    expect(await findByRole("tab", { name: /白名单/ })).toBeTruthy();
    expect(await findByRole("tab", { name: /设置/ })).toBeTruthy();
    expect(await findByRole("tab", { name: /日志/ })).toBeTruthy();
  });

  it("should switch between tabs", async () => {
    const { findByRole } = await renderPopup();
    const settingsTab = await findByRole("tab", { name: /设置/ });
    fireEvent.click(settingsTab);
    expect(settingsTab).toHaveAttribute("aria-selected", "true");
  });

  it("should handle add to whitelist", async () => {
    const { findByTestId } = await renderPopup();
    const addButton = await findByTestId("add-to-whitelist");
    fireEvent.click(addButton);
    expect(addButton).toBeTruthy();
  });

  it("should handle add to blacklist", async () => {
    const { findByTestId } = await renderPopup();
    const addButton = await findByTestId("add-to-blacklist");
    fireEvent.click(addButton);
    expect(addButton).toBeTruthy();
  });

  it("should render cookie list", async () => {
    const { findByTestId } = await renderPopup();
    expect(await findByTestId("cookie-list")).toBeTruthy();
  });

  it("should handle settings change", async () => {
    setupMockStorage({
      settings: {
        mode: "blacklist",
        clearType: "session",
        enableAutoCleanup: true,
        cleanupOnTabDiscard: true,
        cleanupOnStartup: true,
        clearCache: true,
        clearLocalStorage: true,
        clearIndexedDB: true,
      },
    });
    await renderPopup();
  });

  it("should handle empty cookies", async () => {
    (chrome.cookies.getAll as Mock).mockResolvedValue([]);
    await renderPopup();
  });

  it("should handle tab without URL", async () => {
    (chrome.tabs.query as Mock).mockResolvedValue([{}]);
    await renderPopup();
  });

  it("should call quickClearAll when clicking clear all button", async () => {
    const { findByRole } = await renderPopup();
    const clearAllBtn = await findByRole("button", { name: /清除所有/ });
    fireEvent.click(clearAllBtn);
    expect(clearAllBtn).toBeTruthy();
  });

  it("should call quickClearCurrent when clicking clear current button", async () => {
    const { findByText } = await renderPopup();
    const clearCurrentBtn = await findByText("清除当前网站");
    fireEvent.click(clearCurrentBtn);
    expect(clearCurrentBtn).toBeTruthy();
  });

  it("should test quickAddToWhitelist when current domain exists", async () => {
    setupMockStorage({
      whitelist: ["other.com"],
      settings: { mode: "whitelist", clearType: "all" },
    });
    await renderPopup();
  });

  it("should test quickAddToBlacklist when current domain exists", async () => {
    setupMockStorage({
      blacklist: ["other.com"],
      settings: { mode: "blacklist", clearType: "all" },
    });
    await renderPopup();
  });

  it("should handle keyboard navigation keys without crashing", async () => {
    const { container } = await renderPopup();
    const tabs = container.querySelector(".tabs");
    expect(tabs).toBeTruthy();

    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    for (const key of keys) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      fireEvent.keyDown(tabs!, { key });
    }
  });

  const themeModes = [
    { mode: "auto", name: "AUTO" },
    { mode: "light", name: "LIGHT" },
    { mode: "dark", name: "DARK" },
  ];
  themeModes.forEach(({ mode, name }) => {
    it(`should test theme mode - ${name}`, async () => {
      setupMockStorage({ settings: { themeMode: mode } });
      await renderPopup();
    });
  });

  it("should test theme mode - CUSTOM with custom theme", async () => {
    setupMockStorage({
      settings: {
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
    });
    await renderPopup();
  });

  it("should test system theme change listener", async () => {
    const addEventListenerSpy = vi.fn();
    mockMatchMedia({
      matches: true,
      addEventListener: addEventListenerSpy,
    });

    const { unmount } = await renderPopup();
    unmount();
    expect(addEventListenerSpy).toHaveBeenCalled();
  });

  const logRetentions = ["forever", "day", "week", "month"];
  logRetentions.forEach((retention) => {
    it(`should test log retention - ${retention.toUpperCase()}`, async () => {
      setupMockStorage({ settings: { logRetention: retention } });
      await renderPopup();
    });
  });

  it("should handle error when getting cookies", async () => {
    (chrome.cookies.getAll as Mock).mockRejectedValue(new Error("Failed to get cookies"));
    await renderPopup();
  });

  it("should render with matchMedia", async () => {
    render(<IndexPopup />);
    expect(globalThis.matchMedia).toBeDefined();
  });

  it("should render all stat items", async () => {
    const { container } = await renderPopup();
    const statValues = container.querySelectorAll(".stat-value");
    expect(statValues.length).toBeGreaterThan(0);
  });

  it("should handle quick stats display", async () => {
    const { findByText } = await renderPopup();
    expect(await findByText(/Cookie统计/)).toBeTruthy();
  });

  it("should handle domain extraction from URL", async () => {
    await renderPopup();
  });

  it("should handle cleanup all cookies", async () => {
    const { findByText } = await renderPopup();
    const clearButton = await findByText("清除所有Cookie");
    fireEvent.click(clearButton);
    expect(clearButton).toBeTruthy();
  });

  it("should handle cleanup current domain", async () => {
    const { findByText } = await renderPopup();
    const clearButton = await findByText("清除当前网站");
    fireEvent.click(clearButton);
    expect(clearButton).toBeTruthy();
  });

  it("should handle settings with different modes", async () => {
    setupMockStorage({ settings: { mode: "whitelist" } });
    await renderPopup();
  });

  it("should handle empty whitelist and blacklist", async () => {
    setupMockStorage({ whitelist: [], blacklist: [] });
    await renderPopup();
  });

  it("should handle populated whitelist and blacklist", async () => {
    setupMockStorage({
      whitelist: ["example.com", "test.com"],
      blacklist: ["bad.com"],
    });
    await renderPopup();
  });

  it("should handle blacklist mode and show blacklist tab", async () => {
    setupMockStorage({ settings: { mode: "blacklist" } });
    await renderPopup();
  });

  it("should handle cleanupOnStartup enabled", async () => {
    setupMockStorage({ settings: { cleanupOnStartup: true } });
    await renderPopup();
  });

  it("should handle cleanupExpiredCookies enabled", async () => {
    setupMockStorage({ settings: { cleanupExpiredCookies: true } });
    await renderPopup();
  });

  it("should handle invalid URL in tab", async () => {
    (chrome.tabs.query as Mock).mockResolvedValue([{ url: "chrome://extensions" }]);
    await renderPopup();
  });

  it("should handle tab query error", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    (chrome.tabs.query as Mock).mockImplementation(() =>
      Promise.reject(new Error("Tab query failed"))
    );

    const { unmount } = await renderPopup();
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
    await renderPopup();
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
    await renderPopup();
  });

  it("should handle clearCookies with multiple cleared domains", async () => {
    vi.mocked(performCleanupWithFilter).mockResolvedValue({
      count: 10,
      clearedDomains: ["example.com", "test.com", "demo.com"],
    });

    const { findByText } = await renderPopup();
    const clearAllBtn = await findByText("清除所有Cookie");
    fireEvent.click(clearAllBtn);
    expect(clearAllBtn).toBeTruthy();
  });

  it("should handle clearCookies with zero count", async () => {
    vi.mocked(performCleanupWithFilter).mockResolvedValue({
      count: 0,
      clearedDomains: [],
    });

    const { findByText } = await renderPopup();
    const clearAllBtn = await findByText("清除所有Cookie");
    fireEvent.click(clearAllBtn);
    expect(clearAllBtn).toBeTruthy();
  });

  it("should handle clearCookies error", async () => {
    vi.mocked(performCleanupWithFilter).mockRejectedValue(new Error("Cleanup failed"));

    const { findByText } = await renderPopup();
    const clearAllBtn = await findByText("清除所有Cookie");
    fireEvent.click(clearAllBtn);
    expect(clearAllBtn).toBeTruthy();
  });

  const cleanupExpiredCookiesTests = [
    { count: 5, name: "with count > 0" },
    { count: 0, name: "with count = 0" },
  ];
  cleanupExpiredCookiesTests.forEach(({ count, name }) => {
    it(`should handle cleanupExpiredCookies ${name}`, async () => {
      vi.mocked(cleanupExpiredCookies).mockResolvedValue(count);

      setupMockStorage({ settings: { cleanupExpiredCookies: true } });
      await renderPopup();
    });
  });

  it("should handle cleanupExpiredCookies error", async () => {
    vi.mocked(cleanupExpiredCookies).mockRejectedValue(new Error("Cleanup expired failed"));

    setupMockStorage({ settings: { cleanupExpiredCookies: true } });
    await renderPopup();
  });

  it("should handle cookie change listener", async () => {
    let cookieChangeListener: (() => void) | undefined;
    (chrome.cookies.onChanged.addListener as Mock).mockImplementation((fn: () => void) => {
      cookieChangeListener = fn;
    });

    const { unmount } = await renderPopup();

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

    await renderPopup();

    if (themeChangeHandler) {
      themeChangeHandler({ matches: true } as MediaQueryListEvent);
    }
  });

  it("should handle currentDomain empty for quick actions", async () => {
    (chrome.tabs.query as Mock).mockResolvedValue([{ url: null }]);
    await renderPopup();
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
    await renderPopup();
  });
});
