import { describe, it, expect } from "vitest";
import {
  MESSAGE_DURATION,
  DEBOUNCE_DELAY_MS,
  ALARM_INTERVAL_MINUTES,
  SENSITIVE_COOKIE_KEYWORDS,
  COOKIE_VALUE_MASK,
  TRACKING_COOKIE_KEYWORDS,
  THIRD_PARTY_TRACKERS,
} from "@/lib/constants";

describe("constants", () => {
  describe("MESSAGE_DURATION", () => {
    it("should be 3000 milliseconds", () => {
      expect(MESSAGE_DURATION).toBe(3000);
    });
  });

  describe("DEBOUNCE_DELAY_MS", () => {
    it("should be 300 milliseconds", () => {
      expect(DEBOUNCE_DELAY_MS).toBe(300);
    });
  });

  describe("ALARM_INTERVAL_MINUTES", () => {
    it("should be 60 minutes", () => {
      expect(ALARM_INTERVAL_MINUTES).toBe(60);
    });
  });

  describe("SENSITIVE_COOKIE_KEYWORDS", () => {
    it("should contain expected keywords", () => {
      expect(SENSITIVE_COOKIE_KEYWORDS).toContain("session");
      expect(SENSITIVE_COOKIE_KEYWORDS).toContain("auth");
      expect(SENSITIVE_COOKIE_KEYWORDS).toContain("token");
      expect(SENSITIVE_COOKIE_KEYWORDS).toContain("jwt");
      expect(SENSITIVE_COOKIE_KEYWORDS).toContain("sid");
      expect(SENSITIVE_COOKIE_KEYWORDS).toContain("sessid");
    });

    it("should have 6 keywords", () => {
      expect(SENSITIVE_COOKIE_KEYWORDS).toHaveLength(6);
    });
  });

  describe("COOKIE_VALUE_MASK", () => {
    it("should be a mask string", () => {
      expect(COOKIE_VALUE_MASK).toBe("••••••••••••");
    });

    it("should have correct length", () => {
      expect(COOKIE_VALUE_MASK.length).toBe(12);
    });
  });

  describe("TRACKING_COOKIE_KEYWORDS", () => {
    it("should contain common tracking keywords", () => {
      expect(TRACKING_COOKIE_KEYWORDS).toContain("_ga");
      expect(TRACKING_COOKIE_KEYWORDS).toContain("_gid");
      expect(TRACKING_COOKIE_KEYWORDS).toContain("utm_");
      expect(TRACKING_COOKIE_KEYWORDS).toContain("fbp");
      expect(TRACKING_COOKIE_KEYWORDS).toContain("analytics");
    });

    it("should be an array", () => {
      expect(Array.isArray(TRACKING_COOKIE_KEYWORDS)).toBe(true);
    });

    it("should not be empty", () => {
      expect(TRACKING_COOKIE_KEYWORDS.length).toBeGreaterThan(0);
    });
  });

  describe("THIRD_PARTY_TRACKERS", () => {
    it("should contain common tracker domains", () => {
      expect(THIRD_PARTY_TRACKERS).toContain("doubleclick.net");
      expect(THIRD_PARTY_TRACKERS).toContain("google-analytics.com");
      expect(THIRD_PARTY_TRACKERS).toContain("facebook.net");
      expect(THIRD_PARTY_TRACKERS).toContain("hotjar.com");
    });

    it("should be an array", () => {
      expect(Array.isArray(THIRD_PARTY_TRACKERS)).toBe(true);
    });

    it("should not be empty", () => {
      expect(THIRD_PARTY_TRACKERS.length).toBeGreaterThan(0);
    });
  });
});
