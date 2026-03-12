import { defineBackground } from "wxt/utils/define-background";
import {
  storage,
  WHITELIST_KEY,
  BLACKLIST_KEY,
  SETTINGS_KEY,
  DEFAULT_SETTINGS,
  SCHEDULE_INTERVAL_MAP,
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
  clearCache: settings.clearCache,
  clearLocalStorage: settings.clearLocalStorage,
  clearIndexedDB: settings.clearIndexedDB,
});

const cleanupDomain = async (domain: string, settings: Settings) => {
  try {
    await performCleanup({
      domain,
      ...getCleanupOptions(settings),
    });
  } catch (e) {
    console.error(`Failed to cleanup domain ${domain}:`, e);
  }
};

const cleanupDomainsOnStartup = async (settings: Settings) => {
  const domainsToClean = await storage.getItem<string[]>("local:cleanupOnStartup");
  if (!domainsToClean || domainsToClean.length === 0) return;

  for (const domain of domainsToClean) {
    await cleanupDomain(domain, settings);
  }

  await storage.setItem("local:cleanupOnStartup", []);
};

const cleanupTab = async (tab: { url?: string; id?: number }, settings: Settings) => {
  if (!tab.url) return;

  try {
    const url = new URL(tab.url);
    await performCleanup({
      domain: url.hostname,
      ...getCleanupOptions(settings),
    });
  } catch (e) {
    console.error(`Failed to cleanup tab ${tab.id}:`, e);
  }
};

const cleanupOpenTabsOnStartup = async (settings: Settings) => {
  const allTabs = await chrome.tabs.query({});
  for (const tab of allTabs) {
    await cleanupTab(tab, settings);
  }
};

const handleTabUpdated = async (
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
) => {
  const settings = await storage.getItem<Settings>(SETTINGS_KEY);
  if (!settings?.enableAutoCleanup) return;

  if (settings.cleanupOnTabDiscard && changeInfo.discarded && tab.url) {
    try {
      const url = new URL(tab.url);
      await performCleanup({
        domain: url.hostname,
        ...getCleanupOptions(settings),
      });
    } catch (e) {
      console.error("Failed to cleanup on tab discard:", e);
    }
  }

  if (settings.cleanupOnNavigate && changeInfo.url && tab.url) {
    const previousUrl = tabUrlMap.get(tabId);
    if (previousUrl && previousUrl !== changeInfo.url) {
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
    }
    tabUrlMap.set(tabId, changeInfo.url);
  }

  if (tab.url && !tabUrlMap.has(tabId)) {
    tabUrlMap.set(tabId, tab.url);
  }
};

const handleTabRemoved = async (tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => {
  const settings = await storage.getItem<Settings>(SETTINGS_KEY);
  if (!settings?.enableAutoCleanup) return;

  const closedUrl = tabUrlMap.get(tabId);
  if (!closedUrl) return;

  try {
    const url = new URL(closedUrl);

    if (removeInfo.isWindowClosing) {
      if (settings.cleanupOnBrowserClose) {
        const domainsToClean = (await storage.getItem<string[]>("local:cleanupOnStartup")) || [];
        domainsToClean.push(url.hostname);
        await storage.setItem("local:cleanupOnStartup", Array.from(new Set(domainsToClean)));
      }
    } else {
      if (settings.cleanupOnTabClose) {
        await performCleanup({
          domain: url.hostname,
          ...getCleanupOptions(settings),
        });
      }
    }
  } catch (e) {
    console.error("Failed to cleanup on tab close:", e);
  }

  tabUrlMap.delete(tabId);
};

const handleStartup = async () => {
  await chrome.alarms.create("scheduled-cleanup", {
    periodInMinutes: ALARM_INTERVAL_MINUTES,
  });

  const settings = await storage.getItem<Settings>(SETTINGS_KEY);
  if (!settings?.enableAutoCleanup) return;

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

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(async () => {
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
