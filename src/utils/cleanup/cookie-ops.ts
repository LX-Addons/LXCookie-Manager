import { CookieClearType } from "@/types";
import { toChromeSameSite } from "@/utils/format";

export interface ClearCookiesOptions {
  clearType?: CookieClearType;
  filterFn?: (domain: string) => boolean;
}

export interface ClearCookiesResult {
  count: number;
  clearedDomains: Set<string>;
}

export interface CookieRemoveResult {
  success: boolean;
  error?: string;
}

const shouldClearCookieByType = (
  cookie: chrome.cookies.Cookie,
  clearType: CookieClearType
): boolean => {
  const isSession = !cookie.expirationDate;
  if (clearType === CookieClearType.SESSION && !isSession) return false;
  if (clearType === CookieClearType.PERSISTENT && isSession) return false;
  return true;
};

const shouldClearCookieByFilter = (
  domain: string,
  filterFn?: (domain: string) => boolean
): boolean => {
  if (filterFn && !filterFn(domain)) return false;
  return true;
};

const buildCookieUrl = (cookie: chrome.cookies.Cookie, cleanedDomain: string): string => {
  return `http${cookie.secure ? "s" : ""}://${cleanedDomain}${cookie.path}`;
};

export const clearSingleCookie = async (
  cookie: chrome.cookies.Cookie,
  cleanedDomain: string
): Promise<CookieRemoveResult> => {
  try {
    const url = buildCookieUrl(cookie, cleanedDomain);
    const removeDetails: Parameters<typeof chrome.cookies.remove>[0] = {
      url,
      name: cookie.name,
    };
    if (cookie.storeId) {
      removeDetails.storeId = cookie.storeId;
    }
    if (cookie.partitionKey) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (removeDetails as any).partitionKey = cookie.partitionKey;
    }
    await chrome.cookies.remove(removeDetails);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
};

const buildCookieSetDetails = (
  cookie: chrome.cookies.Cookie
): { success: true; setDetails: chrome.cookies.SetDetails } | { success: false } => {
  if (!cookie.name || cookie.value == null || !cookie.domain) {
    return { success: false };
  }

  const sameSiteForChrome = toChromeSameSite(cookie.sameSite);
  const secure = cookie.secure ?? sameSiteForChrome === "no_restriction";

  const cleanedDomain = cookie.domain.replace(/^\./, "");
  const normalizedPath = cookie.path?.startsWith("/") ? cookie.path : `/${cookie.path ?? ""}`;
  const url = `http${secure ? "s" : ""}://${cleanedDomain}${normalizedPath}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setDetails: any = {
    url,
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: normalizedPath,
    secure,
    httpOnly: cookie.httpOnly ?? false,
  };

  if (sameSiteForChrome !== undefined) {
    setDetails.sameSite = sameSiteForChrome;
  }

  if (cookie.storeId) {
    setDetails.storeId = cookie.storeId;
  }

  if (cookie.expirationDate) {
    setDetails.expirationDate = cookie.expirationDate;
  }

  if (cookie.partitionKey) {
    setDetails.partitionKey = cookie.partitionKey;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((cookie as any).firstPartyDomain) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setDetails.firstPartyDomain = (cookie as any).firstPartyDomain;
  }

  return { success: true, setDetails };
};

export const createCookie = async (
  cookie: Partial<chrome.cookies.Cookie>
): Promise<chrome.cookies.Cookie | null> => {
  try {
    if (!cookie.name || !cookie.domain) {
      console.warn("createCookie: missing required fields (name or domain)");
      return null;
    }

    const fullCookie: chrome.cookies.Cookie = {
      ...cookie,
      path: cookie.path || "/",
    } as chrome.cookies.Cookie;

    const result = buildCookieSetDetails(fullCookie);
    if (!result.success) {
      return null;
    }

    const createdCookie = await chrome.cookies.set(result.setDetails);
    return createdCookie ?? null;
  } catch (e) {
    console.warn("Failed to create cookie:", e);
    return null;
  }
};

export const editCookie = async (
  originalCookie: chrome.cookies.Cookie,
  updates: Partial<chrome.cookies.Cookie>
): Promise<chrome.cookies.Cookie | null> => {
  try {
    const safeUpdates: Partial<chrome.cookies.Cookie> = {};

    if ("value" in updates) {
      safeUpdates.value = updates.value;
    }
    if ("httpOnly" in updates) {
      safeUpdates.httpOnly = updates.httpOnly;
    }
    if ("secure" in updates) {
      safeUpdates.secure = updates.secure;
    }
    if ("sameSite" in updates) {
      safeUpdates.sameSite = updates.sameSite;
    }
    if ("expirationDate" in updates) {
      safeUpdates.expirationDate = updates.expirationDate;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nextCookie: any = {
      ...originalCookie,
      ...safeUpdates,
    };

    if (originalCookie.partitionKey) {
      nextCookie.partitionKey = originalCookie.partitionKey;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((originalCookie as any).firstPartyDomain) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nextCookie.firstPartyDomain = (originalCookie as any).firstPartyDomain;
    }

    const result = buildCookieSetDetails(nextCookie);
    if (!result.success) {
      return null;
    }

    const updatedCookie = await chrome.cookies.set(result.setDetails);
    return updatedCookie ?? null;
  } catch (e) {
    console.warn("Failed to edit cookie:", e);
    return null;
  }
};

export const getAllCookies = async (): Promise<chrome.cookies.Cookie[]> => {
  return chrome.cookies.getAll({});
};

export const clearCookies = async (
  options: ClearCookiesOptions = {}
): Promise<ClearCookiesResult> => {
  const { clearType, filterFn } = options;
  const cookies = await chrome.cookies.getAll({});
  let count = 0;
  const clearedDomains = new Set<string>();

  for (const cookie of cookies) {
    const cleanedDomain = cookie.domain.replace(/^\./, "");

    if (!shouldClearCookieByFilter(cleanedDomain, filterFn)) continue;

    if (clearType && !shouldClearCookieByType(cookie, clearType)) continue;

    const result = await clearSingleCookie(cookie, cleanedDomain);
    if (result.success) {
      count++;
      clearedDomains.add(cleanedDomain);
    }
  }

  return { count, clearedDomains };
};

export const cleanupExpiredCookies = async (): Promise<number> => {
  const cookies = await getAllCookies();
  const now = Date.now();
  let count = 0;

  for (const cookie of cookies) {
    if (cookie.expirationDate && cookie.expirationDate * 1000 < now) {
      const cleanedDomain = cookie.domain.replace(/^\./, "");
      const result = await clearSingleCookie(cookie, cleanedDomain);
      if (result.success) {
        count++;
      }
    }
  }

  return count;
};
