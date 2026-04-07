import type { Settings } from "@/types";
import { cleanupExecutor } from "./cleanup-executor";
import { getGlobalCleanupQueue } from "@/lib/distributed-lock";
import { isValidHttpUrl } from "@/utils/domain";
import { getCleanupOptionsFromSettings } from "@/utils/cleanup/cleanup-options";

export class TabEventCleanupService {
  async handleTabDiscard(tab: chrome.tabs.Tab, settings: Settings): Promise<void> {
    if (!settings.cleanupOnTabDiscard || !tab.url) return;

    try {
      if (!isValidHttpUrl(tab.url)) return;

      const queue = getGlobalCleanupQueue();
      const url = new URL(tab.url);
      await queue.enqueue(async () => {
        const trigger = "tab-discard" as const;
        await cleanupExecutor.executeByDomain(
          url.hostname,
          trigger,
          settings,
          getCleanupOptionsFromSettings(settings)
        );
      }, "tab-discard");
    } catch (e) {
      console.error(`Failed to cleanup on tab discard for ${tab.url}:`, e);
    }
  }

  async handleTabNavigate(
    _tabId: number,
    changeInfo: { url?: string },
    previousUrl: string | undefined,
    settings: Settings
  ): Promise<void> {
    if (!changeInfo.url) return;

    if (!settings.cleanupOnNavigate || !previousUrl || previousUrl === changeInfo.url) {
      return;
    }

    try {
      if (!isValidHttpUrl(previousUrl) || !isValidHttpUrl(changeInfo.url)) return;

      const previous = new URL(previousUrl);
      const current = new URL(changeInfo.url);

      if (previous.hostname !== current.hostname) {
        const queue = getGlobalCleanupQueue();
        await queue.enqueue(async () => {
          const trigger = "navigate" as const;
          await cleanupExecutor.executeByDomain(
            previous.hostname,
            trigger,
            settings,
            getCleanupOptionsFromSettings(settings)
          );
        }, "navigate");
      }
    } catch (e) {
      console.error("Failed to cleanup on navigation:", e);
    }
  }

  async cleanupClosedTab(hostname: string, settings: Settings): Promise<void> {
    if (!hostname) return;
    try {
      const queue = getGlobalCleanupQueue();
      await queue.enqueue(async () => {
        const trigger = "tab-close" as const;
        await cleanupExecutor.executeByDomain(
          hostname,
          trigger,
          settings,
          getCleanupOptionsFromSettings(settings)
        );
      }, "tab-close");
    } catch (e) {
      console.error(`Failed to cleanup on tab close for ${hostname}:`, e);
    }
  }
}
