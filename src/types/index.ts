export type DomainList = string[];

export type SameSite = "strict" | "lax" | "none" | "unspecified" | "no_restriction";

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: SameSite;
  expirationDate?: number;
  storeId?: string;
}

export interface CookieStats {
  total: number;
  current: number;
  session: number;
  persistent: number;
  thirdParty: number;
  tracking: number;
}

export enum CookieClearType {
  SESSION = "session",
  PERSISTENT = "persistent",
  ALL = "all",
}

export enum LogRetention {
  ONE_HOUR = "1hour",
  SIX_HOURS = "6hours",
  TWELVE_HOURS = "12hours",
  ONE_DAY = "1day",
  THREE_DAYS = "3days",
  SEVEN_DAYS = "7days",
  TEN_DAYS = "10days",
  THIRTY_DAYS = "30days",
  FOREVER = "forever",
}

export enum ThemeMode {
  AUTO = "auto",
  LIGHT = "light",
  DARK = "dark",
  CUSTOM = "custom",
}

export enum ModeType {
  WHITELIST = "whitelist",
  BLACKLIST = "blacklist",
}

export enum ScheduleInterval {
  DISABLED = "disabled",
  HOURLY = "hourly",
  DAILY = "daily",
  WEEKLY = "weekly",
}

export interface CustomTheme {
  primary: string;
  success: string;
  warning: string;
  danger: string;
  bgPrimary: string;
  bgSecondary: string;
  textPrimary: string;
  textSecondary: string;
}

export type Locale = "zh-CN" | "en-US";

export interface Settings {
  clearType: CookieClearType;
  logRetention: LogRetention;
  themeMode: ThemeMode;
  mode: ModeType;
  clearLocalStorage: boolean;
  clearIndexedDB: boolean;
  clearCache: boolean;
  enableAutoCleanup: boolean;
  cleanupOnTabDiscard: boolean;
  cleanupOnStartup: boolean;
  cleanupExpiredCookies: boolean;
  customTheme?: CustomTheme;
  scheduleInterval: ScheduleInterval;
  lastScheduledCleanup?: number;
  showCookieRisk: boolean;
  locale: Locale;
}

export interface ClearLogEntry {
  id: string;
  domain: string;
  cookieType: CookieClearType;
  count: number;
  timestamp: number;
  action: "clear" | "edit" | "delete" | "import" | "export";
  details?: string;
}

export interface CookieRisk {
  level: "low" | "medium" | "high";
  reason: string;
  isTracking: boolean;
  isThirdParty: boolean;
}
