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

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    const settings = await storage.getItem<Settings>(SETTINGS_KEY);
    if (!settings?.enableAutoCleanup || !settings?.cleanupOnTabDiscard) return;

    if (changeInfo.discarded && tab.url) {
      try {
        const url = new URL(tab.url);
        await performCleanup({
          domain: url.hostname,
          clearCache: settings.clearCache,
          clearLocalStorage: settings.clearLocalStorage,
          clearIndexedDB: settings.clearIndexedDB,
        });
      } catch (e) {
        console.error("Failed to cleanup on tab discard:", e);
      }
    }
  });

  chrome.runtime.onStartup.addListener(async () => {
    await chrome.alarms.create("scheduled-cleanup", {
      periodInMinutes: ALARM_INTERVAL_MINUTES,
    });

    const settings = await storage.getItem<Settings>(SETTINGS_KEY);
    if (!settings?.enableAutoCleanup || !settings?.cleanupOnStartup) return;

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (activeTab?.url) {
        try {
          const url = new URL(activeTab.url);
          await performCleanup({
            domain: url.hostname,
            clearCache: settings.clearCache,
            clearLocalStorage: settings.clearLocalStorage,
            clearIndexedDB: settings.clearIndexedDB,
          });
        } catch (e) {
          console.error("Failed to cleanup active tab on startup:", e);
        }
      } else {
        const allTabs = await chrome.tabs.query({});
        for (const tab of allTabs) {
          if (tab?.url) {
            try {
              const url = new URL(tab.url);
              await performCleanup({
                domain: url.hostname,
                clearCache: settings.clearCache,
                clearLocalStorage: settings.clearLocalStorage,
                clearIndexedDB: settings.clearIndexedDB,
              });
            } catch (e) {
              console.error(`Failed to cleanup tab ${tab.id} on startup:`, e);
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to cleanup on startup:", e);
    }
  });

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "scheduled-cleanup") {
      await checkScheduledCleanup();
    }
  });
});
