import type { Settings } from "@/types";
import { ErrorCode } from "@/types";
import { TabUrlManager } from "../services/tab-url-manager";
import { ScheduledCleanupService } from "../services/scheduled-cleanup-service";
import { StartupCleanupService } from "../services/startup-cleanup-service";
import { TabEventCleanupService } from "../services/tab-event-cleanup-service";
import { ExpiredCookieService } from "../services/expired-cookie-service";
import { StorageInitializer } from "../services/storage-initializer";
import { TabManagementService } from "../services/tab-management-service";
import { StartupService } from "../services/startup-service";
import { SettingsMigrator, settingsMigratorSingleton } from "../services/settings-migrator";
import { handleMessage, createErrorResponse } from "../services/message-router";
import { storage, SETTINGS_KEY } from "@/lib/store";
import { setupCookieChangeListener } from "../listeners/cookie-listener";

export class BackgroundBootstrap {
  private readonly tabUrlManager: TabUrlManager;
  private readonly scheduledCleanupService: ScheduledCleanupService;
  private readonly startupCleanupService: StartupCleanupService;
  private readonly tabEventCleanupService: TabEventCleanupService;
  private readonly expiredCookieService: ExpiredCookieService;
  private readonly storageInitializer: StorageInitializer;
  private readonly tabManagementService: TabManagementService;
  private readonly settingsMigrator: SettingsMigrator;
  private readonly startupService: StartupService;

  constructor() {
    this.tabUrlManager = new TabUrlManager();
    this.scheduledCleanupService = new ScheduledCleanupService();
    this.startupCleanupService = new StartupCleanupService();
    this.tabEventCleanupService = new TabEventCleanupService();
    this.expiredCookieService = new ExpiredCookieService();
    this.storageInitializer = new StorageInitializer();
    this.settingsMigrator = settingsMigratorSingleton;
    this.tabManagementService = new TabManagementService(
      this.tabUrlManager,
      this.startupCleanupService,
      this.tabEventCleanupService,
      this.settingsMigrator
    );
    this.startupService = new StartupService(
      this.tabUrlManager,
      this.scheduledCleanupService,
      this.startupCleanupService,
      this.expiredCookieService,
      this.storageInitializer,
      this.settingsMigrator
    );
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((request: unknown, _sender, sendResponse) => {
      (async () => {
        try {
          const response = await handleMessage(request);
          sendResponse(response);
        } catch (error) {
          console.error("Error handling background message:", error);
          sendResponse(
            createErrorResponse(
              ErrorCode.INTERNAL_ERROR,
              (error as Error).message || "Internal error"
            )
          );
        }
      })();

      return true;
    });
  }

  private setupInstalledListener(): void {
    chrome.runtime.onInstalled.addListener(() => {
      (async () => {
        try {
          await this.startupService.handleInstalled();
        } catch (error) {
          console.error("Error in onInstalled:", error);
        }
      })();
    });
  }

  private setupTabUpdateListener(): void {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      (async () => {
        try {
          await this.tabManagementService.handleTabUpdated(tabId, changeInfo, tab);
        } catch (error) {
          console.error("Error in tabs.onUpdated:", error);
        }
      })();
    });
  }

  private setupTabRemovedListener(): void {
    chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
      (async () => {
        try {
          await this.tabManagementService.handleTabRemoved(tabId, removeInfo);
        } catch (error) {
          console.error("Error in tabs.onRemoved:", error);
        }
      })();
    });
  }

  private setupStartupListener(): void {
    chrome.runtime.onStartup.addListener(() => {
      (async () => {
        try {
          await this.startupService.handleStartup();
        } catch (error) {
          console.error("Error in onStartup:", error);
        }
      })();
    });
  }

  private setupAlarmListener(): void {
    chrome.alarms.onAlarm.addListener((alarm) => {
      (async () => {
        try {
          await this.startupService.handleAlarm(alarm);
        } catch (error) {
          console.error("Error in alarms.onAlarm:", error);
        }
      })();
    });
  }

  private setupSettingsWatcher(): void {
    storage.watch<Settings>(SETTINGS_KEY, (newSettings, oldSettings) => {
      (async () => {
        try {
          await this.startupService.handleSettingsChange(newSettings, oldSettings);
        } catch (error) {
          console.error("Error in settings watcher:", error);
        }
      })();
    });
  }

  private setupCookieChangeListener(): void {
    setupCookieChangeListener();
  }

  public initialize(): void {
    this.tabUrlManager.initializeFromTabs();
    this.setupMessageListener();
    this.setupInstalledListener();
    this.setupTabUpdateListener();
    this.setupTabRemovedListener();
    this.setupStartupListener();
    this.setupAlarmListener();
    this.setupSettingsWatcher();
    this.setupCookieChangeListener();
  }
}
