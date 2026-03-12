import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockStorageData = new Map<string, unknown>();

class MockStorage {
  async get(key: string) {
    return mockStorageData.get(key);
  }
  async set(key: string, value: unknown) {
    mockStorageData.set(key, value);
  }
}

vi.mock("wxt/utils/storage", () => ({
  Storage: MockStorage,
}));

// Mock defineBackground to immediately execute the callback
vi.mock("wxt/utils/define-background", () => ({
  defineBackground: (fn: () => void) => fn(),
}));

vi.mock("@/utils/cleanup", () => ({
  performCleanup: vi.fn(() => Promise.resolve({ count: 5, clearedDomains: ["example.com"] })),
  performCleanupWithFilter: vi.fn(() =>
    Promise.resolve({ count: 10, clearedDomains: ["test.com", "example.com"] })
  ),
}));

vi.mock("@/lib/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store")>();
  return {
    ...actual,
    storage: {
      getItem: vi.fn((key: string) => Promise.resolve(mockStorageData.get(key))),
      setItem: vi.fn((key: string, value: unknown) => {
        mockStorageData.set(key, value);
        return Promise.resolve();
      }),
    },
  };
});

const listeners = {
  onInstalled: [] as Array<() => void>,
  onStartup: [] as Array<() => void>,
  onUpdated: [] as Array<(tabId: number, changeInfo: unknown, tab: unknown) => void>,
  onAlarm: [] as Array<(alarm: { name: string }) => void>,
};

describe("background", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockStorageData.clear();
    listeners.onInstalled = [];
    listeners.onStartup = [];
    listeners.onUpdated = [];
    listeners.onAlarm = [];

    global.chrome = {
      runtime: {
        onInstalled: {
          addListener: function (cb: () => void) {
            listeners.onInstalled.push(cb);
          },
          removeListener: vi.fn(),
        },
        onStartup: {
          addListener: function (cb: () => void) {
            listeners.onStartup.push(cb);
          },
          removeListener: vi.fn(),
        },
      },
      alarms: {
        create: vi.fn(),
        onAlarm: {
          addListener: function (cb: (alarm: { name: string }) => void) {
            listeners.onAlarm.push(cb);
          },
          removeListener: vi.fn(),
        },
      },
      tabs: {
        onUpdated: {
          addListener: function (cb: (tabId: number, changeInfo: unknown, tab: unknown) => void) {
            listeners.onUpdated.push(cb);
          },
          removeListener: vi.fn(),
        },
        query: vi.fn(() =>
          Promise.resolve([
            {
              id: 1,
              url: "https://example.com/test",
              active: true,
            },
          ])
        ),
      },
    } as unknown as typeof chrome;

    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should register onInstalled listener", async () => {
    await import("@/entrypoints/background");

    expect(listeners.onInstalled.length).toBeGreaterThan(0);
  });

  it("should register onStartup listener", async () => {
    await import("@/entrypoints/background");

    expect(listeners.onStartup.length).toBeGreaterThan(0);
  });

  it("should register tabs onUpdated listener", async () => {
    await import("@/entrypoints/background");

    expect(listeners.onUpdated.length).toBeGreaterThan(0);
  });

  it("should register alarms onAlarm listener", async () => {
    await import("@/entrypoints/background");

    expect(listeners.onAlarm.length).toBeGreaterThan(0);
  });

  it("should initialize whitelist on install when undefined", async () => {
    await import("@/entrypoints/background");

    for (const cb of listeners.onInstalled) {
      await cb();
    }

    expect(mockStorageData.get("local:whitelist")).toEqual([]);
  });

  it("should initialize blacklist on install when undefined", async () => {
    await import("@/entrypoints/background");

    for (const cb of listeners.onInstalled) {
      await cb();
    }

    expect(mockStorageData.get("local:blacklist")).toEqual([]);
  });

  it("should initialize settings on install when undefined", async () => {
    await import("@/entrypoints/background");

    for (const cb of listeners.onInstalled) {
      await cb();
    }

    expect(mockStorageData.get("local:settings")).toBeDefined();
  });

  it("should not overwrite existing whitelist on install", async () => {
    mockStorageData.set("local:whitelist", ["existing.com"]);

    await import("@/entrypoints/background");

    for (const cb of listeners.onInstalled) {
      await cb();
    }

    expect(mockStorageData.get("local:whitelist")).toEqual(["existing.com"]);
  });

  it("should not overwrite existing blacklist on install", async () => {
    mockStorageData.set("local:blacklist", ["bad.com"]);

    await import("@/entrypoints/background");

    for (const cb of listeners.onInstalled) {
      await cb();
    }

    expect(mockStorageData.get("local:blacklist")).toEqual(["bad.com"]);
  });

  it("should create scheduled cleanup alarm on installed", async () => {
    await import("@/entrypoints/background");

    for (const cb of listeners.onInstalled) {
      await cb();
    }

    expect(chrome.alarms.create).toHaveBeenCalledWith("scheduled-cleanup", {
      periodInMinutes: 60,
    });
  });

  it("should create scheduled cleanup alarm on startup", async () => {
    await import("@/entrypoints/background");

    for (const cb of listeners.onStartup) {
      await cb();
    }

    expect(chrome.alarms.create).toHaveBeenCalledWith("scheduled-cleanup", {
      periodInMinutes: 60,
    });
  });

  it("should handle scheduled cleanup alarm", async () => {
    const { performCleanupWithFilter } = await import("@/utils/cleanup");

    mockStorageData.set("local:settings", {
      scheduleInterval: "hourly",
      lastScheduledCleanup: Date.now() - 2 * 60 * 60 * 1000,
      clearCache: false,
      clearLocalStorage: false,
      clearIndexedDB: false,
    });

    await import("@/entrypoints/background");

    for (const cb of listeners.onAlarm) {
      await cb({ name: "scheduled-cleanup" });
    }

    expect(performCleanupWithFilter).toHaveBeenCalled();
  });

  it("should not run scheduled cleanup when disabled", async () => {
    const { performCleanupWithFilter } = await import("@/utils/cleanup");

    mockStorageData.set("local:settings", {
      scheduleInterval: "disabled",
      lastScheduledCleanup: 0,
    });

    await import("@/entrypoints/background");

    for (const cb of listeners.onAlarm) {
      await cb({ name: "scheduled-cleanup" });
    }

    expect(performCleanupWithFilter).not.toHaveBeenCalled();
  });

  it("should handle tab discard event with cleanup enabled", async () => {
    const { performCleanup } = await import("@/utils/cleanup");

    mockStorageData.set("local:settings", {
      enableAutoCleanup: true,
      cleanupOnTabDiscard: true,
      clearCache: false,
      clearLocalStorage: false,
      clearIndexedDB: false,
    });

    await import("@/entrypoints/background");

    for (const cb of listeners.onUpdated) {
      await cb(1, { discarded: true }, { url: "https://example.com/test" });
    }

    expect(performCleanup).toHaveBeenCalled();
  });

  it("should not cleanup on tab discard when disabled", async () => {
    const { performCleanup } = await import("@/utils/cleanup");

    mockStorageData.set("local:settings", {
      enableAutoCleanup: false,
      cleanupOnTabDiscard: false,
    });

    await import("@/entrypoints/background");

    for (const cb of listeners.onUpdated) {
      await cb(1, { discarded: true }, { url: "https://example.com/test" });
    }

    expect(performCleanup).not.toHaveBeenCalled();
  });

  it("should handle startup cleanup when enabled", async () => {
    const { performCleanup } = await import("@/utils/cleanup");

    mockStorageData.set("local:settings", {
      enableAutoCleanup: true,
      cleanupOnStartup: true,
      clearCache: false,
      clearLocalStorage: false,
      clearIndexedDB: false,
    });

    await import("@/entrypoints/background");

    for (const cb of listeners.onStartup) {
      await cb();
    }

    expect(performCleanup).toHaveBeenCalled();
  });

  it("should not cleanup on startup when disabled", async () => {
    const { performCleanup } = await import("@/utils/cleanup");

    mockStorageData.set("local:settings", {
      enableAutoCleanup: false,
      cleanupOnStartup: false,
    });

    await import("@/entrypoints/background");

    for (const cb of listeners.onStartup) {
      await cb();
    }

    expect(performCleanup).not.toHaveBeenCalled();
  });

  it("should handle scheduled cleanup with interval elapsed", async () => {
    const { performCleanupWithFilter } = await import("@/utils/cleanup");

    mockStorageData.set("local:settings", {
      scheduleInterval: "daily",
      lastScheduledCleanup: Date.now() - 25 * 60 * 60 * 1000,
      clearCache: true,
      clearLocalStorage: false,
      clearIndexedDB: false,
    });

    await import("@/entrypoints/background");

    for (const cb of listeners.onAlarm) {
      await cb({ name: "scheduled-cleanup" });
    }

    expect(performCleanupWithFilter).toHaveBeenCalled();
  });

  it("should not run scheduled cleanup when interval not elapsed", async () => {
    const { performCleanupWithFilter } = await import("@/utils/cleanup");

    mockStorageData.set("local:settings", {
      scheduleInterval: "daily",
      lastScheduledCleanup: Date.now() - 1 * 60 * 60 * 1000,
      clearCache: false,
      clearLocalStorage: false,
      clearIndexedDB: false,
    });

    await import("@/entrypoints/background");

    for (const cb of listeners.onAlarm) {
      await cb({ name: "scheduled-cleanup" });
    }

    expect(performCleanupWithFilter).not.toHaveBeenCalled();
  });

  it("should handle scheduled cleanup with no settings", async () => {
    const { performCleanupWithFilter } = await import("@/utils/cleanup");

    await import("@/entrypoints/background");

    for (const cb of listeners.onAlarm) {
      await cb({ name: "scheduled-cleanup" });
    }

    expect(performCleanupWithFilter).not.toHaveBeenCalled();
  });

  it("should handle tab discard with invalid URL", async () => {
    const { performCleanup } = await import("@/utils/cleanup");

    mockStorageData.set("local:settings", {
      enableAutoCleanup: true,
      cleanupOnTabDiscard: true,
      clearCache: false,
      clearLocalStorage: false,
      clearIndexedDB: false,
    });

    await import("@/entrypoints/background");

    for (const cb of listeners.onUpdated) {
      await cb(1, { discarded: true }, { url: "invalid-url" });
    }

    expect(performCleanup).not.toHaveBeenCalled();
  });

  it("should handle tab discard without URL", async () => {
    const { performCleanup } = await import("@/utils/cleanup");

    mockStorageData.set("local:settings", {
      enableAutoCleanup: true,
      cleanupOnTabDiscard: true,
      clearCache: false,
      clearLocalStorage: false,
      clearIndexedDB: false,
    });

    await import("@/entrypoints/background");

    for (const cb of listeners.onUpdated) {
      await cb(1, { discarded: true }, { url: undefined });
    }

    expect(performCleanup).not.toHaveBeenCalled();
  });

  it("should handle tab update without discarded flag", async () => {
    const { performCleanup } = await import("@/utils/cleanup");

    mockStorageData.set("local:settings", {
      enableAutoCleanup: true,
      cleanupOnTabDiscard: true,
      clearCache: false,
      clearLocalStorage: false,
      clearIndexedDB: false,
    });

    await import("@/entrypoints/background");

    for (const cb of listeners.onUpdated) {
      await cb(1, { loading: true }, { url: "https://example.com" });
    }

    expect(performCleanup).not.toHaveBeenCalled();
  });

  it("should handle startup cleanup with no active tab", async () => {
    await import("@/utils/cleanup");

    mockStorageData.set("local:settings", {
      enableAutoCleanup: true,
      cleanupOnStartup: true,
      clearCache: false,
      clearLocalStorage: false,
      clearIndexedDB: false,
    });

    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      Promise.resolve([])
    );
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      Promise.resolve([
        { id: 1, url: "https://example.com" },
        { id: 2, url: "https://test.com" },
      ])
    );

    await import("@/entrypoints/background");

    for (const cb of listeners.onStartup) {
      await cb();
    }
  });

  it("should handle startup cleanup with active tab having no URL", async () => {
    await import("@/utils/cleanup");

    mockStorageData.set("local:settings", {
      enableAutoCleanup: true,
      cleanupOnStartup: true,
      clearCache: false,
      clearLocalStorage: false,
      clearIndexedDB: false,
    });

    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      Promise.resolve([{ id: 1, active: true, url: undefined }])
    );
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      Promise.resolve([{ id: 2, url: "https://example.com" }])
    );

    await import("@/entrypoints/background");

    for (const cb of listeners.onStartup) {
      await cb();
    }
  });

  it("should handle startup cleanup with invalid URL in active tab", async () => {
    await import("@/utils/cleanup");

    mockStorageData.set("local:settings", {
      enableAutoCleanup: true,
      cleanupOnStartup: true,
      clearCache: false,
      clearLocalStorage: false,
      clearIndexedDB: false,
    });

    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      Promise.resolve([{ id: 1, active: true, url: "chrome://extensions" }])
    );

    await import("@/entrypoints/background");

    for (const cb of listeners.onStartup) {
      await cb();
    }
  });

  it("should handle startup cleanup with invalid URL in all tabs", async () => {
    await import("@/utils/cleanup");

    mockStorageData.set("local:settings", {
      enableAutoCleanup: true,
      cleanupOnStartup: true,
      clearCache: false,
      clearLocalStorage: false,
      clearIndexedDB: false,
    });

    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      Promise.resolve([{ id: 1, active: true, url: undefined }])
    );
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      Promise.resolve([
        { id: 2, url: "chrome://extensions" },
        { id: 3, url: "about:blank" },
      ])
    );

    await import("@/entrypoints/background");

    for (const cb of listeners.onStartup) {
      await cb();
    }
  });

  it("should handle alarm with different name", async () => {
    const { performCleanupWithFilter } = await import("@/utils/cleanup");

    mockStorageData.set("local:settings", {
      scheduleInterval: "hourly",
      lastScheduledCleanup: 0,
    });

    await import("@/entrypoints/background");

    for (const cb of listeners.onAlarm) {
      await cb({ name: "other-alarm" });
    }

    expect(performCleanupWithFilter).not.toHaveBeenCalled();
  });

  it("should handle onInstalled with existing whitelist and blacklist", async () => {
    mockStorageData.set("local:whitelist", ["a.com"]);
    mockStorageData.set("local:blacklist", ["b.com"]);
    mockStorageData.set("local:settings", { mode: "whitelist" });

    await import("@/entrypoints/background");

    for (const cb of listeners.onInstalled) {
      await cb();
    }

    expect(mockStorageData.get("local:whitelist")).toEqual(["a.com"]);
    expect(mockStorageData.get("local:blacklist")).toEqual(["b.com"]);
  });

  it("should handle cleanup error in scheduled cleanup", async () => {
    const { performCleanupWithFilter } = await import("@/utils/cleanup");
    (performCleanupWithFilter as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      Promise.reject(new Error("Cleanup failed"))
    );

    mockStorageData.set("local:settings", {
      scheduleInterval: "hourly",
      lastScheduledCleanup: 0,
      clearCache: false,
      clearLocalStorage: false,
      clearIndexedDB: false,
    });

    await import("@/entrypoints/background");

    for (const cb of listeners.onAlarm) {
      await cb({ name: "scheduled-cleanup" });
    }
  });

  it("should handle cleanup error in tab discard", async () => {
    const { performCleanup } = await import("@/utils/cleanup");
    (performCleanup as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      Promise.reject(new Error("Cleanup failed"))
    );

    mockStorageData.set("local:settings", {
      enableAutoCleanup: true,
      cleanupOnTabDiscard: true,
      clearCache: false,
      clearLocalStorage: false,
      clearIndexedDB: false,
    });

    await import("@/entrypoints/background");

    for (const cb of listeners.onUpdated) {
      await cb(1, { discarded: true }, { url: "https://example.com" });
    }
  });

  it("should handle cleanup error in startup cleanup", async () => {
    const { performCleanup } = await import("@/utils/cleanup");
    (performCleanup as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      Promise.reject(new Error("Cleanup failed"))
    );

    mockStorageData.set("local:settings", {
      enableAutoCleanup: true,
      cleanupOnStartup: true,
      clearCache: false,
      clearLocalStorage: false,
      clearIndexedDB: false,
    });

    await import("@/entrypoints/background");

    for (const cb of listeners.onStartup) {
      await cb();
    }
  });

  it("should handle tabs query error in startup cleanup", async () => {
    const { performCleanup } = await import("@/utils/cleanup");

    mockStorageData.set("local:settings", {
      enableAutoCleanup: true,
      cleanupOnStartup: true,
      clearCache: false,
      clearLocalStorage: false,
      clearIndexedDB: false,
    });

    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      Promise.reject(new Error("Query failed"))
    );

    await import("@/entrypoints/background");

    for (const cb of listeners.onStartup) {
      await cb();
    }

    expect(performCleanup).not.toHaveBeenCalled();
  });

  it("should handle settings without enableAutoCleanup", async () => {
    const { performCleanup } = await import("@/utils/cleanup");

    mockStorageData.set("local:settings", {
      cleanupOnTabDiscard: true,
    });

    await import("@/entrypoints/background");

    for (const cb of listeners.onUpdated) {
      await cb(1, { discarded: true }, { url: "https://example.com" });
    }

    expect(performCleanup).not.toHaveBeenCalled();
  });

  it("should handle settings without cleanupOnTabDiscard", async () => {
    const { performCleanup } = await import("@/utils/cleanup");

    mockStorageData.set("local:settings", {
      enableAutoCleanup: true,
    });

    await import("@/entrypoints/background");

    for (const cb of listeners.onUpdated) {
      await cb(1, { discarded: true }, { url: "https://example.com" });
    }

    expect(performCleanup).not.toHaveBeenCalled();
  });

  it("should handle settings without cleanupOnStartup", async () => {
    const { performCleanup } = await import("@/utils/cleanup");

    mockStorageData.set("local:settings", {
      enableAutoCleanup: true,
    });

    await import("@/entrypoints/background");

    for (const cb of listeners.onStartup) {
      await cb();
    }

    expect(performCleanup).not.toHaveBeenCalled();
  });

  it("should handle settings with null value", async () => {
    const { performCleanup } = await import("@/utils/cleanup");

    mockStorageData.set("local:settings", null);

    await import("@/entrypoints/background");

    for (const cb of listeners.onUpdated) {
      await cb(1, { discarded: true }, { url: "https://example.com" });
    }

    expect(performCleanup).not.toHaveBeenCalled();
  });

  it("should update lastScheduledCleanup after scheduled cleanup", async () => {
    await import("@/utils/cleanup");

    mockStorageData.set("local:settings", {
      scheduleInterval: "hourly",
      lastScheduledCleanup: 0,
      clearCache: false,
      clearLocalStorage: false,
      clearIndexedDB: false,
    });

    await import("@/entrypoints/background");

    for (const cb of listeners.onAlarm) {
      await cb({ name: "scheduled-cleanup" });
    }

    const settings = mockStorageData.get("local:settings") as { lastScheduledCleanup: number };
    expect(settings.lastScheduledCleanup).toBeGreaterThan(0);
  });

  it("should call checkScheduledCleanup on installed", async () => {
    const { performCleanupWithFilter } = await import("@/utils/cleanup");

    mockStorageData.set("local:settings", {
      scheduleInterval: "hourly",
      lastScheduledCleanup: 0,
      clearCache: false,
      clearLocalStorage: false,
      clearIndexedDB: false,
    });

    await import("@/entrypoints/background");

    for (const cb of listeners.onInstalled) {
      await cb();
    }

    expect(performCleanupWithFilter).toHaveBeenCalled();
  });
});
