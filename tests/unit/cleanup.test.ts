import { describe, it, expect, vi, beforeEach } from "vitest";
import { performCleanup, performCleanupWithFilter, cleanupExpiredCookies } from "@/utils/cleanup";
import { CookieClearType, ModeType, Settings } from "@/types";
import { storage } from "@/lib/store";

vi.mock("@/lib/store", () => ({
  storage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
  WHITELIST_KEY: "local:whitelist",
  BLACKLIST_KEY: "local:blacklist",
  SETTINGS_KEY: "local:settings",
  DEFAULT_SETTINGS: {
    mode: "whitelist",
    clearType: "all",
    clearCache: false,
    clearLocalStorage: false,
    clearIndexedDB: false,
  },
}));

const normalizeDomain = (domain: string): string => {
  return domain.replace(/^\./, "").toLowerCase();
};

vi.mock("@/utils", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    isInList: vi.fn((domain: string, list: string[]) => {
      const normalizedDomain = normalizeDomain(domain);
      return list.some((item: string) => {
        const normalizedItem = normalizeDomain(item);
        return (
          normalizedDomain === normalizedItem || normalizedDomain.endsWith("." + normalizedItem)
        );
      });
    }),
    isDomainMatch: vi.fn((cookieDomain: string, targetDomain: string) => {
      const normalizedCookie = normalizeDomain(cookieDomain);
      const normalizedTarget = normalizeDomain(targetDomain);
      return (
        normalizedCookie === normalizedTarget ||
        normalizedTarget.endsWith("." + normalizedCookie) ||
        normalizedCookie.endsWith("." + normalizedTarget)
      );
    }),
    clearCookies: vi.fn(async (options) => {
      const mockCookies = [
        {
          name: "test1",
          domain: ".example.com",
          path: "/",
          secure: true,
          expirationDate: Date.now() / 1000 + 3600,
        },
        { name: "test2", domain: ".test.com", path: "/", secure: false },
        {
          name: "test3",
          domain: ".demo.com",
          path: "/",
          secure: true,
          expirationDate: Date.now() / 1000 + 7200,
        },
      ];
      let count = 0;
      const clearedDomains = new Set<string>();

      for (const cookie of mockCookies) {
        const cleanedDomain = cookie.domain.replace(/^\./, "");
        if (options?.filterFn && !options.filterFn(cleanedDomain)) continue;
        if (options?.clearType === CookieClearType.SESSION && cookie.expirationDate) continue;
        if (options?.clearType === CookieClearType.PERSISTENT && !cookie.expirationDate) continue;
        count++;
        clearedDomains.add(cleanedDomain);
      }

      return { count, clearedDomains };
    }),
    clearBrowserData: vi.fn(async () => {}),
  };
});

const setupStorageMock = (
  settings: Partial<Settings> | null | undefined = {},
  whitelist: string[] = [],
  blacklist: string[] = []
) => {
  vi.mocked(storage.getItem).mockImplementation(async (key: string) => {
    if (key === "local:settings") {
      return settings === undefined ? null : settings;
    }
    if (key === "local:whitelist") {
      return whitelist;
    }
    if (key === "local:blacklist") {
      return blacklist;
    }
    return null;
  });
};

describe("cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("performCleanup", () => {
    it("should return null when domain is in whitelist (whitelist mode)", async () => {
      setupStorageMock(
        { mode: ModeType.WHITELIST, clearType: CookieClearType.ALL },
        ["example.com"],
        []
      );
      const result = await performCleanup({
        domain: "example.com",
        clearType: CookieClearType.ALL,
      });
      expect(result).toBeNull();
    });

    it("should cleanup when domain is not in whitelist (whitelist mode)", async () => {
      setupStorageMock(
        { mode: ModeType.WHITELIST, clearType: CookieClearType.ALL },
        ["other.com"],
        []
      );
      const result = await performCleanup({
        domain: "example.com",
        clearType: CookieClearType.ALL,
      });
      expect(result).not.toBeNull();
      expect(result?.count).toBeGreaterThan(0);
    });

    it("should return null when domain is not in blacklist (blacklist mode)", async () => {
      setupStorageMock(
        { mode: ModeType.BLACKLIST, clearType: CookieClearType.ALL },
        [],
        ["other.com"]
      );
      const result = await performCleanup({
        domain: "example.com",
        clearType: CookieClearType.ALL,
      });
      expect(result).toBeNull();
    });

    it("should cleanup when domain is in blacklist (blacklist mode)", async () => {
      setupStorageMock(
        { mode: ModeType.BLACKLIST, clearType: CookieClearType.ALL },
        [],
        ["example.com"]
      );
      const result = await performCleanup({
        domain: "example.com",
        clearType: CookieClearType.ALL,
      });
      expect(result).not.toBeNull();
      expect(result?.count).toBeGreaterThan(0);
    });

    it("should use default settings when settings is null", async () => {
      setupStorageMock(null, [], []);
      const result = await performCleanup({
        domain: "example.com",
        clearType: CookieClearType.ALL,
      });
      expect(result).not.toBeNull();
    });

    const testBrowserDataOption = async (
      optionKey: "clearCache" | "clearLocalStorage" | "clearIndexedDB",
      optionValue: boolean
    ) => {
      const { clearBrowserData } = await import("@/utils");
      setupStorageMock(
        { mode: ModeType.WHITELIST, clearType: CookieClearType.ALL, [optionKey]: optionValue },
        [],
        []
      );
      await performCleanup({
        domain: "example.com",
        clearType: CookieClearType.ALL,
        [optionKey]: optionValue,
      });
      expect(clearBrowserData).toHaveBeenCalledWith(
        expect.any(Set),
        expect.objectContaining({ [optionKey]: optionValue })
      );
    };

    it("should pass clearCache option to cleanup", () => testBrowserDataOption("clearCache", true));

    it("should pass clearLocalStorage option to cleanup", () =>
      testBrowserDataOption("clearLocalStorage", true));

    it("should pass clearIndexedDB option to cleanup", () =>
      testBrowserDataOption("clearIndexedDB", true));
  });

  describe("performCleanupWithFilter", () => {
    it("should cleanup all domains not in whitelist (whitelist mode)", async () => {
      setupStorageMock(
        { mode: ModeType.WHITELIST, clearType: CookieClearType.ALL },
        ["example.com"],
        []
      );
      const result = await performCleanupWithFilter(() => true, {
        clearType: CookieClearType.ALL,
      });
      expect(result.count).toBeGreaterThan(0);
    });

    it("should cleanup only domains in blacklist (blacklist mode)", async () => {
      setupStorageMock(
        { mode: ModeType.BLACKLIST, clearType: CookieClearType.ALL },
        [],
        ["example.com", "test.com"]
      );
      const result = await performCleanupWithFilter(() => true, {
        clearType: CookieClearType.ALL,
      });
      expect(result.count).toBeGreaterThan(0);
    });

    it("should combine custom filter with mode filter", async () => {
      setupStorageMock(
        { mode: ModeType.WHITELIST, clearType: CookieClearType.ALL },
        ["example.com"],
        []
      );
      const customFilter = (domain: string) => domain === "test.com";
      const result = await performCleanupWithFilter(customFilter, {
        clearType: CookieClearType.ALL,
      });
      expect(result.count).toBe(1);
      expect(result.clearedDomains).toContain("test.com");
      expect(result.clearedDomains).not.toContain("example.com");
      expect(result.clearedDomains).not.toContain("demo.com");
    });

    it("should use options over settings for clearType", async () => {
      const { clearCookies } = await import("@/utils");
      setupStorageMock({ mode: ModeType.WHITELIST, clearType: CookieClearType.SESSION }, [], []);
      await performCleanupWithFilter(() => true, {
        clearType: CookieClearType.PERSISTENT,
      });
      expect(clearCookies).toHaveBeenCalledWith(
        expect.objectContaining({
          clearType: CookieClearType.PERSISTENT,
        })
      );
    });

    it("should handle empty whitelist and blacklist", async () => {
      setupStorageMock({ mode: ModeType.WHITELIST, clearType: CookieClearType.ALL }, [], []);
      const result = await performCleanupWithFilter(() => true, {
        clearType: CookieClearType.ALL,
      });
      expect(result.count).toBeGreaterThan(0);
    });
  });

  describe("cleanupExpiredCookies", () => {
    const setupChromeMocks = (cookies: unknown[]) => {
      globalThis.chrome = {
        cookies: {
          getAll: vi.fn().mockResolvedValue(cookies),
          remove: vi.fn().mockResolvedValue({}),
        },
      } as unknown as typeof chrome;
    };

    it("should remove expired cookies", async () => {
      const pastTime = Date.now() / 1000 - 3600;
      const mockCookies = [
        {
          name: "expired",
          domain: ".example.com",
          path: "/",
          secure: true,
          expirationDate: pastTime,
        },
        {
          name: "valid",
          domain: ".example.com",
          path: "/",
          secure: true,
          expirationDate: Date.now() / 1000 + 3600,
        },
      ];
      setupChromeMocks(mockCookies);
      const count = await cleanupExpiredCookies();
      expect(count).toBe(1);
      expect(chrome.cookies.remove).toHaveBeenCalledTimes(1);
    });

    it("should return 0 when no expired cookies", async () => {
      const futureTime = Date.now() / 1000 + 3600;
      const mockCookies = [
        {
          name: "valid1",
          domain: ".example.com",
          path: "/",
          secure: true,
          expirationDate: futureTime,
        },
        {
          name: "valid2",
          domain: ".test.com",
          path: "/",
          secure: true,
          expirationDate: futureTime,
        },
      ];
      setupChromeMocks(mockCookies);
      const count = await cleanupExpiredCookies();
      expect(count).toBe(0);
      expect(chrome.cookies.remove).not.toHaveBeenCalled();
    });

    it("should skip session cookies (no expirationDate)", async () => {
      const mockCookies = [
        { name: "session", domain: ".example.com", path: "/", secure: true },
        {
          name: "valid",
          domain: ".example.com",
          path: "/",
          secure: true,
          expirationDate: Date.now() / 1000 + 3600,
        },
      ];
      setupChromeMocks(mockCookies);
      const count = await cleanupExpiredCookies();
      expect(count).toBe(0);
    });

    it("should handle remove errors gracefully", async () => {
      const pastTime = Date.now() / 1000 - 3600;
      const mockCookies = [
        {
          name: "expired",
          domain: ".example.com",
          path: "/",
          secure: true,
          expirationDate: pastTime,
        },
      ];
      setupChromeMocks(mockCookies);
      vi.mocked(chrome.cookies.remove).mockRejectedValueOnce(new Error("Remove failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const count = await cleanupExpiredCookies();
      expect(count).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should handle empty cookies list", async () => {
      setupChromeMocks([]);
      const count = await cleanupExpiredCookies();
      expect(count).toBe(0);
      expect(chrome.cookies.remove).not.toHaveBeenCalled();
    });

    it("should build correct URL for secure cookie", async () => {
      const pastTime = Date.now() / 1000 - 3600;
      const mockCookies = [
        {
          name: "expired",
          domain: ".example.com",
          path: "/path",
          secure: true,
          expirationDate: pastTime,
        },
      ];
      setupChromeMocks(mockCookies);
      await cleanupExpiredCookies();
      expect(chrome.cookies.remove).toHaveBeenCalledWith({
        url: "https://example.com/path",
        name: "expired",
      });
    });

    it("should build correct URL for non-secure cookie", async () => {
      const pastTime = Date.now() / 1000 - 3600;
      const mockCookies = [
        {
          name: "expired",
          domain: ".example.com",
          path: "/path",
          secure: false,
          expirationDate: pastTime,
        },
      ];
      setupChromeMocks(mockCookies);
      await cleanupExpiredCookies();
      expect(chrome.cookies.remove).toHaveBeenCalledWith({
        url: "http://example.com/path",
        name: "expired",
      });
    });

    it("should include storeId when removing expired cookies", async () => {
      const pastTime = Date.now() / 1000 - 3600;
      const mockCookies = [
        {
          name: "expired",
          domain: ".example.com",
          path: "/",
          secure: true,
          expirationDate: pastTime,
          storeId: "1",
        },
      ];
      setupChromeMocks(mockCookies);
      await cleanupExpiredCookies();
      expect(chrome.cookies.remove).toHaveBeenCalledWith({
        url: "https://example.com/",
        name: "expired",
        storeId: "1",
      });
    });
  });

  describe("editCookie safety tests", () => {
    const setupEditCookieMocks = () => {
      const removeSpy = vi.fn();
      const setSpy = vi.fn();
      globalThis.chrome = {
        cookies: {
          remove: removeSpy,
          set: setSpy,
        },
      } as unknown as typeof chrome;
      return { removeSpy, setSpy };
    };

    const createOriginalCookie = (overrides: Partial<chrome.cookies.Cookie> = {}) => ({
      name: "test",
      value: "value123",
      domain: ".example.com",
      path: "/test",
      secure: false,
      httpOnly: false,
      sameSite: "lax" as const,
      hostOnly: false,
      session: false,
      storeId: "0",
      ...overrides,
    });

    it("should not remove original cookie when sameSite and secure combination is invalid", async () => {
      const { editCookie } = await import("@/utils");
      const { removeSpy, setSpy } = setupEditCookieMocks();
      setSpy.mockRejectedValueOnce(new Error("Invalid SameSite"));
      const originalCookie = createOriginalCookie();
      const result = await editCookie(originalCookie, {
        sameSite: "no_restriction",
      });
      expect(result).toBe(false);
      expect(removeSpy).not.toHaveBeenCalled();
    });

    it("should handle invalid sameSite none without secure correctly", async () => {
      const { editCookie } = await import("@/utils");
      const { removeSpy } = setupEditCookieMocks();
      const originalCookie = createOriginalCookie();
      const result = await editCookie(originalCookie, {
        sameSite: "no_restriction",
        secure: false,
      });
      expect(result).toBe(false);
      expect(removeSpy).not.toHaveBeenCalled();
    });

    it("should successfully edit cookie with valid parameters", async () => {
      const { editCookie } = await import("@/utils");
      const { setSpy } = setupEditCookieMocks();
      setSpy.mockResolvedValueOnce({});
      const originalCookie = createOriginalCookie();
      const result = await editCookie(originalCookie, {
        value: "newValue",
      });
      expect(result).toBe(true);
      expect(setSpy).toHaveBeenCalled();
    });

    it("should not call chrome.cookies.remove during normal edit", async () => {
      const { editCookie } = await import("@/utils");
      const { removeSpy, setSpy } = setupEditCookieMocks();
      setSpy.mockResolvedValueOnce({});
      const originalCookie = createOriginalCookie();
      const result = await editCookie(originalCookie, {
        value: "newValue",
      });
      expect(result).toBe(true);
      expect(removeSpy).not.toHaveBeenCalled();
      expect(setSpy).toHaveBeenCalled();
    });

    it("should preserve storeId when editing cookie", async () => {
      const { editCookie } = await import("@/utils");
      const { setSpy } = setupEditCookieMocks();
      setSpy.mockResolvedValueOnce({});
      const originalCookie = createOriginalCookie({ storeId: "custom-store-id" });
      const result = await editCookie(originalCookie, {
        value: "newValue",
      });
      expect(result).toBe(true);
      expect(setSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          storeId: "custom-store-id",
        })
      );
    });

    it("should map sameSite none to no_restriction on set", async () => {
      const { editCookie } = await import("@/utils");
      const { setSpy } = setupEditCookieMocks();
      setSpy.mockResolvedValueOnce({});
      const originalCookie = createOriginalCookie({ secure: true });
      const result = await editCookie(originalCookie, {
        sameSite: "none" as unknown as chrome.cookies.SameSiteStatus,
      });
      expect(result).toBe(true);
      expect(setSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sameSite: "no_restriction",
        })
      );
    });

    it("should omit expirationDate when clearing to session cookie", async () => {
      const { editCookie } = await import("@/utils");
      const { setSpy } = setupEditCookieMocks();
      setSpy.mockResolvedValueOnce({});
      const originalCookie = createOriginalCookie({
        expirationDate: Date.now() / 1000 + 3600,
      });
      const result = await editCookie(originalCookie, {
        expirationDate: undefined,
      });
      expect(result).toBe(true);
      const setCall = setSpy.mock.calls[0][0];
      expect(setCall.expirationDate).toBeUndefined();
    });

    it("should ignore name/domain/path/storeId updates and use original values", async () => {
      const { editCookie } = await import("@/utils");
      const { setSpy } = setupEditCookieMocks();
      setSpy.mockResolvedValueOnce({});
      const originalCookie = createOriginalCookie({
        name: "original-name",
        domain: ".original-domain.com",
        path: "/original-path",
        storeId: "original-store-id",
      });
      const result = await editCookie(originalCookie, {
        name: "new-name",
        domain: "new-domain.com",
        path: "/new-path",
        storeId: "new-store-id",
        value: "new-value",
      });
      expect(result).toBe(true);
      expect(setSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "original-name",
          domain: ".original-domain.com",
          path: "/original-path",
          storeId: "original-store-id",
          value: "new-value",
        })
      );
    });
  });

  describe("createCookie value strategy", () => {
    it("should allow empty string as cookie value", async () => {
      const { createCookie } = await import("@/utils");
      const setSpy = vi.fn().mockResolvedValue({});
      globalThis.chrome = {
        cookies: {
          set: setSpy,
        },
      } as unknown as typeof chrome;
      const result = await createCookie({
        name: "test",
        value: "",
        domain: "example.com",
      });
      expect(result).toBe(true);
      expect(setSpy).toHaveBeenCalled();
    });

    it("should reject null or undefined cookie value", async () => {
      const { createCookie } = await import("@/utils");
      const result1 = await createCookie({
        name: "test",
        value: undefined as unknown as string,
        domain: "example.com",
      });
      expect(result1).toBe(false);
    });
  });
});
