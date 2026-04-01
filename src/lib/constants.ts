import trackerData from "@/data/tracker-domains.json";
import type { TrackerData } from "@/data/tracker-domains.d.ts";
import { isValidHostname, isValidCookieKeyword } from "./cookie-data-validators.js";

export const MESSAGE_DURATION = 3000;

export const DEBOUNCE_DELAY_MS = 300;

export const ALARM_INTERVAL_MINUTES = 60;

export const SENSITIVE_COOKIE_KEYWORDS = ["session", "auth", "token", "jwt", "sid", "sessid"];

export const COOKIE_VALUE_MASK = "••••••••••••";

const DEFAULT_TRACKING_COOKIE_KEYWORDS = [
  "_ga",
  "_gid",
  "_gat",
  "utm_",
  "google_analytics",
  "fbp",
  "pixel",
  "track",
  "analytics",
  "ads",
  "advertising",
  "marketing",
  "conversion",
  "visitor",
  "unique",
  "identify",
  "guid",
  "uuid",
];

const DEFAULT_THIRD_PARTY_TRACKERS = [
  "doubleclick.net",
  "google-analytics.com",
  "googletagmanager.com",
  "facebook.net",
  "facebook.com",
  "hotjar.com",
  "hubspot.com",
  "segment.com",
  "mixpanel.com",
  "amplitude.com",
  "clickagy.com",
  "crazyegg.com",
  "optmstr.com",
];

function hasValidTrackerData(data: TrackerData): boolean {
  if (!Array.isArray(data.trackingDomains) || data.trackingDomains.length === 0) {
    return false;
  }

  if (!Array.isArray(data.trackingCookieKeywords) || data.trackingCookieKeywords.length === 0) {
    return false;
  }

  if (!data.lastUpdated || typeof data.lastUpdated !== "string") {
    return false;
  }

  if (!data.sources || typeof data.sources !== "object") {
    return false;
  }

  if (!data.sources.easyprivacy || typeof data.sources.easyprivacy !== "object") {
    return false;
  }

  if (!data.sources.disconnect || typeof data.sources.disconnect !== "object") {
    return false;
  }

  const allowedKeys = ["trackingDomains", "trackingCookieKeywords", "lastUpdated", "sources"];
  const actualKeys = Object.keys(data);
  for (const key of actualKeys) {
    if (!allowedKeys.includes(key)) {
      return false;
    }
  }
  for (const key of allowedKeys) {
    if (!actualKeys.includes(key)) {
      return false;
    }
  }

  // 全量校验：必须检查每个 trackingDomains 条目，不能只检查前 N 项
  // 即使数据量再大，也必须完整校验
  for (let i = 0; i < data.trackingDomains.length; i++) {
    const domain = data.trackingDomains[i];
    if (!isValidHostname(domain)) {
      return false;
    }
  }

  // 全量校验：必须检查每个 trackingCookieKeywords 条目，不能只检查前 N 项
  // 即使数据量再大，也必须完整校验
  for (let i = 0; i < data.trackingCookieKeywords.length; i++) {
    const keyword = data.trackingCookieKeywords[i];
    if (!isValidCookieKeyword(keyword)) {
      return false;
    }
  }

  return true;
}

export const TRACKING_COOKIE_KEYWORDS: string[] = hasValidTrackerData(trackerData)
  ? trackerData.trackingCookieKeywords
  : DEFAULT_TRACKING_COOKIE_KEYWORDS;

export const THIRD_PARTY_TRACKERS: string[] = hasValidTrackerData(trackerData)
  ? trackerData.trackingDomains
  : DEFAULT_THIRD_PARTY_TRACKERS;
