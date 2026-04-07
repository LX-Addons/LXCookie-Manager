import type { Cookie, CookieStats, ApiResponse } from "@/types";
import { ErrorCode, CookieRemoveError, CookieRemoveErrorType } from "@/types";
import { isTrackingCookie, isThirdPartyCookie } from "@/utils/cookie-risk";
import { isDomainMatch, normalizeDomain, isValidHttpUrl } from "@/utils/domain";
import {
  clearSingleCookie,
  createCookie as createCookieInStore,
  editCookie,
} from "@/entrypoints/background/services/cookie-mutations";
import { getAllCookies } from "@/utils/cleanup/cookie-ops";
import { logService } from "@/entrypoints/background/services/log-service";
import {
  reportBackgroundError,
  classifyError,
  isPermissionDeniedError,
} from "@/entrypoints/background/services/error-reporting";

export class CookiesHandler {
  async getCurrentTabCookies(): Promise<ApiResponse<{ cookies: Cookie[]; domain: string }>> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      let domain = "";
      if (tab?.url && isValidHttpUrl(tab.url)) {
        try {
          const url = new URL(tab.url);
          domain = url.hostname;
        } catch {
          domain = "";
        }
      }

      const allCookies = await getAllCookies();
      const currentCookiesList = domain
        ? allCookies.filter((c) => isDomainMatch(c.domain, domain))
        : [];

      return {
        success: true,
        data: {
          cookies: currentCookiesList.map((c) => ({
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path,
            secure: c.secure,
            httpOnly: c.httpOnly,
            sameSite: c.sameSite,
            expirationDate: c.expirationDate,
            storeId: c.storeId,
            partitionKey: c.partitionKey,
            firstPartyDomain: c.firstPartyDomain,
            hostOnly: c.hostOnly,
          })),
          domain,
        },
      };
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        const message = error instanceof Error ? error.message : String(error);
        reportBackgroundError(ErrorCode.INSUFFICIENT_PERMISSIONS, "getCurrentTabCookies", message, {
          recoverable: false,
          originalError: error,
        });
        return {
          success: false,
          error: { code: ErrorCode.INSUFFICIENT_PERMISSIONS, message },
        };
      }
      const report = classifyError(error, "getCurrentTabCookies");
      return {
        success: false,
        error: { code: report.code as ErrorCode, message: report.message },
      };
    }
  }

  async getStats(domain?: string): Promise<ApiResponse<CookieStats>> {
    try {
      const allCookies = await getAllCookies();
      const targetCookies = domain
        ? allCookies.filter((c) => isDomainMatch(c.domain, domain))
        : allCookies;

      const sessionCookies = targetCookies.filter((c) => !c.expirationDate);
      const persistentCookies = targetCookies.filter((c) => c.expirationDate);
      const thirdPartyCookies = domain
        ? targetCookies.filter((c) => isThirdPartyCookie(c.domain, domain))
        : [];
      const trackingCookies = targetCookies.filter((c) => isTrackingCookie(c));

      return {
        success: true,
        data: {
          total: allCookies.length,
          current: targetCookies.length,
          session: sessionCookies.length,
          persistent: persistentCookies.length,
          thirdParty: thirdPartyCookies.length,
          tracking: trackingCookies.length,
        },
      };
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        const message = error instanceof Error ? error.message : String(error);
        reportBackgroundError(ErrorCode.INSUFFICIENT_PERMISSIONS, "getStats", message, {
          domain,
          recoverable: false,
          originalError: error,
        });
        return {
          success: false,
          error: { code: ErrorCode.INSUFFICIENT_PERMISSIONS, message },
        };
      }
      const report = classifyError(error, "getStats", { domain });
      return {
        success: false,
        error: { code: report.code as ErrorCode, message: report.message },
      };
    }
  }

  async createCookie(cookie: Partial<Cookie>): Promise<ApiResponse<{ cookie: Cookie }>> {
    try {
      const createdCookie = await createCookieInStore(cookie as Partial<chrome.cookies.Cookie>);
      if (createdCookie) {
        return {
          success: true,
          data: {
            cookie: {
              name: createdCookie.name,
              value: createdCookie.value,
              domain: createdCookie.domain,
              path: createdCookie.path,
              secure: createdCookie.secure,
              httpOnly: createdCookie.httpOnly,
              sameSite: createdCookie.sameSite as Cookie["sameSite"],
              expirationDate: createdCookie.expirationDate,
              storeId: createdCookie.storeId,
              partitionKey: createdCookie.partitionKey,
              firstPartyDomain: createdCookie.firstPartyDomain,
              hostOnly: createdCookie.hostOnly,
            },
          },
        };
      }
      reportBackgroundError(
        ErrorCode.COOKIE_CREATE_FAILED,
        "createCookie",
        "Failed to create cookie",
        {
          domain: cookie.domain,
        }
      );
      return {
        success: false,
        error: { code: ErrorCode.COOKIE_CREATE_FAILED, message: "Failed to create cookie" },
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (isPermissionDeniedError(e)) {
        reportBackgroundError(ErrorCode.INSUFFICIENT_PERMISSIONS, "createCookie", message, {
          domain: cookie.domain,
          recoverable: false,
          originalError: e,
        });
        return {
          success: false,
          error: { code: ErrorCode.INSUFFICIENT_PERMISSIONS, message },
        };
      }
      const report = classifyError(e, "createCookie", { domain: cookie.domain });
      return {
        success: false,
        error: { code: report.code as ErrorCode, message: report.message },
      };
    }
  }

  async updateCookie(
    original: Cookie,
    updates: Partial<Cookie>
  ): Promise<ApiResponse<{ cookie: Cookie }>> {
    try {
      const updatedCookie = await editCookie(
        original as unknown as chrome.cookies.Cookie,
        updates as Partial<chrome.cookies.Cookie>
      );
      if (updatedCookie) {
        const domain = normalizeDomain(original.domain);
        try {
          await logService.logEdit(domain, 1, "Cookie updated");
        } catch (logError) {
          console.warn("Failed to write edit log:", logError);
        }
        return {
          success: true,
          data: {
            cookie: {
              name: updatedCookie.name,
              value: updatedCookie.value,
              domain: updatedCookie.domain,
              path: updatedCookie.path,
              secure: updatedCookie.secure,
              httpOnly: updatedCookie.httpOnly,
              sameSite: updatedCookie.sameSite as Cookie["sameSite"],
              expirationDate: updatedCookie.expirationDate,
              storeId: updatedCookie.storeId,
              partitionKey: updatedCookie.partitionKey,
              firstPartyDomain: updatedCookie.firstPartyDomain,
              hostOnly: updatedCookie.hostOnly,
            },
          },
        };
      }
      reportBackgroundError(
        ErrorCode.COOKIE_UPDATE_FAILED,
        "updateCookie",
        "Failed to update cookie",
        {
          domain: original.domain,
        }
      );
      return {
        success: false,
        error: { code: ErrorCode.COOKIE_UPDATE_FAILED, message: "Failed to update cookie" },
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (isPermissionDeniedError(e)) {
        reportBackgroundError(ErrorCode.INSUFFICIENT_PERMISSIONS, "updateCookie", message, {
          domain: original.domain,
          recoverable: false,
          originalError: e,
        });
        return {
          success: false,
          error: { code: ErrorCode.INSUFFICIENT_PERMISSIONS, message },
        };
      }
      const report = classifyError(e, "updateCookie", { domain: original.domain });
      return {
        success: false,
        error: { code: report.code as ErrorCode, message: report.message },
      };
    }
  }

  async deleteCookie(cookie: Cookie): Promise<ApiResponse> {
    try {
      const cleanedDomain = normalizeDomain(cookie.domain);
      await clearSingleCookie(cookie as unknown as chrome.cookies.Cookie, cleanedDomain);
      try {
        await logService.logDelete(cleanedDomain, 1, "Cookie deleted");
      } catch (logError) {
        console.warn("Failed to write delete log:", logError);
      }
      return { success: true };
    } catch (e) {
      if (e instanceof CookieRemoveError) {
        const message = e.message;
        switch (e.errorType) {
          case CookieRemoveErrorType.NOT_FOUND:
            reportBackgroundError(ErrorCode.COOKIE_REMOVE_FAILED, "deleteCookie", message, {
              domain: cookie.domain,
            });
            return {
              success: false,
              error: { code: ErrorCode.COOKIE_REMOVE_FAILED, message },
            };
          case CookieRemoveErrorType.PERMISSION_DENIED:
            reportBackgroundError(ErrorCode.INSUFFICIENT_PERMISSIONS, "deleteCookie", message, {
              domain: cookie.domain,
              recoverable: false,
              originalError: e.originalError,
            });
            return {
              success: false,
              error: { code: ErrorCode.INSUFFICIENT_PERMISSIONS, message },
            };
          case CookieRemoveErrorType.API_ERROR:
          default:
            reportBackgroundError(ErrorCode.COOKIE_REMOVE_FAILED, "deleteCookie", message, {
              domain: cookie.domain,
              originalError: e.originalError,
            });
            return {
              success: false,
              error: { code: ErrorCode.COOKIE_REMOVE_FAILED, message },
            };
        }
      }
      const message = e instanceof Error ? e.message : String(e);
      if (isPermissionDeniedError(e)) {
        reportBackgroundError(ErrorCode.INSUFFICIENT_PERMISSIONS, "deleteCookie", message, {
          domain: cookie.domain,
          recoverable: false,
          originalError: e,
        });
        return {
          success: false,
          error: { code: ErrorCode.INSUFFICIENT_PERMISSIONS, message },
        };
      }
      const report = classifyError(e, "deleteCookie", { domain: cookie.domain });
      return {
        success: false,
        error: { code: report.code as ErrorCode, message: report.message },
      };
    }
  }
}
