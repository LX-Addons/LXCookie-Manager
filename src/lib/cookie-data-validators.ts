/**
 * Cookie 数据校验函数
 * =====================================
 *
 * 【使用】
 * - scripts/update-tracker-data.ts: 构建期数据生成与校验
 * - src/lib/constants.ts: 运行时数据校验
 *
 * 【注意】修改此文件必须同步刷新 src/data/tracker-domains.json
 */

const IPV4_OCTET_REGEX = /^(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

function isIPv4Address(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => IPV4_OCTET_REGEX.test(part));
}

const HEX_GROUP = /^[0-9a-fA-F]{1,4}$/;

function isIPv6Address(hostname: string): boolean {
  if (hostname === "::" || hostname === "::1") return true;

  if (hostname.includes("::")) {
    const parts = hostname.split("::");
    if (parts.length > 2) return false;
    const left = parts[0] ? parts[0].split(":") : [];
    const right = parts[1] ? parts[1].split(":") : [];
    if (left.length + right.length > 7) return false;
    return [...left, ...right].every((group) => group === "" || HEX_GROUP.test(group));
  }

  const groups = hostname.split(":");
  if (groups.length !== 8) return false;
  return groups.every((group) => HEX_GROUP.test(group));
}

export function isValidHostname(hostname: string): boolean {
  if (typeof hostname !== "string") {
    return false;
  }

  if (!hostname || hostname.length === 0) {
    return false;
  }

  if (hostname.startsWith("#") || hostname.startsWith("@@")) {
    return false;
  }

  if (
    hostname.startsWith(".") ||
    hostname.startsWith("-") ||
    hostname.startsWith("&") ||
    hostname.startsWith("%")
  ) {
    return false;
  }

  if (
    hostname.includes("http://") ||
    hostname.includes("https://") ||
    hostname.includes("/") ||
    hostname.includes("?")
  ) {
    return false;
  }

  if (
    hostname.endsWith(".js") ||
    hostname.endsWith(".gif") ||
    hostname.endsWith(".png") ||
    hostname.endsWith(".jpg") ||
    hostname.endsWith(".jpeg")
  ) {
    return false;
  }

  if (!hostname.includes(".")) {
    return false;
  }

  if (
    hostname.includes("*") ||
    hostname.includes("=") ||
    hostname.includes("&") ||
    hostname.includes("%")
  ) {
    return false;
  }

  if (isIPv4Address(hostname)) {
    return false;
  }

  if (isIPv6Address(hostname)) {
    return false;
  }

  const hostnameRegex =
    /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
  return hostnameRegex.test(hostname);
}

export function isValidCookieKeyword(keyword: string): boolean {
  if (typeof keyword !== "string") {
    return false;
  }

  if (!keyword || keyword.length < 2) {
    return false;
  }

  if (keyword.includes("/") || keyword.includes("?") || keyword.includes("&")) {
    return false;
  }

  return true;
}
