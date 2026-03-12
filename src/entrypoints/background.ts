import { defineBackground } from "wxt/utils/define-background";
import {
  storage,
  WHITELIST_KEY,
  BLACKLIST_KEY,
  SETTINGS_KEY,
  DEFAULT_SETTINGS,
  SCHEDULE_INTERVAL_MAP,
  CLEANUP_ON_STARTUP_KEY,
} from "@/lib/store";
import type { Settings } from "@/types";
import { performCleanup, performCleanupWithFilter } from "@/utils/cleanup";
import { CookieClearType, ScheduleInterval } from "@/types";
import { ALARM_INTERVAL_MINUTES } from "@/lib/constants";

const tabUrlMap = new Map<number, string>();

const checkScheduledCleanup = async () => {
  try {
    const settings = await storage.getItem<Settings>(SETTINGS_KEY);
    if (!settings || settings.scheduleInterval === ScheduleInterval.DISABLED) {
      return;
    }

    const now = Date.now();
    const lastCleanup = settings.lastScheduledCleanup || 0;
    const interval = SCHEDULE_INTERVAL_MAP[settings.scheduleInterval];

    if (now - lastCleanup >= interval) {
      await performCleanupWithFilter(() => true, {
        clearType: CookieClearType.ALL,
        clearCache: settings.clearCache,
        clearLocalStorage: settings.clearLocalStorage,
        clearIndexedDB: settings.clearIndexedDB,
      });

      await storage.setItem(SETTINGS_KEY, {
        ...settings,
        lastScheduledCleanup: now,
      });
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
  const tabsToCleanup = Array.from(tabUrlMap.values());
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
  changeInfo: chrome.tabs.TabChangeInfo,
  settings: Settings
) => {
  if (!changeInfo.url) return;

  const previousUrl = tabUrlMap.get(tabId);
  tabUrlMap.set(tabId, changeInfo.url);

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
  changeInfo: chrome.tabs.TabChangeInfo,
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

const handleTabRemoved = async (tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => {
  const settings = await storage.getItem<Settings>(SETTINGS_KEY);
  if (!settings?.enableAutoCleanup) return;

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
};

const initializeTabUrlMap = async () => {
  if (!tabUrlMap.size) {
    try {
      const allTabs = await chrome.tabs.query({});
      for (const tab of allTabs) {
        if (tab.id && tab.url) {
          tabUrlMap.set(tab.id, tab.url);
        }
      }
    } catch (e) {
      console.error("Failed to initialize tab URL map:", e);
    }
  }
};

const handleStartup = async () => {
  await chrome.alarms.create("scheduled-cleanup", {
    periodInMinutes: ALARM_INTERVAL_MINUTES,
  });

  const settings = await storage.getItem<Settings>(SETTINGS_KEY);
  if (!settings?.enableAutoCleanup) return;

  await initializeTabUrlMap();

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

const initializeStorage = async () => {
  const whitelist = await storage.getItem(WHITELIST_KEY);
  const blacklist = await storage.getItem(BLACKLIST_KEY);
  const settings = await storage.getItem(SETTINGS_KEY);

  if (whitelist === undefined) {
    await storage.setItem(WHITELIST_KEY, []);
  }

  if (blacklist === undefined) {
    await storage.setItem(BLACKLIST_KEY, []);
  }

  if (settings === undefined) {
    await storage.setItem(SETTINGS_KEY, DEFAULT_SETTINGS);
  }
};

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(async () => {
    await initializeStorage();
    await chrome.alarms.create("scheduled-cleanup", {
      periodInMinutes: ALARM_INTERVAL_MINUTES,
    });
    await checkScheduledCleanup();
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
