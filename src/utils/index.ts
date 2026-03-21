import { CookieClearType, CookieRisk } from "@/types";
import {
  TRACKING_COOKIE_KEYWORDS,
  THIRD_PARTY_TRACKERS,
  SENSITIVE_COOKIE_KEYWORDS,
} from "@/lib/constants";

export const normalizeDomain = (domain: string): string => {
  return domain.replace(/^\./, "").toLowerCase();
};

export const isDomainMatch = (cookieDomain: string, targetDomain: string): boolean => {
  const normalizedCookie = normalizeDomain(cookieDomain);
  const normalizedTarget = normalizeDomain(targetDomain);

  if (normalizedCookie === normalizedTarget) return true;
  if (normalizedTarget.endsWith("." + normalizedCookie)) return true;
  if (normalizedCookie.endsWith("." + normalizedTarget)) return true;

  return false;
};

export const isInList = (domain: string, list: string[]): boolean => {
  const normalizedDomain = normalizeDomain(domain);
  return list.some((item) => {
    const normalizedItem = normalizeDomain(item);
    return normalizedDomain === normalizedItem || normalizedDomain.endsWith("." + normalizedItem);
  });
};

export const getCookieTypeName = (type: string, t?: (key: string) => string): string => {
  if (t) {
    switch (type) {
      case "session":
        return t("cookieTypes.session");
      case "persistent":
        return t("cookieTypes.persistent");
      default:
        return t("cookieTypes.all");
    }
  }
  switch (type) {
    case "session":
      return "会话Cookie";
    case "persistent":
      return "持久Cookie";
    default:
      return "所有Cookie";
  }
};

export const buildOrigins = (domains: Set<string>): string[] => {
  return [...domains].flatMap((d) => [`https://${d}`, `http://${d}`]);
};

/**
 * 构建非空的 origins 数组，用于 chrome.browsingData.remove
 * 如果 domains 为空，返回 null 表示不需要执行清理操作
 */
export const buildNonEmptyOrigins = (domains: Set<string>): [string, ...string[]] | null => {
  if (domains.size === 0) {
    return null;
  }
  const origins = buildOrigins(domains);
  if (origins.length === 0) {
    return null;
  }
  return origins as [string, ...string[]];
};

export const buildDomainString = (
  clearedDomains: Set<string>,
  successMsg: string,
  currentDomain: string,
  t: (path: string, params?: Record<string, string | number>) => string
): string => {
  if (clearedDomains.size === 1) {
    return Array.from(clearedDomains)[0];
  }
  if (clearedDomains.size > 1) {
    return t("common.domains", {
      domain: Array.from(clearedDomains)[0],
      count: clearedDomains.size,
    });
  }
  return successMsg.includes(t("common.allWebsites")) ? t("common.allWebsites") : currentDomain;
};

export const isTrackingCookie = (cookie: { name: string; domain: string }): boolean => {
  const lowerName = cookie.name.toLowerCase();
  const lowerDomain = cookie.domain.toLowerCase();

  if (TRACKING_COOKIE_KEYWORDS.some((keyword) => lowerName.includes(keyword))) {
    return true;
  }

  if (THIRD_PARTY_TRACKERS.some((tracker) => lowerDomain.includes(tracker))) {
    return true;
  }

  return false;
};

export const isSensitiveCookie = (cookie: { name: string }): boolean => {
  const lowerName = cookie.name.toLowerCase();
  return SENSITIVE_COOKIE_KEYWORDS.some((keyword) => lowerName.includes(keyword));
};

export const isThirdPartyCookie = (cookieDomain: string, currentDomain?: string): boolean => {
  if (!currentDomain) return false;
  const normalizedCookie = normalizeDomain(cookieDomain);
  const normalizedCurrent = normalizeDomain(currentDomain);
  return !isDomainMatch(normalizedCookie, normalizedCurrent);
};

const buildRiskReason = (t?: (key: string) => string): ((reasonKey: string) => string) => {
  return (reasonKey: string) => {
    const reasonMap: Record<string, string> = {
      tracking: t ? t("cookieList.trackingCookie") : "疑似追踪 Cookie",
      thirdParty: t ? t("cookieList.thirdPartyCookie") : "第三方 Cookie",
      notHttpOnly: t ? t("cookieList.notHttpOnly") : "非 HttpOnly（可被 JavaScript 访问）",
      notSecure: t ? t("cookieList.notSecure") : "非 Secure（可能在不安全连接中传输）",
      lowRisk: t ? t("cookieList.lowRisk") : "低风险",
    };
    return reasonMap[reasonKey] || reasonKey;
  };
};

const determineRiskLevel = (
  isTracking: boolean,
  isThirdParty: boolean,
  isHttpOnly: boolean,
  isSecure: boolean
): "low" | "medium" | "high" => {
  if (isTracking) return "high";

  if (!isHttpOnly || !isSecure || isThirdParty) return "medium";

  return "low";
};

export const assessCookieRisk = (
  cookie: { name: string; domain: string; httpOnly: boolean; secure?: boolean },
  currentDomain?: string,
  t?: (key: string) => string
): CookieRisk => {
  const getReason = buildRiskReason(t);
  const isTracking = isTrackingCookie(cookie);
  const isThirdParty = isThirdPartyCookie(cookie.domain, currentDomain);
  const isHttpOnly = cookie.httpOnly;
  const isSecure = cookie.secure ?? false;

  const riskLevel = determineRiskLevel(isTracking, isThirdParty, isHttpOnly, isSecure);

  const reasons: string[] = [];
  if (isTracking) {
    reasons.push(getReason("tracking"));
  }
  if (isThirdParty) {
    reasons.push(getReason("thirdParty"));
  }
  if (!isHttpOnly) {
    reasons.push(getReason("notHttpOnly"));
  }
  if (!isSecure && cookie.domain.startsWith(".")) {
    reasons.push(getReason("notSecure"));
  }

  return {
    level: riskLevel,
    reason: reasons.length > 0 ? reasons.join("、") : getReason("lowRisk"),
    isTracking,
    isThirdParty,
  };
};

export const getRiskLevelColor = (level: string): string => {
  switch (level) {
    case "high":
      return "#ef4444";
    case "medium":
      return "#f59e0b";
    default:
      return "#22c55e";
  }
};

export const getRiskLevelText = (level: string, t?: (key: string) => string): string => {
  if (t) {
    switch (level) {
      case "high":
        return t("cookieList.highRisk");
      case "medium":
        return t("cookieList.mediumRisk");
      default:
        return t("cookieList.lowRisk");
    }
  }
  switch (level) {
    case "high":
      return "高风险";
    case "medium":
      return "中风险";
    default:
      return "低风险";
  }
};

export interface ClearBrowserDataOptions {
  clearCache?: boolean;
  clearLocalStorage?: boolean;
  clearIndexedDB?: boolean;
}

export interface ClearCookiesOptions {
  clearType?: CookieClearType;
  filterFn?: (domain: string) => boolean;
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
): Promise<boolean> => {
  try {
    const url = buildCookieUrl(cookie, cleanedDomain);
    const removeDetails: CookieRemoveDetails = {
      url,
      name: cookie.name,
    };
    if (cookie.storeId) {
      removeDetails.storeId = cookie.storeId;
    }
    await chrome.cookies.remove(removeDetails);
    return true;
  } catch (e) {
    console.error(`Failed to clear cookie ${cookie.name}:`, e);
    return false;
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

  if (sameSiteForChrome === "no_restriction" && !secure) {
    console.error("SameSite=None requires Secure flag");
    return { success: false };
  }

  const cleanedDomain = cookie.domain.replace(/^\./, "");
  const normalizedPath = cookie.path?.startsWith("/") ? cookie.path : `/${cookie.path ?? ""}`;
  const url = `http${secure ? "s" : ""}://${cleanedDomain}${normalizedPath}`;

  const setDetails: chrome.cookies.SetDetails = {
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

  return { success: true, setDetails };
};

export const createCookie = async (cookie: Partial<chrome.cookies.Cookie>): Promise<boolean> => {
  try {
    const fullCookie: chrome.cookies.Cookie = {
      ...cookie,
      path: cookie.path || "/",
    } as chrome.cookies.Cookie;

    const result = buildCookieSetDetails(fullCookie);
    if (!result.success) {
      return false;
    }

    await chrome.cookies.set(result.setDetails);
    return true;
  } catch (e) {
    console.error("Failed to create cookie:", e);
    return false;
  }
};

export const editCookie = async (
  originalCookie: chrome.cookies.Cookie,
  updates: Partial<chrome.cookies.Cookie>
): Promise<boolean> => {
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

    const nextCookie = {
      ...originalCookie,
      ...safeUpdates,
    };

    const result = buildCookieSetDetails(nextCookie);
    if (!result.success) {
      return false;
    }

    await chrome.cookies.set(result.setDetails);
    return true;
  } catch (e) {
    console.error("Failed to edit cookie:", e);
    return false;
  }
};

export const clearCookies = async (options: ClearCookiesOptions = {}) => {
  const { clearType, filterFn } = options;
  const cookies = await chrome.cookies.getAll({});
  let count = 0;
  const clearedDomains = new Set<string>();

  for (const cookie of cookies) {
    const cleanedDomain = cookie.domain.replace(/^\./, "");

    if (!shouldClearCookieByFilter(cleanedDomain, filterFn)) continue;

    if (clearType && !shouldClearCookieByType(cookie, clearType)) continue;

    const cleared = await clearSingleCookie(cookie, cleanedDomain);
    if (cleared) {
      count++;
      clearedDomains.add(cleanedDomain);
    }
  }

  return { count, clearedDomains };
};

export const clearBrowserData = async (domains: Set<string>, options: ClearBrowserDataOptions) => {
  const { clearCache, clearLocalStorage, clearIndexedDB } = options;
  const origins = buildNonEmptyOrigins(domains);

  if (clearCache) {
    try {
      if (origins) {
        await chrome.browsingData.remove(
          { origins },
          {
            cacheStorage: true,
            fileSystems: true,
            serviceWorkers: true,
          }
        );
      }
    } catch (e) {
      console.error("Failed to clear cache:", e);
    }
  }

  if (clearLocalStorage) {
    try {
      if (origins) {
        await chrome.browsingData.remove(
          { origins },
          {
            localStorage: true,
          }
        );
      }
    } catch (e) {
      console.error("Failed to clear localStorage:", e);
    }
  }

  if (clearIndexedDB) {
    try {
      if (origins) {
        await chrome.browsingData.remove(
          { origins },
          {
            indexedDB: true,
          }
        );
      }
    } catch (e) {
      console.error("Failed to clear IndexedDB:", e);
    }
  }
};

export const getActionText = (action: string, t?: (key: string) => string): string => {
  if (t) {
    switch (action) {
      case "clear":
        return t("actions.clear");
      case "edit":
        return t("actions.edit");
      case "delete":
        return t("actions.delete");
      case "import":
        return t("actions.import");
      case "export":
        return t("actions.export");
      default:
        return t("actions.action");
    }
  }
  switch (action) {
    case "clear":
      return "清除";
    case "edit":
      return "编辑";
    case "delete":
      return "删除";
    case "import":
      return "导入";
    case "export":
      return "导出";
    default:
      return "操作";
  }
};

export const getActionColor = (action: string): string => {
  switch (action) {
    case "clear":
      return "#3b82f6";
    case "edit":
      return "#f59e0b";
    case "delete":
      return "#ef4444";
    case "import":
      return "#22c55e";
    case "export":
      return "#8b5cf6";
    default:
      return "#64748b";
  }
};

export const formatLogTime = (timestamp: number, locale: string = "zh-CN"): string => {
  const date = new Date(timestamp);
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export type CookieRemoveDetails = Parameters<typeof chrome.cookies.remove>[0];

export const maskCookieValue = (value: string, mask: string): string => {
  if (!value || value.length === 0) return mask;
  if (value.length <= 8) return mask;
  return value.slice(0, 4) + mask.substring(4);
};

export const getCookieKey = (
  name: string,
  domain: string,
  path?: string,
  storeId?: string
): string => {
  return `${name}|${domain}|${path ?? "/"}|${storeId ?? "0"}`;
};

export const toggleSetValue = (set: Set<string>, value: string): Set<string> => {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
};

export const fromChromeSameSite = (sameSite?: string): string => {
  if (sameSite === "no_restriction") {
    return "none";
  }
  return sameSite || "unspecified";
};

export const toChromeSameSite = (
  sameSite?: string
): "no_restriction" | "lax" | "strict" | undefined => {
  if (sameSite === "none" || sameSite === "no_restriction") {
    return "no_restriction";
  }
  if (sameSite === "unspecified" || !sameSite) {
    return undefined;
  }
  if (sameSite === "lax" || sameSite === "strict") {
    return sameSite;
  }
  return undefined;
};

export const formatCookieSameSite = (
  sameSite: string | undefined,
  t: (key: string) => string
): string => {
  const normalized = fromChromeSameSite(sameSite);
  if (normalized === "unspecified" || !normalized) {
    return t("cookieList.notSet");
  }
  if (normalized === "strict") {
    return t("cookieEditor.strict");
  }
  if (normalized === "lax") {
    return t("cookieEditor.lax");
  }
  if (normalized === "none") {
    return t("cookieEditor.none");
  }
  return normalized;
};

export const validateDomain = (
  domain: string,
  t?: (key: string) => string
): { valid: boolean; message?: string } => {
  const trimmed = domain.trim();
  if (!trimmed) {
    return { valid: false, message: t ? t("domainManager.domainEmpty") : "域名不能为空" };
  }
  if (
    !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(
      trimmed
    )
  ) {
    return { valid: false, message: t ? t("domainManager.invalidDomain") : "域名格式不正确" };
  }
  return { valid: true };
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: Number.parseInt(result[1], 16),
      g: Number.parseInt(result[2], 16),
      b: Number.parseInt(result[3], 16),
    };
  }
  return null;
};

const rgbToHex = (r: number, g: number, b: number): string => {
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
};

export const adjustColorBrightness = (hex: string, amount: number): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(rgb.r + amount, rgb.g + amount, rgb.b + amount);
};

export const getHoverColor = (hex: string): string => adjustColorBrightness(hex, -15);
export const getActiveColor = (hex: string): string => adjustColorBrightness(hex, -30);
