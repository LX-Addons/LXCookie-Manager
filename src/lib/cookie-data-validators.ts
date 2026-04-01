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

export function isValidHostname(hostname: string): boolean {
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

  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (ipv4Regex.test(hostname)) {
    return false;
  }

  const ipv6Regex =
    /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::$|^::1$|^::(?:[0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:)*:[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){2,7}:$|^(?:[0-9a-fA-F]{1,4}:){1,7}:[0-9a-fA-F]{1,4}$/;
  if (ipv6Regex.test(hostname)) {
    return false;
  }

  const hostnameRegex =
    /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
  return hostnameRegex.test(hostname);
}

export function isValidCookieKeyword(keyword: string): boolean {
  if (!keyword || keyword.length < 2) {
    return false;
  }

  if (keyword.includes("/") || keyword.includes("?") || keyword.includes("&")) {
    return false;
  }

  return true;
}
