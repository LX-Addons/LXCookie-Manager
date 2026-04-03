export interface TrackerData {
  trackingDomains: string[];
  trackingCookieKeywords: string[];
  lastUpdated: string;
  sources: {
    easyprivacy: { count: number; version: string };
    peterlowe: { count: number; version: string };
  };
}
