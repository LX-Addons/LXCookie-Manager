import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  setLocale,
  getLocale,
  detectBrowserLocale,
  t,
  getTranslations,
  getAllLocales,
} from "@/i18n";

describe("i18n", () => {
  beforeEach(() => {
    setLocale("zh-CN");
  });

  describe("setLocale and getLocale", () => {
    it("should set and get locale correctly", () => {
      expect(getLocale()).toBe("zh-CN");
      setLocale("en-US");
      expect(getLocale()).toBe("en-US");
    });
  });

  describe("detectBrowserLocale", () => {
    it("should detect Chinese locale", () => {
      vi.stubGlobal("navigator", { language: "zh-CN" });
      expect(detectBrowserLocale()).toBe("zh-CN");
    });

    it("should detect English locale for non-Chinese languages", () => {
      vi.stubGlobal("navigator", { language: "en-US" });
      expect(detectBrowserLocale()).toBe("en-US");
    });

    it("should fall back to userLanguage if language not available", () => {
      vi.stubGlobal("navigator", { userLanguage: "zh-CN" } as Navigator & {
        userLanguage?: string;
      });
      expect(detectBrowserLocale()).toBe("zh-CN");
    });

    it("should default to English if no language info", () => {
      vi.stubGlobal("navigator", {});
      expect(detectBrowserLocale()).toBe("en-US");
    });
  });

  describe("translation function t", () => {
    it("should return translation for valid key", () => {
      setLocale("zh-CN");
      const result = t("common.save");
      expect(typeof result).toBe("string");
    });

    it("should handle nested keys", () => {
      setLocale("zh-CN");
      const result = t("cookieTypes.session");
      expect(typeof result).toBe("string");
    });

    it("should return key when translation not found", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = t("nonexistent.key");
      expect(result).toBe("nonexistent.key");
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should return key when value is not a string", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = t("common");
      expect(result).toBe("common");
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should replace parameters in translation", () => {
      setLocale("zh-CN");
      const testKey = "common.domains";
      const result = t(testKey, { domain: "example.com", count: 5 });
      expect(typeof result).toBe("string");
      expect(result).toContain("example.com");
      expect(result).toContain("5");
    });

    it("should handle missing parameters gracefully", () => {
      setLocale("zh-CN");
      const testKey = "common.domains";
      const result = t(testKey, { domain: "example.com" });
      expect(typeof result).toBe("string");
      expect(result).toContain("{count}");
    });
  });

  describe("getTranslations", () => {
    it("should return current translations", () => {
      setLocale("zh-CN");
      const translations = getTranslations();
      expect(translations).toBeDefined();
      expect(typeof translations).toBe("object");
    });

    it("should return English translations when locale is en-US", () => {
      setLocale("en-US");
      const translations = getTranslations();
      expect(translations).toBeDefined();
      expect(typeof translations).toBe("object");
    });
  });

  describe("getAllLocales", () => {
    it("should return all available locales", () => {
      const locales = getAllLocales();
      expect(locales).toContain("zh-CN");
      expect(locales).toContain("en-US");
      expect(locales.length).toBeGreaterThan(0);
    });
  });
});
