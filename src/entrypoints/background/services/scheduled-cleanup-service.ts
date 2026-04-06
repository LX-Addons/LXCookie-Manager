import type { Settings } from "@/types";
import { storage, LAST_SCHEDULED_CLEANUP_KEY } from "@/lib/store";
import { cleanupExecutor } from "./cleanup-executor";
import { shouldPerformCleanup } from "@/utils/cleanup";
import { getGlobalCleanupQueue } from "@/lib/distributed-lock";
import { getCleanupOptionsFromSettings } from "@/utils/cleanup/cleanup-options";

export class ScheduledCleanupService {
  async runScheduledCleanup(settings: Settings): Promise<void> {
    if (!settings.enableAutoCleanup) return;

    const queue = getGlobalCleanupQueue();
    try {
      await queue.enqueue(async () => {
        await this.runScheduledCleanupInternal(settings);
      }, "scheduled");
    } catch (error) {
      if (error instanceof Error) {
        console.warn(`[ScheduledCleanup] Scheduled cleanup failed: ${error.message}`);
      } else {
        console.warn("[ScheduledCleanup] Scheduled cleanup failed (unknown error)");
      }
    }
  }

  private async runScheduledCleanupInternal(settings: Settings): Promise<void> {
    try {
      const lastCleanup = (await storage.getItem<number>(LAST_SCHEDULED_CLEANUP_KEY)) || 0;
      const now = Date.now();

      if (shouldPerformCleanup(settings, lastCleanup, now)) {
        const trigger = "scheduled" as const;
        const result = await cleanupExecutor.executeWithFilter(
          "all",
          undefined,
          undefined,
          trigger,
          settings,
          getCleanupOptionsFromSettings(settings)
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
