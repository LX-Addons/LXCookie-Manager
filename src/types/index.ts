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
  partitionKey?: chrome.cookies.CookiePartitionKey;
  firstPartyDomain?: string;
  hostOnly?: boolean;
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
  settingsVersion: number;
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
  cleanupOnTabClose: boolean;
  cleanupOnBrowserClose: boolean;
  cleanupOnNavigate: boolean;
  customTheme?: CustomTheme;
  scheduleInterval: ScheduleInterval;
  lastScheduledCleanup?: number;
  showCookieRisk: boolean;
  locale: Locale;
}

export interface ClearLogEntry {
  id: string;
  domain?: string;
  domains?: string[];
  cookieType?: CookieClearType;
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

export type CleanupTrigger =
  | "manual-current"
  | "manual-all"
  | "scheduled"
  | "tab-close"
  | "browser-close-recovery"
  | "startup"
  | "navigate"
  | "tab-discard"
  | "expired-cookies";

export interface DataClearResult {
  success: boolean;
  attempted: boolean;
  error?: string;
}

export interface CleanupExecutionResult {
  success: boolean;
  trigger: CleanupTrigger;
  requestedDomain?: string;
  matchedDomains: string[];
  cookiesRemoved: number;
  browserDataCleared: {
    cache: DataClearResult;
    localStorage: DataClearResult;
    indexedDB: DataClearResult;
  };
  partialFailures: Array<{
    stage: CleanupStage;
    domain?: string;
    reason: string;
  }>;
  durationMs: number;
  timestamp: number;
}

export interface PendingCleanupTask {
  id: string;
  type: "browser-close-recovery";
  domain: string;
  createdAt: number;
  retryCount: number;
}

export interface JobLease {
  key: string;
  startedAt: number;
  expiresAt: number;
}

export interface BackgroundMessage {
  type: string;
  payload?: unknown;
}

export interface GetCurrentTabCookiesRequest extends BackgroundMessage {
  type: "getCurrentTabCookies";
}

export interface GetCurrentTabCookiesData {
  cookies: Cookie[];
  domain: string;
}

export interface GetStatsRequest extends BackgroundMessage {
  type: "getStats";
  domain?: string;
}

export interface CleanupByDomainRequest extends BackgroundMessage {
  type: "cleanupByDomain";
  payload: {
    domain: string;
    trigger: CleanupTrigger;
    clearType?: CookieClearType;
    clearCache?: boolean;
    clearLocalStorage?: boolean;
    clearIndexedDB?: boolean;
  };
}

export interface CleanupWithFilterRequest extends BackgroundMessage {
  type: "cleanupWithFilter";
  payload: {
    filterType: "all" | "domain" | "domain-list";
    filterValue?: string;
    domainList?: string[];
    trigger: CleanupTrigger;
    clearType?: CookieClearType;
    clearCache?: boolean;
    clearLocalStorage?: boolean;
    clearIndexedDB?: boolean;
  };
}

export interface CreateCookieRequest extends BackgroundMessage {
  type: "createCookie";
  payload: Partial<Cookie>;
}

export interface UpdateCookieRequest extends BackgroundMessage {
  type: "updateCookie";
  payload: {
    original: Cookie;
    updates: Partial<Cookie>;
  };
}

export interface DeleteCookieRequest extends BackgroundMessage {
  type: "deleteCookie";
  payload: Cookie;
}

export interface ExportLogsRequest extends BackgroundMessage {
  type: "exportLogs";
  payload?: {
    options?: {
      sanitize?: boolean;
      includeMetadata?: boolean;
    };
  };
}

export type BackgroundRequest =
  | GetCurrentTabCookiesRequest
  | GetStatsRequest
  | CleanupByDomainRequest
  | CleanupWithFilterRequest
  | CreateCookieRequest
  | UpdateCookieRequest
  | DeleteCookieRequest
  | ExportLogsRequest;

export enum ErrorCode {
  SUCCESS = "SUCCESS",
  INVALID_URL = "INVALID_URL",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  INVALID_PARAMETERS = "INVALID_PARAMETERS",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  COOKIE_REMOVE_FAILED = "COOKIE_REMOVE_FAILED",
  BROWSING_DATA_FAILED = "BROWSING_DATA_FAILED",
  STORAGE_READ_FAILED = "STORAGE_READ_FAILED",
  STORAGE_WRITE_FAILED = "STORAGE_WRITE_FAILED",
  TAB_QUERY_FAILED = "TAB_QUERY_FAILED",
  COOKIE_CREATE_FAILED = "COOKIE_CREATE_FAILED",
  COOKIE_UPDATE_FAILED = "COOKIE_UPDATE_FAILED",
}

export enum CleanupStage {
  COOKIES = "cookies",
  CACHE = "cache",
  LOCAL_STORAGE = "localStorage",
  INDEXED_DB = "indexedDB",
  STORAGE = "storage",
}

export class CleanupError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly stage: CleanupStage,
    message: string
  ) {
    super(message);
    this.name = "CleanupError";
  }
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: ErrorCode;
    message: string;
  };
}

export interface ExtensionErrorReport {
  code: ErrorCode | string;
  operation: string;
  trigger?: string;
  domain?: string;
  message: string;
  recoverable: boolean;
  timestamp: number;
  originalError?: unknown;
}

export enum MetricType {
  CLEANUP = "cleanup",
  COOKIE_MUTATION = "cookie_mutation",
  AUDIT = "audit",
  ERROR = "error",
  MAINTENANCE = "maintenance",
}

export interface BackgroundMetric {
  id: string;
  type: MetricType;
  operation: string;
  success: boolean;
  durationMs: number;
  timestamp: number;
  domain?: string;
  trigger?: string;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

export interface MetricsSummary {
  totalTasks: number;
  successRate: number;
  failureRate: number;
  averageDurationMs: number;
  successCount: number;
  failureCount: number;
  recentFailures: BackgroundMetric[];
  byType: Record<MetricType, { count: number; successRate: number; averageDurationMs: number }>;
}
