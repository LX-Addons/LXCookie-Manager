import { describe, it, expect, vi } from "vitest";
import {
  WHITELIST_KEY,
  BLACKLIST_KEY,
  SETTINGS_KEY,
  CLEAR_LOG_KEY,
  LOG_RETENTION_MAP,
  SCHEDULE_INTERVAL_MAP,
  DEFAULT_CUSTOM_THEME,
  DEFAULT_SETTINGS,
} from "@/lib/store";
import { CookieClearType, LogRetention, ThemeMode, ModeType, ScheduleInterval } from "@/types";

vi.mock("wxt/utils/storage", () => ({
  Storage: class {
    async get() {
      return undefined;
    }
    async set() {
      return undefined;
    }
  },
}));

describe("store", () => {
  describe("Storage Keys", () => {
    it("WHITELIST_KEY should be 'local:whitelist'", () => {
      expect(WHITELIST_KEY).toBe("local:whitelist");
    });

    it("BLACKLIST_KEY should be 'local:blacklist'", () => {
      expect(BLACKLIST_KEY).toBe("local:blacklist");
    });

    it("SETTINGS_KEY should be 'local:settings'", () => {
      expect(SETTINGS_KEY).toBe("local:settings");
    });

    it("CLEAR_LOG_KEY should be 'local:clearLog'", () => {
      expect(CLEAR_LOG_KEY).toBe("local:clearLog");
    });
  });

  describe("LOG_RETENTION_MAP", () => {
    it("should have correct value for ONE_HOUR", () => {
      expect(LOG_RETENTION_MAP[LogRetention.ONE_HOUR]).toBe(1 * 60 * 60 * 1000);
    });

    it("should have correct value for SIX_HOURS", () => {
      expect(LOG_RETENTION_MAP[LogRetention.SIX_HOURS]).toBe(6 * 60 * 60 * 1000);
    });

    it("should have correct value for TWELVE_HOURS", () => {
      expect(LOG_RETENTION_MAP[LogRetention.TWELVE_HOURS]).toBe(12 * 60 * 60 * 1000);
    });

    it("should have correct value for ONE_DAY", () => {
      expect(LOG_RETENTION_MAP[LogRetention.ONE_DAY]).toBe(1 * 24 * 60 * 60 * 1000);
    });

    it("should have correct value for THREE_DAYS", () => {
      expect(LOG_RETENTION_MAP[LogRetention.THREE_DAYS]).toBe(3 * 24 * 60 * 60 * 1000);
    });

    it("should have correct value for SEVEN_DAYS", () => {
      expect(LOG_RETENTION_MAP[LogRetention.SEVEN_DAYS]).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it("should have correct value for TEN_DAYS", () => {
      expect(LOG_RETENTION_MAP[LogRetention.TEN_DAYS]).toBe(10 * 24 * 60 * 60 * 1000);
    });

    it("should have correct value for THIRTY_DAYS", () => {
      expect(LOG_RETENTION_MAP[LogRetention.THIRTY_DAYS]).toBe(30 * 24 * 60 * 60 * 1000);
    });
  });

  describe("SCHEDULE_INTERVAL_MAP", () => {
    it("should have correct value for HOURLY", () => {
      expect(SCHEDULE_INTERVAL_MAP[ScheduleInterval.HOURLY]).toBe(1 * 60 * 60 * 1000);
    });

    it("should have correct value for DAILY", () => {
      expect(SCHEDULE_INTERVAL_MAP[ScheduleInterval.DAILY]).toBe(24 * 60 * 60 * 1000);
    });

    it("should have correct value for WEEKLY", () => {
      expect(SCHEDULE_INTERVAL_MAP[ScheduleInterval.WEEKLY]).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe("DEFAULT_CUSTOM_THEME", () => {
    it("should have correct primary color", () => {
      expect(DEFAULT_CUSTOM_THEME.primary).toBe("#3b82f6");
    });

    it("should have correct success color", () => {
      expect(DEFAULT_CUSTOM_THEME.success).toBe("#22c55e");
    });

    it("should have correct warning color", () => {
      expect(DEFAULT_CUSTOM_THEME.warning).toBe("#f59e0b");
    });

    it("should have correct danger color", () => {
      expect(DEFAULT_CUSTOM_THEME.danger).toBe("#ef4444");
    });

    it("should have correct bgPrimary color", () => {
      expect(DEFAULT_CUSTOM_THEME.bgPrimary).toBe("#ffffff");
    });

    it("should have correct bgSecondary color", () => {
      expect(DEFAULT_CUSTOM_THEME.bgSecondary).toBe("#f8fafc");
    });

    it("should have correct textPrimary color", () => {
      expect(DEFAULT_CUSTOM_THEME.textPrimary).toBe("#0f172a");
    });

    it("should have correct textSecondary color", () => {
      expect(DEFAULT_CUSTOM_THEME.textSecondary).toBe("#475569");
    });
  });

  describe("DEFAULT_SETTINGS", () => {
    it("should have correct clearType", () => {
      expect(DEFAULT_SETTINGS.clearType).toBe(CookieClearType.ALL);
    });

    it("should have correct logRetention", () => {
      expect(DEFAULT_SETTINGS.logRetention).toBe(LogRetention.SEVEN_DAYS);
    });

    it("should have correct themeMode", () => {
      expect(DEFAULT_SETTINGS.themeMode).toBe(ThemeMode.AUTO);
    });

    it("should have correct mode", () => {
      expect(DEFAULT_SETTINGS.mode).toBe(ModeType.WHITELIST);
    });

    it("should have correct clearLocalStorage", () => {
      expect(DEFAULT_SETTINGS.clearLocalStorage).toBe(false);
    });

    it("should have correct clearIndexedDB", () => {
      expect(DEFAULT_SETTINGS.clearIndexedDB).toBe(false);
    });

    it("should have correct clearCache", () => {
      expect(DEFAULT_SETTINGS.clearCache).toBe(false);
    });

    it("should have correct enableAutoCleanup", () => {
      expect(DEFAULT_SETTINGS.enableAutoCleanup).toBe(false);
    });

    it("should have correct cleanupOnTabDiscard", () => {
      expect(DEFAULT_SETTINGS.cleanupOnTabDiscard).toBe(false);
    });

    it("should have correct cleanupOnStartup", () => {
      expect(DEFAULT_SETTINGS.cleanupOnStartup).toBe(false);
    });

    it("should have correct cleanupExpiredCookies", () => {
      expect(DEFAULT_SETTINGS.cleanupExpiredCookies).toBe(false);
    });

    it("should have correct customTheme", () => {
      expect(DEFAULT_SETTINGS.customTheme).toEqual(DEFAULT_CUSTOM_THEME);
    });

    it("should have correct scheduleInterval", () => {
      expect(DEFAULT_SETTINGS.scheduleInterval).toBe(ScheduleInterval.DISABLED);
    });

    it("should have correct showCookieRisk", () => {
      expect(DEFAULT_SETTINGS.showCookieRisk).toBe(true);
    });

    it("should have correct locale", () => {
      expect(DEFAULT_SETTINGS.locale).toBe("zh-CN");
    });
  });
});
