import { TabUrlManager } from "./tab-url-manager";
import { StartupCleanupService } from "./startup-cleanup-service";
import { TabEventCleanupService } from "./tab-event-cleanup-service";
import { SettingsMigrator } from "./settings-migrator";

export class TabManagementService {
  private readonly tabUrlManager: TabUrlManager;
  private readonly startupCleanupService: StartupCleanupService;
  private readonly tabEventCleanupService: TabEventCleanupService;
  private readonly settingsMigrator: SettingsMigrator;

  constructor(
    tabUrlManager: TabUrlManager,
    startupCleanupService: StartupCleanupService,
    tabEventCleanupService: TabEventCleanupService,
    settingsMigrator: SettingsMigrator
  ) {
    this.tabUrlManager = tabUrlManager;
    this.startupCleanupService = startupCleanupService;
    this.tabEventCleanupService = tabEventCleanupService;
    this.settingsMigrator = settingsMigrator;
  }

  async handleTabUpdated(
    tabId: number,
    changeInfo: {
      url?: string;
      status?: string;
      pinned?: boolean;
      audible?: boolean;
      favIconUrl?: string;
      discarded?: boolean;
    },
    tab: chrome.tabs.Tab
  ): Promise<void> {
    const settings = await this.settingsMigrator.getSettings();
    if (!settings.enableAutoCleanup) return;

    if (changeInfo.discarded) {
      await this.tabEventCleanupService.handleTabDiscard(tab, settings);
    }

    if (changeInfo.url) {
      const previousUrl = this.tabUrlManager.get(tabId);
      this.tabUrlManager.set(tabId, changeInfo.url);
      await this.tabEventCleanupService.handleTabNavigate(tabId, changeInfo, previousUrl, settings);
    }

    if (tab.url && !this.tabUrlManager.has(tabId)) {
      this.tabUrlManager.set(tabId, tab.url);
    }
  }

  async handleTabRemoved(tabId: number, removeInfo: { isWindowClosing: boolean }): Promise<void> {
    try {
      const settings = await this.settingsMigrator.getSettings();
      if (!settings.enableAutoCleanup) return;

      if (this.tabUrlManager.size === 0) {
        await this.tabUrlManager.initializeFromTabs();
      }

      const closedUrl = this.tabUrlManager.get(tabId);
      if (!closedUrl) return;

      const url = new URL(closedUrl);

      if (removeInfo.isWindowClosing && settings.cleanupOnBrowserClose) {
        await this.startupCleanupService.saveDomainForCleanup(url.hostname);
      } else if (!removeInfo.isWindowClosing && settings.cleanupOnTabClose) {
        await this.tabEventCleanupService.cleanupClosedTab(url.hostname, settings);
      }
    } catch (e) {
      console.error("Failed to cleanup on tab close:", e);
    } finally {
      this.tabUrlManager.delete(tabId);
    }
  }

  getTabUrlManager(): TabUrlManager {
    return this.tabUrlManager;
  }
}
