import { createCookie as createCookieUtil } from "@/utils/cleanup/cookie-ops";
import { classifyError } from "./error-reporting";
import { metricsService } from "./metrics";

export const createCookie = async (
  cookie: Partial<chrome.cookies.Cookie>
): Promise<chrome.cookies.Cookie> => {
  const startTime = Date.now();
  let success = false;
  let errorCode: string | undefined;
  let created: chrome.cookies.Cookie | undefined;

  try {
    created = await createCookieUtil(cookie);
    success = true;
  } catch (e) {
    const report = classifyError(e, "cookie create", {
      domain: cookie.domain,
    });
    errorCode = report.code;
    throw e;
  } finally {
    const durationMs = Date.now() - startTime;
    try {
      metricsService.recordCookieMutation("createCookie", success, durationMs, {
        domain: cookie.domain,
        errorCode,
        metadata: { cookieName: cookie.name },
      });
    } catch (metricsError) {
      console.warn("Failed to record createCookie metrics:", metricsError);
    }
  }

  if (!created) {
    throw new Error("Cookie creation failed");
  }
  return created;
};
