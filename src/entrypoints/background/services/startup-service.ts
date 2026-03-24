import type { Settings } from "@/types";
import { ALARM_INTERVAL_MINUTES } from "@/lib/constants";
import { TabUrlManager } from "./tab-url-manager";
import { ScheduledCleanupService } from "./scheduled-cleanup-service";
import { StartupCleanupService } from "./startup-cleanup-service";
import { ExpiredCookieService } from "./expired-cookie-service";
import { StorageInitializer } from "./storage-initializer";
import { SettingsMigrator } from "./settings-migrator";

export class StartupService {
  private readonly tabUrlManager: TabUrlManager;
  private readonly scheduledCleanupService: ScheduledCleanupService;
  private readonly startupCleanupService: StartupCleanupService;
  private readonly expiredCookieService: ExpiredCookieService;
  private readonly storageInitializer: StorageInitializer;
  private readonly settingsMigrator: SettingsMigrator;

  constructor(
    tabUrlManager: TabUrlManager,
    scheduledCleanupService: ScheduledCleanupService,
    startupCleanupService: StartupCleanupService,
    expiredCookieService: ExpiredCookieService,
    storageInitializer: StorageInitializer,
    settingsMigrator: SettingsMigrator
  ) {
    this.tabUrlManager = tabUrlManager;
    this.scheduledCleanupService = scheduledCleanupService;
    this.startupCleanupService = startupCleanupService;
    this.expiredCookieService = expiredCookieService;
    this.storageInitializer = storageInitializer;
    this.settingsMigrator = settingsMigrator;
  }

  async handleInstalled(): Promise<void> {
    await this.storageInitializer.initialize();
    await this.tabUrlManager.initializeFromTabs();
    await chrome.alarms.create("scheduled-cleanup", {
      periodInMinutes: ALARM_INTERVAL_MINUTES,
    });
    await this.scheduledCleanupService.runScheduledCleanup();
  }

  async handleStartup(): Promise<void> {
    await chrome.alarms.create("scheduled-cleanup", {
      periodInMinutes: ALARM_INTERVAL_MINUTES,
    });

    const settings = await this.settingsMigrator.getSettings();

    await this.tabUrlManager.initializeFromTabs();
    await this.startupCleanupService.runStartupTasks(settings, this.tabUrlManager.getUrls());
    await this.expiredCookieService.runExpiredCookiesCleanup(settings, false);
  }

  async handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
    if (alarm.name === "scheduled-cleanup") {
      const settings = await this.settingsMigrator.getSettings();

      await this.scheduledCleanupService.runScheduledCleanup();
      await this.expiredCookieService.runExpiredCookiesCleanup(settings, true, Date.now());
    }
  }

  async handleSettingsChange(
    newSettings: Settings | null,
    oldSettings: Settings | null
  ): Promise<void> {
    if (newSettings?.enableAutoCleanup && !oldSettings?.enableAutoCleanup) {
      await this.tabUrlManager.initializeFromTabs();
    }
  }
}
