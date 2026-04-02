import trackerData from "@/data/tracker-domains.json";
import type { TrackerData } from "@/data/tracker-domains.d.ts";
import { isValidHostname, isValidCookieKeyword } from "./cookie-data-validators";

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

function hasRequiredArrays(data: TrackerData): boolean {
  return (
    Array.isArray(data.trackingDomains) &&
    data.trackingDomains.length > 0 &&
    Array.isArray(data.trackingCookieKeywords) &&
    data.trackingCookieKeywords.length > 0
  );
}

function hasValidMetadata(data: TrackerData): boolean {
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

  if (
    typeof data.sources.easyprivacy.count !== "number" ||
    data.sources.easyprivacy.count < 0 ||
    typeof data.sources.easyprivacy.version !== "string" ||
    data.sources.easyprivacy.version.trim().length === 0
  ) {
    return false;
  }

  if (typeof data.sources.disconnect.count !== "number" || data.sources.disconnect.count < 0) {
    return false;
  }

  return true;
}

function hasExactKeys(data: TrackerData): boolean {
  const allowedKeys = ["trackingDomains", "trackingCookieKeywords", "lastUpdated", "sources"];
  const actualKeys = Object.keys(data);
  return (
    actualKeys.every((k) => allowedKeys.includes(k)) &&
    allowedKeys.every((k) => actualKeys.includes(k))
  );
}

function hasValidTrackerData(data: TrackerData): boolean {
  if (!hasRequiredArrays(data)) return false;
  if (!hasValidMetadata(data)) return false;
  if (!hasExactKeys(data)) return false;

  for (const domain of data.trackingDomains) {
    if (!isValidHostname(domain)) {
      return false;
    }
  }

  for (const keyword of data.trackingCookieKeywords) {
    if (!isValidCookieKeyword(keyword)) {
      return false;
    }
  }

  return true;
}

const trackerDataValid = hasValidTrackerData(trackerData);

export const TRACKING_COOKIE_KEYWORDS: string[] = trackerDataValid
  ? trackerData.trackingCookieKeywords
  : DEFAULT_TRACKING_COOKIE_KEYWORDS;

export const THIRD_PARTY_TRACKERS: string[] = trackerDataValid
  ? trackerData.trackingDomains
  : DEFAULT_THIRD_PARTY_TRACKERS;
