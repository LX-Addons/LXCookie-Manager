import trackerData from "@/data/tracker-domains.json";
import type { TrackerData } from "@/data/tracker-domains.d.ts";
import { isValidHostname, isValidCookieKeyword } from "./cookie-data-validators";
import { normalizeDomain } from "@/utils/domain";

export const MESSAGE_DURATION = 3000;

export const DEBOUNCE_DELAY_MS = 300;

export const ALARM_INTERVAL_MINUTES = 60;

export const EDITABLE_COOKIE_FIELDS = [
  "value",
  "httpOnly",
  "secure",
  "sameSite",
  "expirationDate",
] as const;

export const EDITABLE_COOKIE_FIELDS_SET = new Set(EDITABLE_COOKIE_FIELDS);

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

  const lastUpdatedDate = new Date(data.lastUpdated);
  if (Number.isNaN(lastUpdatedDate.getTime())) {
    return false;
  }

  if (!data.sources || typeof data.sources !== "object") {
    return false;
  }

  if (!data.sources.easyprivacy || typeof data.sources.easyprivacy !== "object") {
    return false;
  }

  if (!data.sources.peterlowe || typeof data.sources.peterlowe !== "object") {
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

  if (
    typeof data.sources.peterlowe.count !== "number" ||
    data.sources.peterlowe.count < 0 ||
    typeof data.sources.peterlowe.version !== "string" ||
    data.sources.peterlowe.version.trim().length === 0
  ) {
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

const SAMPLE_SIZE = 100;
const FULL_VALIDATION_THRESHOLD = 1000;

function sampleValidateArray<T>(array: T[], validator: (item: T) => boolean): boolean {
  if (array.length <= FULL_VALIDATION_THRESHOLD) {
    return array.every(validator);
  }

  const midStart = Math.floor(array.length / 2) - Math.floor(SAMPLE_SIZE / 2);
  for (let i = 0; i < SAMPLE_SIZE; i++) {
    if (!validator(array[i])) return false;
    if (!validator(array[midStart + i])) return false;
    if (!validator(array[array.length - SAMPLE_SIZE + i])) return false;
  }
  return true;
}

function hasValidTrackerData(data: TrackerData): boolean {
  if (!hasRequiredArrays(data)) return false;
  if (!hasValidMetadata(data)) return false;
  if (!hasExactKeys(data)) return false;

  if (!sampleValidateArray(data.trackingDomains, isValidHostname)) {
    return false;
  }

  if (!sampleValidateArray(data.trackingCookieKeywords, isValidCookieKeyword)) {
    return false;
  }

  return true;
}

const trackerDataValid = hasValidTrackerData(trackerData);

export const TRACKING_COOKIE_KEYWORDS_SET: Set<string> = trackerDataValid
  ? new Set(trackerData.trackingCookieKeywords.map((k) => k.toLowerCase()))
  : new Set(DEFAULT_TRACKING_COOKIE_KEYWORDS);

export const THIRD_PARTY_TRACKERS_SET: Set<string> = trackerDataValid
  ? new Set(trackerData.trackingDomains.map(normalizeDomain))
  : new Set(DEFAULT_THIRD_PARTY_TRACKERS.map(normalizeDomain));

export const TRACKING_COOKIE_KEYWORDS: string[] = trackerDataValid
  ? trackerData.trackingCookieKeywords
  : DEFAULT_TRACKING_COOKIE_KEYWORDS;

export const THIRD_PARTY_TRACKERS: string[] = trackerDataValid
  ? trackerData.trackingDomains
  : DEFAULT_THIRD_PARTY_TRACKERS;
