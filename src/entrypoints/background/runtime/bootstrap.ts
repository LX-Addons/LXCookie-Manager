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
import { SettingsMigrator } from "../services/settings-migrator";
import { handleMessage, createErrorResponse } from "../services/message-router";
import { storage, SETTINGS_KEY } from "@/lib/store";

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
    this.settingsMigrator = new SettingsMigrator();
    this.tabManagementService = new TabManagementService(
      this.tabUrlManager,
      this.startupCleanupService,
      this.tabEventCleanupService
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
    chrome.runtime.onInstalled.addListener(() => this.startupService.handleInstalled());
  }

  private setupTabUpdateListener(): void {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) =>
      this.tabManagementService.handleTabUpdated(tabId, changeInfo, tab)
    );
  }

  private setupTabRemovedListener(): void {
    chrome.tabs.onRemoved.addListener((tabId, removeInfo) =>
      this.tabManagementService.handleTabRemoved(tabId, removeInfo)
    );
  }

  private setupStartupListener(): void {
    chrome.runtime.onStartup.addListener(() => this.startupService.handleStartup());
  }

  private setupAlarmListener(): void {
    chrome.alarms.onAlarm.addListener((alarm) => this.startupService.handleAlarm(alarm));
  }

  private setupSettingsWatcher(): void {
    storage.watch<Settings>(SETTINGS_KEY, (newSettings, oldSettings) =>
      this.startupService.handleSettingsChange(newSettings, oldSettings)
    );
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
  }
}
