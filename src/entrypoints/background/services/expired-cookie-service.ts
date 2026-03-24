import type { Settings } from "@/types";
import { cleanupExpiredCookies } from "@/utils/cleanup/cookie-ops";
import {
  shouldPerformExpiredCookieCleanupWithStorage,
  updateExpiredCookieCleanupTimestamp,
} from "@/utils/cleanup";

export class ExpiredCookieService {
  private async doExpiredCookiesCleanup(
    settings: Settings,
    checkTimeWindow = false,
    now?: number
  ): Promise<void> {
    if (!settings.enableAutoCleanup || !settings.cleanupExpiredCookies) return;

    if (checkTimeWindow && now !== undefined) {
      if (!(await shouldPerformExpiredCookieCleanupWithStorage(settings, now))) return;
    }

    try {
      const count = await cleanupExpiredCookies();
      if (count > 0) {
        console.log(`Cleaned up ${count} expired cookies${checkTimeWindow ? "" : " on startup"}`);
      }
      await updateExpiredCookieCleanupTimestamp(now ?? Date.now());
    } catch (e) {
      console.error("Failed to cleanup expired cookies:", e);
    }
  }

  async runExpiredCookiesCleanup(
    settings: Settings,
    checkTimeWindow = false,
    now?: number
  ): Promise<void> {
    await this.doExpiredCookiesCleanup(settings, checkTimeWindow, now);
  }
}
