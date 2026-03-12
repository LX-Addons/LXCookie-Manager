import { describe, it, expect } from "vitest";
import { normalizeDomain, isDomainMatch, isInList, getCookieTypeName } from "@/utils";

describe("normalizeDomain", () => {
  it("should remove leading dot", () => {
    expect(normalizeDomain(".example.com")).toBe("example.com");
  });

  it("should convert to lowercase", () => {
    expect(normalizeDomain("Example.COM")).toBe("example.com");
  });

  it("should handle domain without dot", () => {
    expect(normalizeDomain("example.com")).toBe("example.com");
  });
});

describe("isDomainMatch", () => {
  it("should match exact domains", () => {
    expect(isDomainMatch("example.com", "example.com")).toBe(true);
  });

  it("should match subdomains", () => {
    expect(isDomainMatch("example.com", "sub.example.com")).toBe(true);
    expect(isDomainMatch("sub.example.com", "example.com")).toBe(true);
  });

  it("should not match different domains", () => {
    expect(isDomainMatch("example.com", "other.com")).toBe(false);
  });
});

describe("isInList", () => {
  it("should check if domain is in list", () => {
    expect(isInList("example.com", ["example.com"])).toBe(true);
    expect(isInList("sub.example.com", ["example.com"])).toBe(true);
    expect(isInList("example.com", ["other.com"])).toBe(false);
  });
});

describe("getCookieTypeName", () => {
  it("should return correct cookie type name", () => {
    expect(getCookieTypeName("session")).toBe("会话Cookie");
    expect(getCookieTypeName("persistent")).toBe("持久Cookie");
    expect(getCookieTypeName("all")).toBe("所有Cookie");
  });
});
