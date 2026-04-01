import { CookieRisk } from "@/types";
import {
  TRACKING_COOKIE_KEYWORDS,
  THIRD_PARTY_TRACKERS,
  SENSITIVE_COOKIE_KEYWORDS,
} from "@/lib/constants";
import { isCookieDomainMatch, normalizeDomain, isInList } from "./domain";

export const isTrackingCookie = (cookie: { name: string; domain: string }): boolean => {
  const lowerName = cookie.name.toLowerCase();

  if (TRACKING_COOKIE_KEYWORDS.some((keyword) => lowerName.includes(keyword))) {
    return true;
  }

  if (isInList(cookie.domain, THIRD_PARTY_TRACKERS)) {
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
  return !isCookieDomainMatch(normalizedCookie, normalizedCurrent);
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
  if (!isSecure) {
    reasons.push(getReason("notSecure"));
  }

  const separator = t ? t("common.listSeparator") : "、";
  return {
    level: riskLevel,
    reason: reasons.length > 0 ? reasons.join(separator) : getReason("lowRisk"),
    isTracking,
    isThirdParty,
  };
};
