import type { BackgroundRequest, ApiResponse, CleanupTrigger, Cookie, Settings } from "@/types";
import {
  ErrorCode,
  CookieClearType,
  LogRetention,
  ThemeMode,
  ModeType,
  ScheduleInterval,
  Locale,
} from "@/types";
import { CookiesHandler } from "../handlers/cookies";
import { CleanupHandler } from "../handlers/cleanup";
import { SettingsHandler } from "../handlers/settings";
import { logExportService } from "./log-export-service";
import { settingsMigratorSingleton } from "./settings-migrator";

const cookiesHandler = new CookiesHandler();
const cleanupHandler = new CleanupHandler(settingsMigratorSingleton);
const settingsHandler = new SettingsHandler();

const VALID_CLEAR_TYPES = new Set(Object.values(CookieClearType));

export const createSuccessResponse = <T>(data?: T): ApiResponse<T> => ({
  success: true,
  data,
});

export const createErrorResponse = (code: ErrorCode, message: string): ApiResponse => ({
  success: false,
  error: { code, message },
});

function hasValidRequestType(request: unknown): request is BackgroundRequest & { type: string } {
  return (
    typeof request === "object" &&
    request !== null &&
    "type" in request &&
    typeof (request as Record<string, unknown>).type === "string"
  );
}

function hasPayload(
  request: BackgroundRequest
): request is BackgroundRequest & { payload: object } {
  return "payload" in request && typeof request.payload === "object" && request.payload !== null;
}

function validateCreateCookiePayload(
  payload: unknown
): payload is { name: string; domain: string; value: string; path?: string } {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.name === "string" &&
    typeof p.domain === "string" &&
    typeof p.value === "string" &&
    (p.path === undefined || typeof p.path === "string")
  );
}

function validateUpdateCookiePayload(payload: unknown): payload is {
  original: { name: string; domain: string; path: string; value: string; secure: boolean };
  updates: object;
} {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  if (typeof p.original !== "object" || p.original === null) return false;
  const orig = p.original as Record<string, unknown>;
  if (
    typeof orig.name !== "string" ||
    typeof orig.domain !== "string" ||
    typeof orig.path !== "string" ||
    typeof orig.value !== "string" ||
    typeof orig.secure !== "boolean"
  ) {
    return false;
  }
  if (typeof p.updates !== "object" || p.updates === null) return false;
  return true;
}

function validateDeleteCookiePayload(
  payload: unknown
): payload is { name: string; domain: string; path: string; secure: boolean } {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.name === "string" &&
    typeof p.domain === "string" &&
    typeof p.path === "string" &&
    typeof p.secure === "boolean"
  );
}

function validateCleanupByDomainPayload(payload: unknown): payload is {
  domain: string;
  trigger: string;
  clearType?: CookieClearType;
  clearCache?: boolean;
  clearLocalStorage?: boolean;
  clearIndexedDB?: boolean;
} {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  if (typeof p.domain !== "string" || typeof p.trigger !== "string") return false;
  if (p.clearType !== undefined && !VALID_CLEAR_TYPES.has(p.clearType as CookieClearType)) {
    return false;
  }
  if (p.clearCache !== undefined && typeof p.clearCache !== "boolean") return false;
  if (p.clearLocalStorage !== undefined && typeof p.clearLocalStorage !== "boolean") return false;
  if (p.clearIndexedDB !== undefined && typeof p.clearIndexedDB !== "boolean") return false;
  return true;
}

function validateDomainList(domainList: unknown): domainList is string[] {
  if (domainList === undefined) return true;
  if (!Array.isArray(domainList)) return false;
  return domainList.every((d) => typeof d === "string");
}

function validateCleanupWithFilterPayload(payload: unknown): payload is {
  filterType: string;
  trigger: string;
  filterValue?: string;
  domainList?: string[];
  clearType?: CookieClearType;
  clearCache?: boolean;
  clearLocalStorage?: boolean;
  clearIndexedDB?: boolean;
} {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  if (typeof p.filterType !== "string" || typeof p.trigger !== "string") return false;
  if (p.filterValue !== undefined && typeof p.filterValue !== "string") return false;
  if (!validateDomainList(p.domainList)) return false;
  if (p.clearType !== undefined && !VALID_CLEAR_TYPES.has(p.clearType as CookieClearType)) {
    return false;
  }
  if (p.clearCache !== undefined && typeof p.clearCache !== "boolean") return false;
  if (p.clearLocalStorage !== undefined && typeof p.clearLocalStorage !== "boolean") return false;
  if (p.clearIndexedDB !== undefined && typeof p.clearIndexedDB !== "boolean") return false;
  return true;
}

type MessageHandler = (request: BackgroundRequest) => Promise<ApiResponse>;

const handleGetCurrentTabCookies: MessageHandler = async () => {
  return await cookiesHandler.getCurrentTabCookies();
};

const handleGetStats: MessageHandler = async (request) => {
  if ("domain" in request && request.domain !== undefined && typeof request.domain !== "string") {
    return createErrorResponse(ErrorCode.INVALID_PARAMETERS, "Invalid domain for getStats");
  }
  return await cookiesHandler.getStats(
    "domain" in request ? (request as { domain?: string }).domain : undefined
  );
};

const handleCreateCookie: MessageHandler = async (request) => {
  if (!hasPayload(request) || !validateCreateCookiePayload(request.payload)) {
    return createErrorResponse(
      ErrorCode.INVALID_PARAMETERS,
      "Invalid payload for createCookie: name, domain, and value are required"
    );
  }
  return await cookiesHandler.createCookie(request.payload);
};

const handleUpdateCookie: MessageHandler = async (request) => {
  if (!hasPayload(request) || !validateUpdateCookiePayload(request.payload)) {
    return createErrorResponse(
      ErrorCode.INVALID_PARAMETERS,
      "Invalid payload for updateCookie: original (with name, domain, path, value, secure) and updates are required"
    );
  }
  return await cookiesHandler.updateCookie(
    request.payload.original as Cookie,
    request.payload.updates
  );
};

const handleDeleteCookie: MessageHandler = async (request) => {
  if (!hasPayload(request) || !validateDeleteCookiePayload(request.payload)) {
    return createErrorResponse(
      ErrorCode.INVALID_PARAMETERS,
      "Invalid payload for deleteCookie: name, domain, path, and secure are required"
    );
  }
  return await cookiesHandler.deleteCookie(request.payload as Cookie);
};

const handleCleanupByDomain: MessageHandler = async (request) => {
  if (!hasPayload(request) || !validateCleanupByDomainPayload(request.payload)) {
    return createErrorResponse(
      ErrorCode.INVALID_PARAMETERS,
      "Invalid payload for cleanupByDomain: domain and trigger are required"
    );
  }
  const settings = await settingsMigratorSingleton.getSettings();
  return await cleanupHandler.cleanupByDomain(
    request.payload.domain,
    request.payload.trigger as CleanupTrigger,
    settings,
    {
      clearType: request.payload.clearType,
      clearCache: request.payload.clearCache,
      clearLocalStorage: request.payload.clearLocalStorage,
      clearIndexedDB: request.payload.clearIndexedDB,
    }
  );
};

const handleCleanupWithFilter: MessageHandler = async (request) => {
  if (!hasPayload(request) || !validateCleanupWithFilterPayload(request.payload)) {
    return createErrorResponse(
      ErrorCode.INVALID_PARAMETERS,
      "Invalid payload for cleanupWithFilter: filterType and trigger are required"
    );
  }
  const settings = await settingsMigratorSingleton.getSettings();
  return await cleanupHandler.cleanupWithFilter(
    request.payload.filterType as "all" | "domain" | "domain-list",
    request.payload.filterValue,
    request.payload.domainList,
    request.payload.trigger as CleanupTrigger,
    settings,
    {
      clearType: request.payload.clearType,
      clearCache: request.payload.clearCache,
      clearLocalStorage: request.payload.clearLocalStorage,
      clearIndexedDB: request.payload.clearIndexedDB,
    }
  );
};

const handleExportLogs: MessageHandler = async (request) => {
  const payload =
    "payload" in request && typeof request.payload === "object" && request.payload !== null
      ? request.payload
      : {};
  const options =
    "options" in payload
      ? (payload as { options?: { sanitize?: boolean; includeMetadata?: boolean } }).options
      : undefined;
  const result = await logExportService.exportLogs(options);
  if (result.success && result.data) {
    return createSuccessResponse(result.data);
  }
  return createErrorResponse(ErrorCode.INTERNAL_ERROR, result.error || "Export failed");
};

const handleGetSettings: MessageHandler = async () => {
  try {
    const settings = await settingsHandler.getSettings();
    return createSuccessResponse(settings);
  } catch (error) {
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      `Failed to get settings: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

const VALID_LOG_RETENTIONS = new Set(Object.values(LogRetention));
const VALID_THEME_MODES = new Set(Object.values(ThemeMode));
const VALID_MODE_TYPES = new Set(Object.values(ModeType));
const VALID_SCHEDULE_INTERVALS = new Set(Object.values(ScheduleInterval));
const VALID_LOCALES = new Set<object>(["zh-CN", "en-US"]);

function validateUpdateSettingsPayload(payload: unknown): payload is Partial<Settings> {
  if (typeof payload !== "object" || payload === null) return false;

  const updates = payload as Record<string, unknown>;
  const validKeys = new Set<string>([
    "settingsVersion",
    "clearType",
    "logRetention",
    "themeMode",
    "mode",
    "clearLocalStorage",
    "clearIndexedDB",
    "clearCache",
    "enableAutoCleanup",
    "cleanupOnTabDiscard",
    "cleanupOnStartup",
    "cleanupExpiredCookies",
    "cleanupOnTabClose",
    "cleanupOnBrowserClose",
    "cleanupOnNavigate",
    "customTheme",
    "scheduleInterval",
    "lastScheduledCleanup",
    "showCookieRisk",
    "locale",
  ]);

  for (const key of Object.keys(updates)) {
    if (!validKeys.has(key)) return false;
  }

  if (updates.settingsVersion !== undefined && typeof updates.settingsVersion !== "number")
    return false;
  if (
    updates.clearType !== undefined &&
    !VALID_CLEAR_TYPES.has(updates.clearType as CookieClearType)
  )
    return false;
  if (
    updates.logRetention !== undefined &&
    !VALID_LOG_RETENTIONS.has(updates.logRetention as LogRetention)
  )
    return false;
  if (updates.themeMode !== undefined && !VALID_THEME_MODES.has(updates.themeMode as ThemeMode))
    return false;
  if (updates.mode !== undefined && !VALID_MODE_TYPES.has(updates.mode as ModeType)) return false;
  if (updates.clearLocalStorage !== undefined && typeof updates.clearLocalStorage !== "boolean")
    return false;
  if (updates.clearIndexedDB !== undefined && typeof updates.clearIndexedDB !== "boolean")
    return false;
  if (updates.clearCache !== undefined && typeof updates.clearCache !== "boolean") return false;
  if (updates.enableAutoCleanup !== undefined && typeof updates.enableAutoCleanup !== "boolean")
    return false;
  if (updates.cleanupOnTabDiscard !== undefined && typeof updates.cleanupOnTabDiscard !== "boolean")
    return false;
  if (updates.cleanupOnStartup !== undefined && typeof updates.cleanupOnStartup !== "boolean")
    return false;
  if (
    updates.cleanupExpiredCookies !== undefined &&
    typeof updates.cleanupExpiredCookies !== "boolean"
  )
    return false;
  if (updates.cleanupOnTabClose !== undefined && typeof updates.cleanupOnTabClose !== "boolean")
    return false;
  if (
    updates.cleanupOnBrowserClose !== undefined &&
    typeof updates.cleanupOnBrowserClose !== "boolean"
  )
    return false;
  if (updates.cleanupOnNavigate !== undefined && typeof updates.cleanupOnNavigate !== "boolean")
    return false;
  if (
    updates.scheduleInterval !== undefined &&
    !VALID_SCHEDULE_INTERVALS.has(updates.scheduleInterval as ScheduleInterval)
  )
    return false;
  if (
    updates.lastScheduledCleanup !== undefined &&
    typeof updates.lastScheduledCleanup !== "number"
  )
    return false;
  if (updates.showCookieRisk !== undefined && typeof updates.showCookieRisk !== "boolean")
    return false;
  if (updates.locale !== undefined && !VALID_LOCALES.has(updates.locale as Locale)) return false;

  return true;
}

const handleUpdateSettings: MessageHandler = async (request) => {
  if (!hasPayload(request) || !validateUpdateSettingsPayload(request.payload)) {
    return createErrorResponse(
      ErrorCode.INVALID_PARAMETERS,
      "Invalid payload for updateSettings: updates object is required"
    );
  }

  try {
    const updates = request.payload;
    const updatedSettings = await settingsHandler.updateSettings(updates);
    return createSuccessResponse(updatedSettings);
  } catch (error) {
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      `Failed to update settings: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

const messageHandlers: Record<string, MessageHandler> = {
  getCurrentTabCookies: handleGetCurrentTabCookies,
  getStats: handleGetStats,
  createCookie: handleCreateCookie,
  updateCookie: handleUpdateCookie,
  deleteCookie: handleDeleteCookie,
  cleanupByDomain: handleCleanupByDomain,
  cleanupWithFilter: handleCleanupWithFilter,
  exportLogs: handleExportLogs,
  getSettings: handleGetSettings,
  updateSettings: handleUpdateSettings,
};

export const handleMessage = async (request: unknown): Promise<ApiResponse> => {
  if (!hasValidRequestType(request)) {
    return createErrorResponse(ErrorCode.INVALID_PARAMETERS, "Invalid request format");
  }

  const { type } = request;
  const handler = messageHandlers[type];

  if (handler) {
    return await handler(request);
  }

  return createErrorResponse(ErrorCode.INVALID_PARAMETERS, `Unknown message type: ${type}`);
};
