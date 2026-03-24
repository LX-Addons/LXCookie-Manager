import type { BackgroundRequest, ApiResponse } from "@/types";
import { ErrorCode } from "@/types";
import { CookiesHandler } from "../handlers/cookies";
import { CleanupHandler } from "../handlers/cleanup";
import { logExportService } from "./log-export-service";

let cookiesHandler: CookiesHandler | null = null;
let cleanupHandler: CleanupHandler | null = null;

const getCookiesHandler = (): CookiesHandler => {
  cookiesHandler ??= new CookiesHandler();
  return cookiesHandler;
};

const getCleanupHandler = (): CleanupHandler => {
  cleanupHandler ??= new CleanupHandler();
  return cleanupHandler;
};

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
): payload is { name: string; domain: string; path: string } {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return typeof p.name === "string" && typeof p.domain === "string" && typeof p.path === "string";
}

function validateUpdateCookiePayload(
  payload: unknown
): payload is { original: { name: string; domain: string }; updates: object } {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  if (typeof p.original !== "object" || p.original === null) return false;
  const orig = p.original as Record<string, unknown>;
  if (typeof orig.name !== "string" || typeof orig.domain !== "string") return false;
  if (typeof p.updates !== "object" || p.updates === null) return false;
  return true;
}

function validateDeleteCookiePayload(
  payload: unknown
): payload is { name: string; domain: string } {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return typeof p.name === "string" && typeof p.domain === "string";
}

function validateCleanupByDomainPayload(payload: unknown): payload is {
  domain: string;
  trigger: string;
  clearType?: string;
  clearCache?: boolean;
  clearLocalStorage?: boolean;
  clearIndexedDB?: boolean;
} {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  if (typeof p.domain !== "string" || typeof p.trigger !== "string") return false;
  if (p.clearType !== undefined && typeof p.clearType !== "string") return false;
  if (p.clearCache !== undefined && typeof p.clearCache !== "boolean") return false;
  if (p.clearLocalStorage !== undefined && typeof p.clearLocalStorage !== "boolean") return false;
  if (p.clearIndexedDB !== undefined && typeof p.clearIndexedDB !== "boolean") return false;
  return true;
}

function validateCleanupWithFilterPayload(payload: unknown): payload is {
  filterType: string;
  trigger: string;
  filterValue?: string;
  domainList?: string[];
  clearType?: string;
  clearCache?: boolean;
  clearLocalStorage?: boolean;
  clearIndexedDB?: boolean;
} {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  if (typeof p.filterType !== "string" || typeof p.trigger !== "string") return false;
  if (p.filterValue !== undefined && typeof p.filterValue !== "string") return false;
  if (p.domainList !== undefined) {
    if (!Array.isArray(p.domainList)) return false;
    if (!p.domainList.every((d) => typeof d === "string")) return false;
  }
  if (p.clearType !== undefined && typeof p.clearType !== "string") return false;
  if (p.clearCache !== undefined && typeof p.clearCache !== "boolean") return false;
  if (p.clearLocalStorage !== undefined && typeof p.clearLocalStorage !== "boolean") return false;
  if (p.clearIndexedDB !== undefined && typeof p.clearIndexedDB !== "boolean") return false;
  return true;
}

export const handleMessage = async (request: unknown): Promise<ApiResponse> => {
  if (!hasValidRequestType(request)) {
    return createErrorResponse(ErrorCode.INVALID_PARAMETERS, "Invalid request format");
  }

  const { type } = request;

  switch (type) {
    case "getCurrentTabCookies": {
      return await getCookiesHandler().getCurrentTabCookies();
    }
    case "getStats": {
      return await getCookiesHandler().getStats(request.domain);
    }
    case "createCookie": {
      if (!hasPayload(request) || !validateCreateCookiePayload(request.payload)) {
        return createErrorResponse(
          ErrorCode.INVALID_PARAMETERS,
          "Invalid payload for createCookie: name, domain, and path are required"
        );
      }
      return await getCookiesHandler().createCookie(request.payload);
    }
    case "updateCookie": {
      if (!hasPayload(request) || !validateUpdateCookiePayload(request.payload)) {
        return createErrorResponse(
          ErrorCode.INVALID_PARAMETERS,
          "Invalid payload for updateCookie: original (with name, domain) and updates are required"
        );
      }
      return await getCookiesHandler().updateCookie(
        request.payload.original,
        request.payload.updates
      );
    }
    case "deleteCookie": {
      if (!hasPayload(request) || !validateDeleteCookiePayload(request.payload)) {
        return createErrorResponse(
          ErrorCode.INVALID_PARAMETERS,
          "Invalid payload for deleteCookie: name and domain are required"
        );
      }
      return await getCookiesHandler().deleteCookie(request.payload);
    }
    case "cleanupByDomain": {
      if (!hasPayload(request) || !validateCleanupByDomainPayload(request.payload)) {
        return createErrorResponse(
          ErrorCode.INVALID_PARAMETERS,
          "Invalid payload for cleanupByDomain: domain and trigger are required"
        );
      }
      return await getCleanupHandler().cleanupByDomain(
        request.payload.domain,
        request.payload.trigger,
        {
          clearType: request.payload.clearType,
          clearCache: request.payload.clearCache,
          clearLocalStorage: request.payload.clearLocalStorage,
          clearIndexedDB: request.payload.clearIndexedDB,
        }
      );
    }
    case "cleanupWithFilter": {
      if (!hasPayload(request) || !validateCleanupWithFilterPayload(request.payload)) {
        return createErrorResponse(
          ErrorCode.INVALID_PARAMETERS,
          "Invalid payload for cleanupWithFilter: filterType and trigger are required"
        );
      }
      return await getCleanupHandler().cleanupWithFilter(
        request.payload.filterType,
        request.payload.filterValue,
        request.payload.domainList,
        request.payload.trigger,
        {
          clearType: request.payload.clearType,
          clearCache: request.payload.clearCache,
          clearLocalStorage: request.payload.clearLocalStorage,
          clearIndexedDB: request.payload.clearIndexedDB,
        }
      );
    }
    case "exportLogs": {
      const result = await logExportService.exportLogs(request.payload?.options);
      if (result.success && result.data) {
        return createSuccessResponse(result.data);
      }
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, result.error || "Export failed");
    }
    default:
      return createErrorResponse(ErrorCode.INVALID_PARAMETERS, `Unknown message type: ${type}`);
  }
};
