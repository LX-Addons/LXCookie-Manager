import type { Settings } from "@/types";
import { storage, CLEANUP_ON_STARTUP_KEY } from "@/lib/store";
import { cleanupExecutor } from "./cleanup-executor";
import { getGlobalCleanupQueue } from "@/lib/distributed-lock";
import { isValidHttpUrl } from "@/utils/domain";
import { getCleanupOptionsFromSettings } from "@/utils/cleanup/cleanup-options";

export class StartupCleanupService {
  private saveQueue = Promise.resolve();

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

    const queue = getGlobalCleanupQueue();
    await queue.enqueue(async () => {
      await this.cleanupDomainsOnStartupInternal(settings, domainsToClean);
    }, "startup");
  }

  private async cleanupDomainsOnStartupInternal(
    settings: Settings,
    domainsToClean: string[]
  ): Promise<void> {
    const snapshot = domainsToClean;

    try {
      await storage.removeItem(CLEANUP_ON_STARTUP_KEY);
    } catch (e) {
      console.warn("Failed to atomically clear cleanup queue, continuing with snapshot:", e);
    }

    const failedDomains: string[] = [];

    for (const domain of snapshot) {
      try {
        const trigger = "browser-close-recovery" as const;
        const result = await cleanupExecutor.executeByDomain(
          domain,
          trigger,
          settings,
          getCleanupOptionsFromSettings(settings)
        );
        if (!result.success || !result.data?.success) {
          failedDomains.push(domain);
        }
      } catch (e) {
        console.error(`Failed to cleanup domain ${domain}:`, e);
        failedDomains.push(domain);
      }
    }

    if (failedDomains.length > 0) {
      await storage.setItem(CLEANUP_ON_STARTUP_KEY, failedDomains);
    }
  }

  async cleanupOpenTabsOnStartup(settings: Settings, tabUrls: string[]): Promise<void> {
    if (tabUrls.length === 0) return;

    const queue = getGlobalCleanupQueue();
    await queue.enqueue(async () => {
      await this.cleanupOpenTabsOnStartupInternal(settings, tabUrls);
    }, "startup");
  }

  private async cleanupOpenTabsOnStartupInternal(
    settings: Settings,
    tabUrls: string[]
  ): Promise<void> {
    for (const url of tabUrls) {
      if (!isValidHttpUrl(url)) {
        console.debug(`[StartupCleanup] Skipping non-HTTP URL: ${url}`);
        continue;
      }

      try {
        const parsedUrl = new URL(url);
        const trigger = "startup" as const;
        await cleanupExecutor.executeByDomain(
          parsedUrl.hostname,
          trigger,
          settings,
          getCleanupOptionsFromSettings(settings)
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
