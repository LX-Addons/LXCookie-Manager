import type { Settings } from "@/types";
import { storage, LAST_SCHEDULED_CLEANUP_KEY } from "@/lib/store";
import { CleanupHandler } from "../handlers/cleanup";
import { shouldPerformCleanup } from "@/utils/cleanup";

export class ScheduledCleanupService {
  private readonly cleanupHandler: CleanupHandler;

  constructor() {
    this.cleanupHandler = new CleanupHandler();
  }

  private getCleanupOptions(settings: Settings) {
    return {
      clearType: settings.clearType,
      clearCache: settings.clearCache,
      clearLocalStorage: settings.clearLocalStorage,
      clearIndexedDB: settings.clearIndexedDB,
    };
  }

  async runScheduledCleanup(settings: Settings): Promise<void> {
    try {
      if (!settings.enableAutoCleanup) return;

      const lastCleanup = (await storage.getItem<number>(LAST_SCHEDULED_CLEANUP_KEY)) || 0;
      const now = Date.now();

      if (shouldPerformCleanup(settings, lastCleanup, now)) {
        const trigger = "scheduled" as const;
        const result = await this.cleanupHandler.cleanupWithFilter(
          "all",
          undefined,
          undefined,
          trigger,
          this.getCleanupOptions(settings)
        );

        if (result.success) {
          await storage.setItem(LAST_SCHEDULED_CLEANUP_KEY, now);
        }
      }
    } catch (e) {
      console.error("Failed to perform scheduled cleanup:", e);
    }
  }
}
