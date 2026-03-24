import { editCookie as editCookieUtil } from "@/utils/cleanup/cookie-ops";
import { classifyError } from "./error-reporting";
import { metricsService } from "./metrics";

export const editCookie = async (
  originalCookie: chrome.cookies.Cookie,
  updates: Partial<chrome.cookies.Cookie>
): Promise<chrome.cookies.Cookie | null> => {
  const startTime = Date.now();
  let success = false;
  let errorCode: string | undefined;
  let result: chrome.cookies.Cookie | null = null;

  try {
    result = await editCookieUtil(originalCookie, updates);
    success = result !== null;
    return result;
  } catch (e) {
    const report = classifyError(e, "cookie update", {
      domain: originalCookie.domain,
    });
    errorCode = report.code;
    return null;
  } finally {
    const durationMs = Date.now() - startTime;
    metricsService.recordCookieMutation("editCookie", success, durationMs, {
      domain: originalCookie.domain,
      errorCode,
      metadata: { cookieName: originalCookie.name },
    });
  }
};
