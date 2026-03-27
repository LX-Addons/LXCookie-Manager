import { createCookie as createCookieUtil } from "@/utils/cleanup/cookie-ops";
import { classifyError } from "./error-reporting";
import { metricsService } from "./metrics";

export const createCookie = async (
  cookie: Partial<chrome.cookies.Cookie>
): Promise<chrome.cookies.Cookie> => {
  const startTime = Date.now();
  let success = false;
  let errorCode: string | undefined;

  try {
    const created = await createCookieUtil(cookie);
    success = true;

    const durationMs = Date.now() - startTime;
    metricsService.recordCookieMutation("createCookie", success, durationMs, {
      domain: cookie.domain,
      errorCode,
      metadata: { cookieName: cookie.name },
    });

    return created;
  } catch (e) {
    const report = classifyError(e, "cookie create", {
      domain: cookie.domain,
    });
    errorCode = report.code;

    const durationMs = Date.now() - startTime;
    metricsService.recordCookieMutation("createCookie", success, durationMs, {
      domain: cookie.domain,
      errorCode,
      metadata: { cookieName: cookie.name },
    });

    throw e;
  }
};
