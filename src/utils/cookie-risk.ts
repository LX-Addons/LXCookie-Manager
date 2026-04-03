import type { CookieRisk, CookieRiskFactors, RiskLevel, SameSite } from "@/types";
import {
  TRACKING_COOKIE_KEYWORDS_SET,
  THIRD_PARTY_TRACKERS_SET,
  SENSITIVE_COOKIE_KEYWORDS,
} from "@/lib/constants";
import { isCookieDomainMatch, isInSet } from "./domain";

const LONG_LIFETIME_DAYS = 90;

export const isTrackingCookie = (cookie: { name: string; domain: string }): boolean => {
  const lowerName = cookie.name.toLowerCase();

  for (const keyword of TRACKING_COOKIE_KEYWORDS_SET) {
    if (lowerName.includes(keyword)) {
      return true;
    }
  }

  if (isInSet(cookie.domain, THIRD_PARTY_TRACKERS_SET)) {
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
  return !isCookieDomainMatch(cookieDomain, currentDomain);
};

export const hasLongLifetime = (cookie: { expirationDate?: number }): boolean => {
  if (!cookie.expirationDate) return false;
  const now = Date.now() / 1000;
  const lifetimeDays = (cookie.expirationDate - now) / 86400;
  return lifetimeDays > LONG_LIFETIME_DAYS;
};

export const isSessionCookie = (cookie: {
  session?: boolean;
  expirationDate?: number;
}): boolean => {
  if (cookie.session === true) return true;
  if (!cookie.expirationDate) return true;
  return false;
};

const RISK_SCORES = {
  tracking: 40,
  sensitive: 25,
  thirdParty: 15,
  notHttpOnly: 12,
  notSecure: 10,
  sameSiteNone: 8,
  longLifetime: 8,
  sessionCookie: -5,
};

const calculateRiskScore = (factors: CookieRiskFactors): number => {
  let score = 0;

  if (factors.isTracking) score += RISK_SCORES.tracking;
  if (factors.isSensitive) score += RISK_SCORES.sensitive;
  if (factors.isThirdParty) score += RISK_SCORES.thirdParty;
  if (factors.notHttpOnly) score += RISK_SCORES.notHttpOnly;
  if (factors.notSecure) score += RISK_SCORES.notSecure;
  if (factors.sameSiteNone) score += RISK_SCORES.sameSiteNone;
  if (factors.longLifetime) score += RISK_SCORES.longLifetime;
  if (factors.sessionCookie) score += RISK_SCORES.sessionCookie;

  return Math.max(0, Math.min(100, score));
};

const scoreToRiskLevel = (score: number): RiskLevel => {
  if (score >= 60) return "critical";
  if (score >= 40) return "high";
  if (score >= 20) return "medium";
  return "low";
};

const buildRiskReason = (t?: (key: string) => string): ((reasonKey: string) => string) => {
  return (reasonKey: string) => {
    const reasonMap: Record<string, string> = {
      tracking: t ? t("cookieList.trackingCookie") : "疑似追踪 Cookie",
      thirdParty: t ? t("cookieList.thirdPartyCookie") : "第三方 Cookie",
      sensitive: t ? t("cookieList.sensitiveCookie") : "敏感 Cookie",
      notHttpOnly: t ? t("cookieList.notHttpOnly") : "非 HttpOnly（可被 JavaScript 访问）",
      notSecure: t ? t("cookieList.notSecure") : "非 Secure（可能在不安全连接中传输）",
      sameSiteNone: t ? t("cookieList.sameSiteNone") : "SameSite=None（允许跨站发送）",
      longLifetime: t ? t("cookieList.longLifetime") : "长期有效（超过 90 天）",
      lowRisk: t ? t("cookieList.lowRisk") : "低风险",
    };
    return reasonMap[reasonKey] || reasonKey;
  };
};

const buildReasons = (factors: CookieRiskFactors, getReason: (key: string) => string): string[] => {
  const reasons: string[] = [];

  if (factors.isTracking) reasons.push(getReason("tracking"));
  if (factors.isSensitive) reasons.push(getReason("sensitive"));
  if (factors.isThirdParty) reasons.push(getReason("thirdParty"));
  if (factors.notHttpOnly) reasons.push(getReason("notHttpOnly"));
  if (factors.notSecure) reasons.push(getReason("notSecure"));
  if (factors.sameSiteNone) reasons.push(getReason("sameSiteNone"));
  if (factors.longLifetime) reasons.push(getReason("longLifetime"));

  return reasons;
};

export interface CookieForRiskAssessment {
  name: string;
  domain: string;
  httpOnly: boolean;
  secure?: boolean;
  sameSite?: SameSite;
  session?: boolean;
  expirationDate?: number;
}

export const assessCookieRisk = (
  cookie: CookieForRiskAssessment,
  currentDomain?: string,
  t?: (key: string) => string
): CookieRisk => {
  const getReason = buildRiskReason(t);

  const factors: CookieRiskFactors = {
    isTracking: isTrackingCookie(cookie),
    isThirdParty: isThirdPartyCookie(cookie.domain, currentDomain),
    isSensitive: isSensitiveCookie(cookie),
    notHttpOnly: !cookie.httpOnly,
    notSecure: !cookie.secure,
    sameSiteNone: cookie.sameSite === "no_restriction" || cookie.sameSite === "none",
    longLifetime: hasLongLifetime(cookie),
    sessionCookie: isSessionCookie(cookie),
  };

  const score = calculateRiskScore(factors);
  const level = scoreToRiskLevel(score);
  const reasons = buildReasons(factors, getReason);

  const separator = t ? t("common.listSeparator") : "、";
  return {
    level,
    score,
    reason: reasons.length > 0 ? reasons.join(separator) : getReason("lowRisk"),
    factors,
  };
};
