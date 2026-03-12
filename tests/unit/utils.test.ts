import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeDomain,
  isDomainMatch,
  isInList,
  getCookieTypeName,
  buildOrigins,
  clearCookies,
  clearBrowserData,
  isTrackingCookie,
  isThirdPartyCookie,
  assessCookieRisk,
  getRiskLevelColor,
  getRiskLevelText,
  clearSingleCookie,
  editCookie,
  getActionText,
  getActionColor,
  formatLogTime,
  maskCookieValue,
  getCookieKey,
  toggleSetValue,
  validateDomain,
  isSensitiveCookie,
} from "@/utils";
import { CookieClearType } from "@/types";

const createMockCookies = () =>
  [
    {
      name: "test1",
      value: "value1",
      domain: ".example.com",
      path: "/",
      secure: true,
      httpOnly: false,
      sameSite: "no_restriction" as const,
      expirationDate: Date.now() / 1000 + 3600,
      storeId: "0",
    },
    {
      name: "test2",
      value: "value2",
      domain: "sub.example.com",
      path: "/",
      secure: false,
      httpOnly: true,
      sameSite: "lax" as const,
      storeId: "0",
    },
  ] as chrome.cookies.Cookie[];

const setupCookieMocks = (cookies: chrome.cookies.Cookie[]) => {
  vi.spyOn(chrome.cookies, "getAll").mockResolvedValue(cookies);
  vi.spyOn(chrome.cookies, "remove").mockImplementation(
    async (details: chrome.cookies.Details) => details
  );
};

describe("normalizeDomain", () => {
  it("should remove leading dot and convert to lowercase", () => {
    expect(normalizeDomain(".Example.COM")).toBe("example.com");
    expect(normalizeDomain("EXAMPLE.COM")).toBe("example.com");
    expect(normalizeDomain("example.com")).toBe("example.com");
  });

  it("should handle empty string", () => {
    expect(normalizeDomain("")).toBe("");
  });

  it("should handle subdomains", () => {
    expect(normalizeDomain(".Sub.Example.Com")).toBe("sub.example.com");
  });
});

describe("isDomainMatch", () => {
  it("should return true for exact matches", () => {
    expect(isDomainMatch("example.com", "example.com")).toBe(true);
  });

  it("should return true for parent domain matches", () => {
    expect(isDomainMatch("example.com", "sub.example.com")).toBe(true);
  });

  it("should return true for child domain matches", () => {
    expect(isDomainMatch("sub.example.com", "example.com")).toBe(true);
  });

  it("should return false for unrelated domains", () => {
    expect(isDomainMatch("example.com", "test.com")).toBe(false);
  });

  it("should handle leading dots and case differences", () => {
    expect(isDomainMatch(".Example.COM", "sub.EXAMPLE.com")).toBe(true);
  });
});

describe("isInList", () => {
  it("should return true for exact match in list", () => {
    const list = ["example.com", "test.com"];
    expect(isInList("example.com", list)).toBe(true);
  });

  it("should return true for parent domain in list", () => {
    const list = ["example.com"];
    expect(isInList("sub.example.com", list)).toBe(true);
  });

  it("should return true for child domain in list", () => {
    const list = ["sub.example.com"];
    expect(isInList("example.com", list)).toBe(true);
  });

  it("should return false for no match", () => {
    const list = ["example.com"];
    expect(isInList("test.com", list)).toBe(false);
  });

  it("should handle empty list", () => {
    expect(isInList("example.com", [])).toBe(false);
  });

  it("should handle leading dots and case differences", () => {
    const list = [".EXAMPLE.COM"];
    expect(isInList("sub.example.com", list)).toBe(true);
  });
});

describe("getCookieTypeName", () => {
  it("should return correct name for session type", () => {
    expect(getCookieTypeName("session")).toBe("会话Cookie");
  });

  it("should return correct name for persistent type", () => {
    expect(getCookieTypeName("persistent")).toBe("持久Cookie");
  });

  it("should return default name for unknown type", () => {
    expect(getCookieTypeName("unknown")).toBe("所有Cookie");
    expect(getCookieTypeName("")).toBe("所有Cookie");
  });

  it("should return translated name for session type with t function", () => {
    const mockT = vi.fn((key: string) => {
      if (key === "cookieTypes.session") return "Session Cookie";
      return key;
    });
    expect(getCookieTypeName("session", mockT)).toBe("Session Cookie");
  });

  it("should return translated name for persistent type with t function", () => {
    const mockT = vi.fn((key: string) => {
      if (key === "cookieTypes.persistent") return "Persistent Cookie";
      return key;
    });
    expect(getCookieTypeName("persistent", mockT)).toBe("Persistent Cookie");
  });

  it("should return translated default name for unknown type with t function", () => {
    const mockT = vi.fn((key: string) => {
      if (key === "cookieTypes.all") return "All Cookies";
      return key;
    });
    expect(getCookieTypeName("unknown", mockT)).toBe("All Cookies");
  });
});

describe("buildOrigins", () => {
  it("should build origins from domains", () => {
    const domains = new Set(["example.com", "test.com"]);
    const origins = buildOrigins(domains);
    expect(origins).toEqual(["https://example.com", "https://test.com"]);
  });

  it("should handle empty set", () => {
    const domains = new Set<string>();
    const origins = buildOrigins(domains);
    expect(origins).toEqual([]);
  });
});

describe("clearCookies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should clear all cookies", async () => {
    const mockCookies = createMockCookies();
    setupCookieMocks(mockCookies);

    const result = await clearCookies();
    expect(result.count).toBe(mockCookies.length);
    expect(result.clearedDomains.size).toBeGreaterThan(0);
  });

  it("should clear cookies by type session", async () => {
    const mockCookies = createMockCookies();
    setupCookieMocks(mockCookies);

    const result = await clearCookies({
      clearType: CookieClearType.SESSION,
    });
    expect(result.count).toBe(1);
  });

  it("should clear cookies by type persistent", async () => {
    const mockCookies = [
      {
        name: "test1",
        value: "value1",
        domain: ".example.com",
        path: "/",
        secure: true,
        httpOnly: false,
        sameSite: "no_restriction" as const,
        expirationDate: Date.now() / 1000 + 3600,
        storeId: "0",
      },
      {
        name: "test2",
        value: "value2",
        domain: ".example.com",
        path: "/",
        secure: false,
        httpOnly: true,
        sameSite: "lax" as const,
        expirationDate: Date.now() / 1000 + 7200,
        storeId: "0",
      },
    ] as chrome.cookies.Cookie[];
    setupCookieMocks(mockCookies);

    const result = await clearCookies({
      clearType: CookieClearType.PERSISTENT,
    });
    expect(result.count).toBe(2);
  });

  it("should skip session cookies when clearing persistent type", async () => {
    const mockCookies = [
      {
        name: "persistent",
        value: "value1",
        domain: ".example.com",
        path: "/",
        secure: true,
        httpOnly: false,
        sameSite: "no_restriction" as const,
        expirationDate: Date.now() / 1000 + 3600,
        storeId: "0",
      },
      {
        name: "session",
        value: "value2",
        domain: "sub.example.com",
        path: "/",
        secure: false,
        httpOnly: true,
        sameSite: "lax" as const,
        storeId: "0",
      },
    ] as chrome.cookies.Cookie[];
    setupCookieMocks(mockCookies);

    const result = await clearCookies({
      clearType: CookieClearType.PERSISTENT,
    });
    expect(result.count).toBe(1);
  });

  it("should clear cookies by type all", async () => {
    const mockCookies = createMockCookies();
    setupCookieMocks(mockCookies);

    const result = await clearCookies({
      clearType: CookieClearType.ALL,
    });
    expect(result.count).toBe(mockCookies.length);
  });

  it("should filter cookies by domain", async () => {
    const mockCookies = createMockCookies();
    setupCookieMocks(mockCookies);

    const result = await clearCookies({
      filterFn: (domain) => domain === "example.com",
    });
    expect(result.count).toBeGreaterThan(0);
  });

  it("should handle empty cookies", async () => {
    setupCookieMocks([]);

    const result = await clearCookies();
    expect(result.count).toBe(0);
    expect(result.clearedDomains.size).toBe(0);
  });

  it("should handle errors when clearing cookies", async () => {
    const mockCookies = createMockCookies();
    vi.spyOn(chrome.cookies, "getAll").mockResolvedValue(mockCookies);
    vi.spyOn(chrome.cookies, "remove").mockRejectedValue(new Error("Failed"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await clearCookies();
    expect(result.count).toBe(0);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("clearBrowserData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should clear cache", async () => {
    const mockBrowsingDataRemove = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chrome.browsingData as any).remove = mockBrowsingDataRemove;

    const domains = new Set(["example.com"]);
    await clearBrowserData(domains, { clearCache: true });

    expect(mockBrowsingDataRemove).toHaveBeenCalled();
  });

  it("should clear localStorage", async () => {
    const mockBrowsingDataRemove = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chrome.browsingData as any).remove = mockBrowsingDataRemove;

    const domains = new Set(["example.com"]);
    await clearBrowserData(domains, { clearLocalStorage: true });

    expect(mockBrowsingDataRemove).toHaveBeenCalled();
  });

  it("should clear IndexedDB", async () => {
    const mockBrowsingDataRemove = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chrome.browsingData as any).remove = mockBrowsingDataRemove;

    const domains = new Set(["example.com"]);
    await clearBrowserData(domains, { clearIndexedDB: true });

    expect(mockBrowsingDataRemove).toHaveBeenCalled();
  });

  it("should handle empty domains", async () => {
    const mockBrowsingDataRemove = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chrome.browsingData as any).remove = mockBrowsingDataRemove;

    const domains = new Set<string>();
    await clearBrowserData(domains, { clearCache: true });

    expect(mockBrowsingDataRemove).not.toHaveBeenCalled();
  });

  it("should handle errors when clearing cache", async () => {
    const mockBrowsingDataRemove = vi.fn().mockRejectedValue(new Error("Failed"));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chrome.browsingData as any).remove = mockBrowsingDataRemove;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const domains = new Set(["example.com"]);
    await clearBrowserData(domains, { clearCache: true });

    expect(mockBrowsingDataRemove).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("should handle errors when clearing localStorage", async () => {
    const mockBrowsingDataRemove = vi.fn().mockRejectedValue(new Error("Failed"));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chrome.browsingData as any).remove = mockBrowsingDataRemove;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const domains = new Set(["example.com"]);
    await clearBrowserData(domains, { clearLocalStorage: true });

    expect(mockBrowsingDataRemove).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("should handle errors when clearing IndexedDB", async () => {
    const mockBrowsingDataRemove = vi.fn().mockRejectedValue(new Error("Failed"));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chrome.browsingData as any).remove = mockBrowsingDataRemove;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const domains = new Set(["example.com"]);
    await clearBrowserData(domains, { clearIndexedDB: true });

    expect(mockBrowsingDataRemove).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("isTrackingCookie", () => {
  it("should detect tracking cookie by name", () => {
    expect(isTrackingCookie({ name: "_ga", domain: "example.com" })).toBe(true);
    expect(isTrackingCookie({ name: "utm_source", domain: "example.com" })).toBe(true);
    expect(isTrackingCookie({ name: "fbp", domain: "example.com" })).toBe(true);
  });

  it("should detect tracking cookie by domain", () => {
    expect(isTrackingCookie({ name: "test", domain: "google-analytics.com" })).toBe(true);
    expect(isTrackingCookie({ name: "test", domain: "doubleclick.net" })).toBe(true);
    expect(isTrackingCookie({ name: "test", domain: "facebook.net" })).toBe(true);
  });

  it("should return false for non-tracking cookies", () => {
    expect(isTrackingCookie({ name: "session", domain: "example.com" })).toBe(false);
    expect(isTrackingCookie({ name: "user_preference", domain: "example.com" })).toBe(false);
  });

  it("should be case-insensitive", () => {
    expect(isTrackingCookie({ name: "_GA", domain: "EXAMPLE.COM" })).toBe(true);
    expect(isTrackingCookie({ name: "TEST", domain: "GOOGLE-ANALYTICS.COM" })).toBe(true);
  });
});

describe("isThirdPartyCookie", () => {
  it("should return false when currentDomain is not provided", () => {
    expect(isThirdPartyCookie("example.com")).toBe(false);
  });

  it("should return false for same domain", () => {
    expect(isThirdPartyCookie("example.com", "example.com")).toBe(false);
  });

  it("should return false for subdomain", () => {
    expect(isThirdPartyCookie("sub.example.com", "example.com")).toBe(false);
    expect(isThirdPartyCookie("example.com", "sub.example.com")).toBe(false);
  });

  it("should return true for different domain", () => {
    expect(isThirdPartyCookie("example.com", "test.com")).toBe(true);
  });

  it("should handle leading dots", () => {
    expect(isThirdPartyCookie(".example.com", "test.com")).toBe(true);
  });
});

describe("assessCookieRisk", () => {
  it("should return low risk for safe cookie", () => {
    const result = assessCookieRisk(
      { name: "safe", domain: "example.com", httpOnly: true, secure: true },
      "example.com"
    );
    expect(result.level).toBe("low");
    expect(result.isTracking).toBe(false);
    expect(result.isThirdParty).toBe(false);
  });

  it("should return high risk for tracking cookie", () => {
    const result = assessCookieRisk(
      { name: "_ga", domain: "example.com", httpOnly: true, secure: true },
      "example.com"
    );
    expect(result.level).toBe("high");
    expect(result.isTracking).toBe(true);
  });

  it("should return medium risk for third-party cookie", () => {
    const result = assessCookieRisk(
      { name: "test", domain: "other.com", httpOnly: true, secure: true },
      "example.com"
    );
    expect(result.level).toBe("medium");
    expect(result.isThirdParty).toBe(true);
  });

  it("should return medium risk for non-httpOnly cookie", () => {
    const result = assessCookieRisk(
      { name: "test", domain: "example.com", httpOnly: false, secure: true },
      "example.com"
    );
    expect(result.level).toBe("medium");
    expect(result.reason).toContain("非 HttpOnly");
  });

  it("should return medium risk for non-secure cookie with leading dot", () => {
    const result = assessCookieRisk(
      { name: "test", domain: ".example.com", httpOnly: true, secure: false },
      "example.com"
    );
    expect(result.level).toBe("medium");
    expect(result.reason).toContain("非 Secure");
  });

  it("should combine multiple risk factors", () => {
    const result = assessCookieRisk(
      { name: "_ga", domain: "tracker.com", httpOnly: false, secure: false },
      "example.com"
    );
    expect(result.level).toBe("high");
    expect(result.isTracking).toBe(true);
    expect(result.isThirdParty).toBe(true);
  });

  it("should not increase risk level when already high for non-secure cookie", () => {
    const result = assessCookieRisk(
      { name: "_ga", domain: ".example.com", httpOnly: true, secure: false },
      "example.com"
    );
    expect(result.level).toBe("high");
    expect(result.reason).toContain("非 Secure");
  });

  it("should not increase risk level when already medium for non-secure cookie", () => {
    const result = assessCookieRisk(
      { name: "test", domain: ".other.com", httpOnly: true, secure: false },
      "example.com"
    );
    expect(result.level).toBe("medium");
    expect(result.reason).toContain("非 Secure");
  });
});

describe("getRiskLevelColor", () => {
  it("should return red for high risk", () => {
    expect(getRiskLevelColor("high")).toBe("#ef4444");
  });

  it("should return orange for medium risk", () => {
    expect(getRiskLevelColor("medium")).toBe("#f59e0b");
  });

  it("should return green for low risk", () => {
    expect(getRiskLevelColor("low")).toBe("#22c55e");
  });

  it("should return green for unknown risk level", () => {
    expect(getRiskLevelColor("unknown")).toBe("#22c55e");
  });
});

describe("getRiskLevelText", () => {
  it("should return correct text for high risk", () => {
    expect(getRiskLevelText("high")).toBe("高风险");
  });

  it("should return correct text for medium risk", () => {
    expect(getRiskLevelText("medium")).toBe("中风险");
  });

  it("should return correct text for low risk", () => {
    expect(getRiskLevelText("low")).toBe("低风险");
  });

  it("should return low risk for unknown risk level", () => {
    expect(getRiskLevelText("unknown")).toBe("低风险");
  });

  it("should return translated text for high risk with t function", () => {
    const mockT = vi.fn((key: string) => {
      if (key === "cookieList.highRisk") return "High Risk";
      return key;
    });
    expect(getRiskLevelText("high", mockT)).toBe("High Risk");
    expect(mockT).toHaveBeenCalledWith("cookieList.highRisk");
  });

  it("should return translated text for medium risk with t function", () => {
    const mockT = vi.fn((key: string) => {
      if (key === "cookieList.mediumRisk") return "Medium Risk";
      return key;
    });
    expect(getRiskLevelText("medium", mockT)).toBe("Medium Risk");
    expect(mockT).toHaveBeenCalledWith("cookieList.mediumRisk");
  });

  it("should return translated text for low risk with t function", () => {
    const mockT = vi.fn((key: string) => {
      if (key === "cookieList.lowRisk") return "Low Risk";
      return key;
    });
    expect(getRiskLevelText("low", mockT)).toBe("Low Risk");
    expect(mockT).toHaveBeenCalledWith("cookieList.lowRisk");
  });

  it("should return translated text for unknown risk level with t function", () => {
    const mockT = vi.fn((key: string) => {
      if (key === "cookieList.lowRisk") return "Low Risk";
      return key;
    });
    expect(getRiskLevelText("unknown", mockT)).toBe("Low Risk");
  });
});

describe("clearSingleCookie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should clear single cookie successfully", async () => {
    const mockCookie = {
      name: "test",
      value: "value",
      domain: ".example.com",
      path: "/",
      secure: true,
      httpOnly: false,
      sameSite: "lax",
      storeId: "0",
      session: false,
      hostOnly: false,
    } as chrome.cookies.Cookie;
    vi.spyOn(chrome.cookies, "remove").mockResolvedValue(undefined);

    const result = await clearSingleCookie(mockCookie, "example.com");
    expect(result).toBe(true);
  });

  it("should handle errors when clearing single cookie", async () => {
    const mockCookie = {
      name: "test",
      value: "value",
      domain: ".example.com",
      path: "/",
      secure: true,
      httpOnly: false,
      sameSite: "lax",
      storeId: "0",
      session: false,
      hostOnly: false,
    } as chrome.cookies.Cookie;
    vi.spyOn(chrome.cookies, "remove").mockRejectedValue(new Error("Failed"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await clearSingleCookie(mockCookie, "example.com");
    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("editCookie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should edit cookie successfully", async () => {
    const originalCookie = {
      name: "test",
      value: "old",
      domain: ".example.com",
      path: "/",
      secure: false,
      httpOnly: false,
      sameSite: "lax",
      storeId: "0",
      session: false,
      hostOnly: false,
    } as chrome.cookies.Cookie;
    const updates = { value: "new", secure: true };

    vi.spyOn(chrome.cookies, "remove").mockResolvedValue(undefined);
    vi.spyOn(chrome.cookies, "set").mockResolvedValue(undefined);

    const result = await editCookie(originalCookie, updates);
    expect(result).toBe(true);
  });

  it("should edit cookie with expiration date", async () => {
    const originalCookie = {
      name: "test",
      value: "old",
      domain: ".example.com",
      path: "/",
      secure: false,
      httpOnly: false,
      sameSite: "lax",
      expirationDate: Date.now() / 1000 + 3600,
      storeId: "0",
      session: false,
      hostOnly: false,
    } as chrome.cookies.Cookie;
    const updates = { expirationDate: Date.now() / 1000 + 7200 };

    vi.spyOn(chrome.cookies, "remove").mockResolvedValue(undefined);
    vi.spyOn(chrome.cookies, "set").mockResolvedValue(undefined);

    const result = await editCookie(originalCookie, updates);
    expect(result).toBe(true);
  });

  it("should handle errors when editing cookie", async () => {
    const originalCookie = {
      name: "test",
      value: "old",
      domain: ".example.com",
      path: "/",
      secure: false,
      httpOnly: false,
      sameSite: "lax",
      storeId: "0",
      session: false,
      hostOnly: false,
    } as chrome.cookies.Cookie;
    vi.spyOn(chrome.cookies, "remove").mockRejectedValue(new Error("Failed"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await editCookie(originalCookie, {});
    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("should use original expiration date when update doesn't provide it", async () => {
    const originalCookie = {
      name: "test",
      value: "old",
      domain: ".example.com",
      path: "/",
      secure: false,
      httpOnly: false,
      sameSite: "lax",
      expirationDate: Date.now() / 1000 + 3600,
      storeId: "0",
      session: false,
      hostOnly: false,
    } as chrome.cookies.Cookie;
    const updates = { value: "new" };

    vi.spyOn(chrome.cookies, "remove").mockResolvedValue(undefined);
    vi.spyOn(chrome.cookies, "set").mockResolvedValue(undefined);

    const result = await editCookie(originalCookie, updates);
    expect(result).toBe(true);
  });
});

describe("getActionText", () => {
  it("should return correct text for clear action", () => {
    expect(getActionText("clear")).toBe("清除");
  });

  it("should return correct text for edit action", () => {
    expect(getActionText("edit")).toBe("编辑");
  });

  it("should return correct text for delete action", () => {
    expect(getActionText("delete")).toBe("删除");
  });

  it("should return correct text for import action", () => {
    expect(getActionText("import")).toBe("导入");
  });

  it("should return correct text for export action", () => {
    expect(getActionText("export")).toBe("导出");
  });

  it("should return default text for unknown action", () => {
    expect(getActionText("unknown")).toBe("操作");
    expect(getActionText("")).toBe("操作");
  });

  it("should return translated text for clear action with t function", () => {
    const mockT = vi.fn((key: string) => {
      if (key === "actions.clear") return "Clear";
      return key;
    });
    expect(getActionText("clear", mockT)).toBe("Clear");
  });

  it("should return translated text for edit action with t function", () => {
    const mockT = vi.fn((key: string) => {
      if (key === "actions.edit") return "Edit";
      return key;
    });
    expect(getActionText("edit", mockT)).toBe("Edit");
  });

  it("should return translated text for delete action with t function", () => {
    const mockT = vi.fn((key: string) => {
      if (key === "actions.delete") return "Delete";
      return key;
    });
    expect(getActionText("delete", mockT)).toBe("Delete");
  });

  it("should return translated text for import action with t function", () => {
    const mockT = vi.fn((key: string) => {
      if (key === "actions.import") return "Import";
      return key;
    });
    expect(getActionText("import", mockT)).toBe("Import");
  });

  it("should return translated text for export action with t function", () => {
    const mockT = vi.fn((key: string) => {
      if (key === "actions.export") return "Export";
      return key;
    });
    expect(getActionText("export", mockT)).toBe("Export");
  });

  it("should return translated default text for unknown action with t function", () => {
    const mockT = vi.fn((key: string) => {
      if (key === "actions.action") return "Action";
      return key;
    });
    expect(getActionText("unknown", mockT)).toBe("Action");
  });
});

describe("getActionColor", () => {
  it("should return correct color for clear action", () => {
    expect(getActionColor("clear")).toBe("#3b82f6");
  });

  it("should return correct color for edit action", () => {
    expect(getActionColor("edit")).toBe("#f59e0b");
  });

  it("should return correct color for delete action", () => {
    expect(getActionColor("delete")).toBe("#ef4444");
  });

  it("should return correct color for import action", () => {
    expect(getActionColor("import")).toBe("#22c55e");
  });

  it("should return correct color for export action", () => {
    expect(getActionColor("export")).toBe("#8b5cf6");
  });

  it("should return default color for unknown action", () => {
    expect(getActionColor("unknown")).toBe("#64748b");
    expect(getActionColor("")).toBe("#64748b");
  });
});

describe("formatLogTime", () => {
  it("should format timestamp correctly", () => {
    const testTimestamp = Date.now();
    const result = formatLogTime(testTimestamp);
    const expected = new Date(testTimestamp).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    expect(result).toBe(expected);
  });
});

describe("maskCookieValue", () => {
  const testMask = "••••••••••••";

  it("should return full mask for short values", () => {
    expect(maskCookieValue("1234", testMask)).toBe(testMask);
    expect(maskCookieValue("12345678", testMask)).toBe(testMask);
  });

  it("should return partial mask for longer values", () => {
    const result = maskCookieValue("1234567890", testMask);
    expect(result).toBe("1234" + testMask.substring(4));
  });
});

describe("getCookieKey", () => {
  it("should generate correct key from name and domain", () => {
    expect(getCookieKey("session", "example.com")).toBe("session-example.com");
    expect(getCookieKey("_ga", "google.com")).toBe("_ga-google.com");
  });
});

describe("toggleSetValue", () => {
  it("should add value when not present", () => {
    const set = new Set(["a", "b"]);
    const result = toggleSetValue(set, "c");
    expect(result.has("a")).toBe(true);
    expect(result.has("b")).toBe(true);
    expect(result.has("c")).toBe(true);
  });

  it("should remove value when present", () => {
    const set = new Set(["a", "b", "c"]);
    const result = toggleSetValue(set, "b");
    expect(result.has("a")).toBe(true);
    expect(result.has("b")).toBe(false);
    expect(result.has("c")).toBe(true);
  });

  it("should not modify original set", () => {
    const original = new Set(["a", "b"]);
    const result = toggleSetValue(original, "c");
    expect(original.has("c")).toBe(false);
    expect(result.has("c")).toBe(true);
  });
});

describe("validateDomain", () => {
  it("should validate empty string", () => {
    const result = validateDomain("");
    expect(result.valid).toBe(false);
    expect(result.message).toBe("域名不能为空");
  });

  it("should validate whitespace only", () => {
    const result = validateDomain("   ");
    expect(result.valid).toBe(false);
    expect(result.message).toBe("域名不能为空");
  });

  it("should validate valid domain", () => {
    expect(validateDomain("example.com").valid).toBe(true);
    expect(validateDomain("sub.example.com").valid).toBe(true);
    expect(validateDomain("test123.com").valid).toBe(true);
    expect(validateDomain("a.co").valid).toBe(true);
  });

  it("should validate invalid domain", () => {
    expect(validateDomain("invalid_domain").valid).toBe(false);
    expect(validateDomain("-example.com").valid).toBe(false);
    expect(validateDomain("example.com-").valid).toBe(false);
    expect(validateDomain("example..com").valid).toBe(false);
  });
});

describe("isSensitiveCookie", () => {
  it("should detect session cookie as sensitive", () => {
    expect(isSensitiveCookie({ name: "session" })).toBe(true);
    expect(isSensitiveCookie({ name: "SESSION" })).toBe(true);
    expect(isSensitiveCookie({ name: "user_session" })).toBe(true);
  });

  it("should detect auth cookie as sensitive", () => {
    expect(isSensitiveCookie({ name: "auth" })).toBe(true);
    expect(isSensitiveCookie({ name: "AUTH_TOKEN" })).toBe(true);
    expect(isSensitiveCookie({ name: "user_auth" })).toBe(true);
  });

  it("should detect token cookie as sensitive", () => {
    expect(isSensitiveCookie({ name: "token" })).toBe(true);
    expect(isSensitiveCookie({ name: "access_token" })).toBe(true);
    expect(isSensitiveCookie({ name: "csrf_token" })).toBe(true);
  });

  it("should detect jwt cookie as sensitive", () => {
    expect(isSensitiveCookie({ name: "jwt" })).toBe(true);
    expect(isSensitiveCookie({ name: "JWT" })).toBe(true);
    expect(isSensitiveCookie({ name: "jwt_token" })).toBe(true);
  });

  it("should detect sid cookie as sensitive", () => {
    expect(isSensitiveCookie({ name: "sid" })).toBe(true);
    expect(isSensitiveCookie({ name: "SID" })).toBe(true);
  });

  it("should detect sessid cookie as sensitive", () => {
    expect(isSensitiveCookie({ name: "sessid" })).toBe(true);
    expect(isSensitiveCookie({ name: "SESSID" })).toBe(true);
  });

  it("should return false for non-sensitive cookies", () => {
    expect(isSensitiveCookie({ name: "preferences" })).toBe(false);
    expect(isSensitiveCookie({ name: "theme" })).toBe(false);
    expect(isSensitiveCookie({ name: "language" })).toBe(false);
    expect(isSensitiveCookie({ name: "user_id" })).toBe(false);
  });

  it("should be case-insensitive", () => {
    expect(isSensitiveCookie({ name: "SESSION" })).toBe(true);
    expect(isSensitiveCookie({ name: "AuthToken" })).toBe(true);
    expect(isSensitiveCookie({ name: "JWT_TOKEN" })).toBe(true);
  });
});
