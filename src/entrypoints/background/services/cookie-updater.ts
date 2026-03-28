import { editCookie as editCookieUtil } from "@/utils/cleanup/cookie-ops";
import { classifyError } from "./error-reporting";
import { metricsService } from "./metrics";

export const editCookie = async (
  originalCookie: chrome.cookies.Cookie,
  updates: Partial<chrome.cookies.Cookie>
): Promise<chrome.cookies.Cookie> => {
  const startTime = Date.now();
  let success = false;
  let errorCode: string | undefined;
  let result: chrome.cookies.Cookie;

  try {
    result = await editCookieUtil(originalCookie, updates);
    success = true;
  } catch (e) {
    const report = classifyError(e, "cookie update", {
      domain: originalCookie.domain,
    });
    errorCode = report.code;
    throw e;
  } finally {
    const durationMs = Date.now() - startTime;
    try {
      metricsService.recordCookieMutation("editCookie", success, durationMs, {
        domain: originalCookie.domain,
        errorCode,
        metadata: { cookieName: originalCookie.name },
      });
    } catch (metricsError) {
      console.warn("Failed to record editCookie metrics:", metricsError);
    }
  }

  return result;
};
