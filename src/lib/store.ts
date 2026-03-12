import { storage } from "wxt/utils/storage";
import { CookieClearType, LogRetention, ThemeMode, ModeType, ScheduleInterval } from "@/types";
import type { Settings, CustomTheme } from "@/types";

export const WHITELIST_KEY = "local:whitelist" as const;
export const BLACKLIST_KEY = "local:blacklist" as const;
export const SETTINGS_KEY = "local:settings" as const;
export const CLEAR_LOG_KEY = "local:clearLog" as const;

export const LOG_RETENTION_MAP: Record<string, number> = {
  [LogRetention.ONE_HOUR]: 1 * 60 * 60 * 1000,
  [LogRetention.SIX_HOURS]: 6 * 60 * 60 * 1000,
  [LogRetention.TWELVE_HOURS]: 12 * 60 * 60 * 1000,
  [LogRetention.ONE_DAY]: 1 * 24 * 60 * 60 * 1000,
  [LogRetention.THREE_DAYS]: 3 * 24 * 60 * 60 * 1000,
  [LogRetention.SEVEN_DAYS]: 7 * 24 * 60 * 60 * 1000,
  [LogRetention.TEN_DAYS]: 10 * 24 * 60 * 60 * 1000,
  [LogRetention.THIRTY_DAYS]: 30 * 24 * 60 * 60 * 1000,
};

export const SCHEDULE_INTERVAL_MAP: Record<string, number> = {
  [ScheduleInterval.HOURLY]: 1 * 60 * 60 * 1000,
  [ScheduleInterval.DAILY]: 24 * 60 * 60 * 1000,
  [ScheduleInterval.WEEKLY]: 7 * 24 * 60 * 60 * 1000,
};

export const DEFAULT_CUSTOM_THEME: CustomTheme = {
  primary: "#3b82f6",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  bgPrimary: "#ffffff",
  bgSecondary: "#f8fafc",
  textPrimary: "#0f172a",
  textSecondary: "#475569",
};

export const DEFAULT_SETTINGS: Settings = {
  clearType: CookieClearType.ALL,
  logRetention: LogRetention.SEVEN_DAYS,
  themeMode: ThemeMode.AUTO,
  mode: ModeType.WHITELIST,
  clearLocalStorage: false,
  clearIndexedDB: false,
  clearCache: false,
  enableAutoCleanup: false,
  cleanupOnTabDiscard: false,
  cleanupOnStartup: false,
  cleanupExpiredCookies: false,
  customTheme: DEFAULT_CUSTOM_THEME,
  scheduleInterval: ScheduleInterval.DISABLED,
  showCookieRisk: true,
  locale: "zh-CN",
};

export { storage };
