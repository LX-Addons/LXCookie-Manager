import type { Settings } from "@/types";
import { storage, CLEANUP_ON_STARTUP_KEY } from "@/lib/store";
import { cleanupExecutor, type CleanupOptions } from "./cleanup-executor";

export class StartupCleanupService {
  private saveQueue = Promise.resolve();

  private getCleanupOptions(settings: Settings): CleanupOptions {
    return {
      clearType: settings.clearType,
      clearCache: settings.clearCache,
      clearLocalStorage: settings.clearLocalStorage,
      clearIndexedDB: settings.clearIndexedDB,
    };
  }

  async saveDomainForCleanup(hostname: string): Promise<void> {
    this.saveQueue = this.saveQueue.then(async () => {
      try {
        const domainsToClean = (await storage.getItem<string[]>(CLEANUP_ON_STARTUP_KEY)) || [];
        domainsToClean.push(hostname);
        await storage.setItem(CLEANUP_ON_STARTUP_KEY, Array.from(new Set(domainsToClean)));
      } catch (e) {
        console.error(`Failed to save domain ${hostname} for cleanup:`, e);
      }
    });

    return this.saveQueue;
  }

  async cleanupDomainsOnStartup(settings: Settings): Promise<void> {
    const domainsToClean = await storage.getItem<string[]>(CLEANUP_ON_STARTUP_KEY);
    if (!domainsToClean || domainsToClean.length === 0) return;

    const failedDomains: string[] = [];

    for (const domain of domainsToClean) {
      try {
        const trigger = "browser-close-recovery" as const;
        const result = await cleanupExecutor.executeByDomain(
          domain,
          trigger,
          settings,
          this.getCleanupOptions(settings)
        );
        if (!result.success || !result.data?.success) {
          failedDomains.push(domain);
        }
      } catch (e) {
        console.error(`Failed to cleanup domain ${domain}:`, e);
        failedDomains.push(domain);
      }
    }

    await storage.setItem(CLEANUP_ON_STARTUP_KEY, failedDomains);
  }

  async cleanupOpenTabsOnStartup(settings: Settings, tabUrls: string[]): Promise<void> {
    if (tabUrls.length === 0) return;

    for (const url of tabUrls) {
      try {
        const parsedUrl = new URL(url);
        const trigger = "startup" as const;
        await cleanupExecutor.executeByDomain(
          parsedUrl.hostname,
          trigger,
          settings,
          this.getCleanupOptions(settings)
        );
      } catch (e) {
        console.error(`Failed to cleanup tab ${url}:`, e);
      }
    }
  }

  async runStartupTasks(settings: Settings, tabUrls: string[]): Promise<void> {
    if (!settings.enableAutoCleanup) return;

    if (settings.cleanupOnBrowserClose) {
      try {
        await this.cleanupDomainsOnStartup(settings);
      } catch (e) {
        console.error("Failed to cleanup on browser close startup:", e);
      }
    }

    if (settings.cleanupOnStartup) {
      try {
        await this.cleanupOpenTabsOnStartup(settings, tabUrls);
      } catch (e) {
        console.error("Failed to cleanup on startup:", e);
      }
    }
  }
}
