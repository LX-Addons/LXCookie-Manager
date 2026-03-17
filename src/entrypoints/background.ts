import {
  storage,
  WHITELIST_KEY,
  BLACKLIST_KEY,
  SETTINGS_KEY,
  DEFAULT_SETTINGS,
  SCHEDULE_INTERVAL_MAP,
  CLEANUP_ON_STARTUP_KEY,
  TAB_URL_MAP_KEY,
} from "@/lib/store";
import type { Settings } from "@/types";
import { performCleanup, performCleanupWithFilter, cleanupExpiredCookies } from "@/utils/cleanup";
import { ScheduleInterval } from "@/types";
import { ALARM_INTERVAL_MINUTES } from "@/lib/constants";

export default defineBackground(() => {
  // 内存中的 tabUrlMap，用于快速访问
  let tabUrlMap = new Map<number, string>();

  // 串行化写入队列，避免并发覆盖
  let tabUrlMapSaveQueue = Promise.resolve();

  // 从持久化存储加载 tabUrlMap
  const loadTabUrlMap = async (): Promise<Map<number, string>> => {
    try {
      const stored = await storage.getItem<Record<string, string>>(TAB_URL_MAP_KEY);
      if (stored) {
        return new Map(Object.entries(stored).map(([k, v]) => [Number.parseInt(k, 10), v]));
      }
    } catch (e) {
      console.error("Failed to load tabUrlMap from storage:", e);
    }
    return new Map();
  };

  // 保存 tabUrlMap 到持久化存储（串行化写入，避免乱序覆盖）
  const saveTabUrlMap = async (map: Map<number, string>) => {
    const snapshot = Object.fromEntries(
      Array.from(map.entries()).map(([k, v]) => [k.toString(), v])
    );

    tabUrlMapSaveQueue = tabUrlMapSaveQueue.then(async () => {
      try {
        await storage.setItem(TAB_URL_MAP_KEY, snapshot);
      } catch (e) {
        console.error("Failed to save tabUrlMap to storage:", e);
      }
    });

    return tabUrlMapSaveQueue;
  };

  // 初始化 tabUrlMap（从存储加载并同步当前标签页）
  const initTabUrlMap = async () => {
    const stored = await loadTabUrlMap();
    const current = await initializeTabUrlMapFromTabs();
    // 合并存储的和当前的，以当前的为准
    tabUrlMap = new Map([...stored, ...current]);
    await saveTabUrlMap(tabUrlMap);
  };

  const shouldPerformCleanup = (settings: Settings, now: number): boolean => {
    if (settings.scheduleInterval === ScheduleInterval.DISABLED) return false;
    const lastCleanup = settings.lastScheduledCleanup || 0;
    const interval = SCHEDULE_INTERVAL_MAP[settings.scheduleInterval];
    return now - lastCleanup >= interval;
  };

  const handleExpiredCookiesCleanup = async (settings: Settings, now: number) => {
    if (!settings.cleanupExpiredCookies) return;
    if (!shouldPerformCleanup(settings, now)) return;

    try {
      const count = await cleanupExpiredCookies();
      if (count > 0) {
        console.log(`Cleaned up ${count} expired cookies on scheduled cleanup`);
      }
    } catch (e) {
      console.error("Failed to cleanup expired cookies on scheduled cleanup:", e);
    }
  };

  const updateLastScheduledCleanup = async (timestamp: number) => {
    const latestSettings = await storage.getItem<Settings>(SETTINGS_KEY);
    if (latestSettings) {
      await storage.setItem(SETTINGS_KEY, {
        ...latestSettings,
        lastScheduledCleanup: timestamp,
      });
    }
  };

  const checkScheduledCleanup = async () => {
    try {
      const settings = await storage.getItem<Settings>(SETTINGS_KEY);
      if (!settings?.enableAutoCleanup) return;

      const now = Date.now();
      let lastScheduledCleanup: number | undefined;

      if (shouldPerformCleanup(settings, now)) {
        await performCleanupWithFilter(() => true, getCleanupOptions(settings));
        lastScheduledCleanup = now;
      }

      await handleExpiredCookiesCleanup(settings, now);

      if (lastScheduledCleanup !== undefined) {
        await updateLastScheduledCleanup(lastScheduledCleanup);
      }
    } catch (e) {
      console.error("Failed to perform scheduled cleanup:", e);
    }
  };

  const getCleanupOptions = (settings: Settings) => ({
    clearType: settings.clearType,
    clearCache: settings.clearCache,
    clearLocalStorage: settings.clearLocalStorage,
    clearIndexedDB: settings.clearIndexedDB,
  });

  const cleanupDomain = async (domain: string, settings: Settings): Promise<boolean> => {
    try {
      await performCleanup({
        domain,
        ...getCleanupOptions(settings),
      });
      return true;
    } catch (e) {
      console.error(`Failed to cleanup domain ${domain}:`, e);
      return false;
    }
  };

  const cleanupDomainsOnStartup = async (settings: Settings) => {
    const domainsToClean = await storage.getItem<string[]>(CLEANUP_ON_STARTUP_KEY);
    if (!domainsToClean || domainsToClean.length === 0) return;

    const failedDomains: string[] = [];

    for (const domain of domainsToClean) {
      const success = await cleanupDomain(domain, settings);
      if (!success) {
        failedDomains.push(domain);
      }
    }

    await storage.setItem(CLEANUP_ON_STARTUP_KEY, failedDomains);
  };

  const cleanupOpenTabsOnStartup = async (settings: Settings) => {
    // 从持久化存储加载 tabUrlMap
    const storedMap = await loadTabUrlMap();
    const tabsToCleanup = Array.from(storedMap.values());
    if (tabsToCleanup.length === 0) return;

    for (const url of tabsToCleanup) {
      try {
        const parsedUrl = new URL(url);
        await performCleanup({
          domain: parsedUrl.hostname,
          ...getCleanupOptions(settings),
        });
      } catch (e) {
        console.error(`Failed to cleanup tab ${url}:`, e);
      }
    }
  };

  const handleTabDiscard = async (tab: chrome.tabs.Tab, settings: Settings) => {
    if (!settings.cleanupOnTabDiscard || !tab.url) return;

    try {
      const url = new URL(tab.url);
      await performCleanup({
        domain: url.hostname,
        ...getCleanupOptions(settings),
      });
    } catch (e) {
      console.error("Failed to cleanup on tab discard:", e);
    }
  };

  const handleTabNavigate = async (
    tabId: number,
    changeInfo: { url?: string },
    settings: Settings
  ) => {
    if (!changeInfo.url) return;

    const previousUrl = tabUrlMap.get(tabId);
    tabUrlMap.set(tabId, changeInfo.url);
    await saveTabUrlMap(tabUrlMap);

    if (!settings.cleanupOnNavigate || !previousUrl || previousUrl === changeInfo.url) {
      return;
    }

    try {
      const previousHostname = new URL(previousUrl).hostname;
      const currentHostname = new URL(changeInfo.url).hostname;

      if (previousHostname !== currentHostname) {
        await performCleanup({
          domain: previousHostname,
          ...getCleanupOptions(settings),
        });
      }
    } catch (e) {
      console.error("Failed to cleanup on navigation:", e);
    }
  };

  const handleTabUpdated = async (
    tabId: number,
    changeInfo: { url?: string; discarded?: boolean },
    tab: chrome.tabs.Tab
  ) => {
    const settings = await storage.getItem<Settings>(SETTINGS_KEY);
    if (!settings?.enableAutoCleanup) return;

    if (changeInfo.discarded) {
      await handleTabDiscard(tab, settings);
    }

    if (changeInfo.url) {
      await handleTabNavigate(tabId, changeInfo, settings);
    }

    if (tab.url && !tabUrlMap.has(tabId)) {
      tabUrlMap.set(tabId, tab.url);
      await saveTabUrlMap(tabUrlMap);
    }
  };

  let saveQueue = Promise.resolve();

  const saveDomainForCleanup = async (hostname: string) => {
    saveQueue = saveQueue.then(async () => {
      try {
        const domainsToClean = (await storage.getItem<string[]>(CLEANUP_ON_STARTUP_KEY)) || [];
        domainsToClean.push(hostname);
        await storage.setItem(CLEANUP_ON_STARTUP_KEY, Array.from(new Set(domainsToClean)));
      } catch (e) {
        console.error(`Failed to save domain ${hostname} for cleanup:`, e);
      }
    });

    return saveQueue;
  };

  const cleanupClosedTab = async (hostname: string, settings: Settings) => {
    await performCleanup({
      domain: hostname,
      ...getCleanupOptions(settings),
    });
  };

  const handleTabRemoved = async (tabId: number, removeInfo: { isWindowClosing?: boolean }) => {
    const settings = await storage.getItem<Settings>(SETTINGS_KEY);
    if (!settings?.enableAutoCleanup) return;

    // 确保 tabUrlMap 已初始化，从持久化存储加载
    if (!tabUrlMap.size) {
      await initializeTabUrlMap();
    }

    const closedUrl = tabUrlMap.get(tabId);
    if (!closedUrl) return;

    try {
      const url = new URL(closedUrl);

      if (removeInfo.isWindowClosing && settings.cleanupOnBrowserClose) {
        await saveDomainForCleanup(url.hostname);
      } else if (!removeInfo.isWindowClosing && settings.cleanupOnTabClose) {
        await cleanupClosedTab(url.hostname, settings);
      }
    } catch (e) {
      console.error("Failed to cleanup on tab close:", e);
    }

    tabUrlMap.delete(tabId);
    await saveTabUrlMap(tabUrlMap);
  };

  const initializeTabUrlMapFromTabs = async (): Promise<Map<number, string>> => {
    const map = new Map<number, string>();
    try {
      const allTabs = await chrome.tabs.query({});
      for (const tab of allTabs) {
        if (tab.id && tab.url) {
          map.set(tab.id, tab.url);
        }
      }
    } catch (e) {
      console.error("Failed to initialize tab URL map from tabs:", e);
    }
    return map;
  };

  // 兼容旧代码的初始化函数
  const initializeTabUrlMap = async () => {
    if (!tabUrlMap.size) {
      await initTabUrlMap();
    }
  };

  const runAutoCleanupTasks = async (settings: Settings) => {
    if (!settings.enableAutoCleanup) return;

    if (settings.cleanupOnBrowserClose) {
      try {
        await cleanupDomainsOnStartup(settings);
      } catch (e) {
        console.error("Failed to cleanup on browser close startup:", e);
      }
    }

    if (settings.cleanupOnStartup) {
      try {
        await cleanupOpenTabsOnStartup(settings);
      } catch (e) {
        console.error("Failed to cleanup on startup:", e);
      }
    }
  };

  const runExpiredCookiesCleanup = async (settings: Settings) => {
    if (!settings.enableAutoCleanup || !settings.cleanupExpiredCookies) return;

    try {
      const count = await cleanupExpiredCookies();
      if (count > 0) {
        console.log(`Cleaned up ${count} expired cookies on startup`);
      }
    } catch (e) {
      console.error("Failed to cleanup expired cookies on startup:", e);
    }
  };

  const handleStartup = async () => {
    await chrome.alarms.create("scheduled-cleanup", {
      periodInMinutes: ALARM_INTERVAL_MINUTES,
    });

    const settings = await storage.getItem<Settings>(SETTINGS_KEY);
    if (!settings) return;

    await initializeTabUrlMap();
    await runAutoCleanupTasks(settings);
    await runExpiredCookiesCleanup(settings);
  };

  const initializeStorage = async () => {
    const whitelist = await storage.getItem(WHITELIST_KEY);
    const blacklist = await storage.getItem(BLACKLIST_KEY);
    const settings = await storage.getItem(SETTINGS_KEY);

    if (whitelist == null) {
      await storage.setItem(WHITELIST_KEY, []);
    }

    if (blacklist == null) {
      await storage.setItem(BLACKLIST_KEY, []);
    }

    if (settings == null) {
      await storage.setItem(SETTINGS_KEY, DEFAULT_SETTINGS);
    }
  };

  chrome.runtime.onInstalled.addListener(async () => {
    await initializeStorage();
    // 初始化 tabUrlMap，确保扩展安装/更新后能正确捕获已打开的标签页
    await initializeTabUrlMap();
    await chrome.alarms.create("scheduled-cleanup", {
      periodInMinutes: ALARM_INTERVAL_MINUTES,
    });
    await checkScheduledCleanup();
  });

  // 监听设置变化，当启用自动清理时初始化 tabUrlMap
  storage.watch<Settings>(SETTINGS_KEY, async (newSettings, oldSettings) => {
    if (newSettings?.enableAutoCleanup && !oldSettings?.enableAutoCleanup) {
      await initializeTabUrlMap();
    }
  });

  chrome.tabs.onUpdated.addListener(handleTabUpdated);
  chrome.tabs.onRemoved.addListener(handleTabRemoved);
  chrome.runtime.onStartup.addListener(handleStartup);

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "scheduled-cleanup") {
      await checkScheduledCleanup();
    }
  });
});
