import { describe, it, expect } from "vitest";
import { hasDomainInText, createTranslationMock } from "../utils/mocks";

const TEST_DOMAIN = "example.com";

const formatDomainText = (domain: string, prefix: string = "🌐 ", suffix: string = " (2)") =>
  `${prefix}${domain}${suffix}`;

describe("mocks", () => {
  describe("hasDomainInText", () => {
    it("should return false for null textContent", () => {
      expect(hasDomainInText(null, TEST_DOMAIN)).toBe(false);
    });

    it("should return false for undefined textContent", () => {
      expect(hasDomainInText(undefined, TEST_DOMAIN)).toBe(false);
    });

    it("should return false for empty string textContent", () => {
      expect(hasDomainInText("", TEST_DOMAIN)).toBe(false);
    });

    it("should return true when domain is found in text", () => {
      expect(hasDomainInText(formatDomainText(TEST_DOMAIN), TEST_DOMAIN)).toBe(true);
    });

    it("should return false when domain is not found in text", () => {
      expect(hasDomainInText(formatDomainText("test.com"), TEST_DOMAIN)).toBe(false);
    });

    it("should handle domain with special regex characters", () => {
      expect(hasDomainInText(formatDomainText("test.com"), "test.com")).toBe(true);
      expect(hasDomainInText(formatDomainText(TEST_DOMAIN), TEST_DOMAIN)).toBe(true);
    });

    it("should not match suffix domains", () => {
      expect(hasDomainInText(formatDomainText(`${TEST_DOMAIN}.cn`), TEST_DOMAIN)).toBe(false);
    });

    it("should match subdomains", () => {
      expect(hasDomainInText(formatDomainText(`sub.${TEST_DOMAIN}`), TEST_DOMAIN)).toBe(true);
    });

    it("should not match partial domain names", () => {
      expect(hasDomainInText(formatDomainText("evil.com"), TEST_DOMAIN)).toBe(false);
      expect(hasDomainInText(formatDomainText("example.org"), TEST_DOMAIN)).toBe(false);
    });

    it("should be case insensitive", () => {
      expect(hasDomainInText(formatDomainText("EXAMPLE.COM"), TEST_DOMAIN)).toBe(true);
      expect(hasDomainInText(formatDomainText(TEST_DOMAIN), "EXAMPLE.COM")).toBe(true);
    });
  });

  describe("createTranslationMock", () => {
    const getT = (translations: Record<string, string> = {}) => {
      return createTranslationMock(translations).useTranslation().t;
    };

    it("should return a mock useTranslation function", () => {
      const mock = createTranslationMock({});
      expect(mock.useTranslation).toBeDefined();
      expect(typeof mock.useTranslation).toBe("function");
    });

    it("should return the translation key when no translation exists", () => {
      const t = getT();
      expect(t("missing.key")).toBe("missing.key");
    });

    it("should return the translated text when translation exists", () => {
      const t = getT({ "test.key": "Hello World" });
      expect(t("test.key")).toBe("Hello World");
    });

    it("should return text without params when no params provided", () => {
      const t = getT({ "test.key": "Hello {name}" });
      expect(t("test.key")).toBe("Hello {name}");
    });

    it("should replace single placeholder with value", () => {
      const t = getT({ "test.key": "Hello {name}" });
      expect(t("test.key", { name: "World" })).toBe("Hello World");
    });

    it("should replace multiple placeholders with values", () => {
      const t = getT({ "test.key": "Hello {name}, you have {count} messages" });
      expect(t("test.key", { name: "Alice", count: 5 })).toBe("Hello Alice, you have 5 messages");
    });

    it("should replace multiple occurrences of the same placeholder", () => {
      const t = getT({ "test.key": "{name} says hello to {name}" });
      expect(t("test.key", { name: "Bob" })).toBe("Bob says hello to Bob");
    });

    it("should keep placeholder when value is not provided", () => {
      const t = getT({ "test.key": "Hello {name}, you have {count} messages" });
      expect(t("test.key", { name: "Alice" })).toBe("Hello Alice, you have {count} messages");
    });

    it("should handle numeric values", () => {
      const t = getT({ "test.key": "Count: {count}" });
      expect(t("test.key", { count: 123 })).toBe("Count: 123");
    });

    it("should handle string values with special characters", () => {
      const t = getT({ "test.key": "Message: {msg}" });
      expect(t("test.key", { msg: "Hello! How are you?" })).toBe("Message: Hello! How are you?");
    });

    it("should handle empty string translation", () => {
      const t = getT({ "test.key": "" });
      expect(t("test.key")).toBe("");
    });
  });
});
