import { mkdir, rename } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isValidHostname, isValidCookieKeyword } from "../src/lib/cookie-data-validators.js";
import type { TrackerData } from "../src/data/tracker-domains.d.ts";
import trackingCookieKeywordsConfig from "./tracking-cookie-keywords.json" with { type: "json" };

/**
 * Cookie 数据维护约定（权威说明）
 *
 * 1. 数据结构
 *    - 仅允许 4 个顶层字段: trackingDomains, trackingCookieKeywords, lastUpdated, sources
 *    - trackingDomains: 仅包含有效的 Cookie 主机名
 *    - trackingCookieKeywords: 仅包含有效的 Cookie 关键词
 *
 * 2. 失败时行为
 *    - allow-failure 模式: EasyPrivacy 失败时不覆盖现有 tracker-domains.json
 *    - 非 allow-failure 模式: 任何失败均终止构建
 *
 * 3. 分支门禁
 *    - build:local / zip:local / PR / 非主分支: allow-failure
 *    - main / beta / release CI + release workflow: EasyPrivacy 必需 + 新鲜度强制
 *
 * 4. 时间字段（严格区分，不可混淆）
 *    - lastUpdated: 本地脚本执行时间（ISO 8601），仅用于记录"何时生成此文件"
 *    - sources.easyprivacy.version: EasyPrivacy 源版本标识，格式如 "202504010000"
 *    - 源数据新鲜度: 只能从 sources.easyprivacy.version 解析日期后判断
 *    - 警告: lastUpdated 不是源数据发布日期，不可用于新鲜度判断
 *
 * 5. 新鲜度规则（权威，不可放宽）
 *    ┌─────────────────────────────────────────────────────────────────────┐
 *    │ 受保护分支和 release 中：                                            │
 *    │ 只有当 EasyPrivacy 成功且版本日期可证明新鲜时，才视为满足新鲜度要求；   │
 *    │ 无法证明即失败，不允许回退到现有数据时间。                            │
 *    └─────────────────────────────────────────────────────────────────────┘
 *    - EasyPrivacy 成功 + versionDate 可解析 → 用 versionDate 判新鲜度
 *    - EasyPrivacy 成功 + versionDate 不可解析 → 新鲜度不满足（失败）
 *    - EasyPrivacy 未成功 → 仅在 allow-failure 模式下可回退到现有数据 lastUpdated
 *    - 超过 14 天视为陈旧
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const DATA_DIR = join(ROOT_DIR, "src", "data");

const EASYPRIVACY_URL = "https://easylist-downloads.adblockplus.org/easyprivacy.txt";
const PETER_LOWE_URLS = [
  "https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=0&mimetype=plaintext",
];

const MAX_STALENESS_DAYS = 14;
const FETCH_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function fetchWithTimeout(
  url: string,
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface FetchWithRetryResult {
  response: Response | null;
  success: boolean;
  usedUrl: string;
  attempts: number;
  errors: string[];
}

async function fetchWithRetryAndFallback(
  urls: string[],
  maxRetries: number = MAX_RETRIES
): Promise<FetchWithRetryResult> {
  const errors: string[] = [];
  let attempts = 0;

  for (const url of urls) {
    for (let retry = 0; retry < maxRetries; retry++) {
      attempts++;
      try {
        const response = await fetchWithTimeout(url);
        if (response.ok) {
          return { response, success: true, usedUrl: url, attempts, errors };
        }
        errors.push(`${url} -> HTTP ${response.status}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${url} -> ${errorMsg}`);
      }

      if (retry < maxRetries - 1) {
        await sleep(RETRY_DELAY_MS * (retry + 1));
      }
    }
  }

  return { response: null, success: false, usedUrl: "", attempts, errors };
}

interface FreshnessCheckResult {
  isStale: boolean;
  checkDate: Date | null;
  checkSource: string;
}

function isValidExistingDataForFreshness(data: unknown): data is TrackerData {
  if (!data || typeof data !== "object") {
    return false;
  }
  return validateTrackerData(data as TrackerData).valid;
}

function checkDataFreshness(
  easyPrivacySuccess: boolean,
  easyPrivacyVersionDate: Date | null,
  existingData: TrackerData | null
): FreshnessCheckResult {
  let checkDate: Date | null = null;
  let checkSource = "";

  if (easyPrivacySuccess) {
    if (easyPrivacyVersionDate) {
      checkDate = easyPrivacyVersionDate;
      checkSource = "EasyPrivacy 源版本日期";
    } else {
      return { isStale: true, checkDate: null, checkSource: "EasyPrivacy 成功但版本日期不可解析" };
    }
  } else if (isValidExistingDataForFreshness(existingData)) {
    checkDate = new Date(existingData.lastUpdated);
    checkSource = "现有数据 lastUpdated";
  }

  let isStale = true;
  if (checkDate) {
    const now = new Date();
    const nowUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const diffMs = nowUtc.getTime() - checkDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    isStale = diffDays > MAX_STALENESS_DAYS;
  }

  return { isStale, checkDate, checkSource };
}

function parseVersion(line: string): { version: string; versionDate: Date | null } {
  const version = line.replace("! Version:", "").trim();
  const dateMatch = /(\d{4})(\d{2})(\d{2})/.exec(version);
  if (!dateMatch) {
    return { version, versionDate: null };
  }
  const year = Number.parseInt(dateMatch[1], 10);
  const month = Number.parseInt(dateMatch[2], 10) - 1;
  const day = Number.parseInt(dateMatch[3], 10);
  return { version, versionDate: new Date(Date.UTC(year, month, day)) };
}

function shouldSkipLine(line: string): boolean {
  return (
    line.startsWith("!") ||
    line.startsWith("[") ||
    !line.trim() ||
    line.startsWith("@@") ||
    line.startsWith("##") ||
    line.startsWith("#?#") ||
    line.startsWith("#@#")
  );
}

function cleanRule(rule: string): string {
  let cleaned = rule.trim();
  if (cleaned.startsWith("||")) {
    cleaned = cleaned.slice(2);
  }
  cleaned = cleaned.replace(/\^.*$/, "");
  cleaned = cleaned.replace(/\$.*$/, "");
  cleaned = cleaned.replace(/\/\*.*$/, "");
  if (cleaned.includes("/")) {
    cleaned = cleaned.split("/")[0];
  }
  if (cleaned.includes("?")) {
    cleaned = cleaned.split("?")[0];
  }
  return cleaned.toLowerCase().trim();
}

function parseEasyPrivacy(text: string): {
  domains: Set<string>;
  version: string;
  versionDate: Date | null;
  filteredCount: number;
  totalProcessed: number;
} {
  const domains = new Set<string>();
  let version = "unknown";
  let versionDate: Date | null = null;
  let filteredCount = 0;
  let totalProcessed = 0;

  const lines = text.split("\n");
  for (const line of lines) {
    if (line.startsWith("! Version:")) {
      const parsed = parseVersion(line);
      version = parsed.version;
      versionDate = parsed.versionDate;
      continue;
    }

    if (shouldSkipLine(line)) {
      continue;
    }

    const domain = cleanRule(line);
    totalProcessed++;

    if (isValidHostname(domain)) {
      domains.add(domain);
    } else {
      filteredCount++;
    }
  }

  return { domains, version, versionDate, filteredCount, totalProcessed };
}

function parsePeterLowe(text: string): {
  domains: Set<string>;
  version: string;
  filteredCount: number;
  totalProcessed: number;
} {
  const domains = new Set<string>();
  let version = "unknown";
  let filteredCount = 0;
  let totalProcessed = 0;

  const lines = text.split("\n");
  for (const line of lines) {
    if (line.startsWith("!Last modified:") || line.startsWith("! Last modified:")) {
      version = line.replace(/^!?\s*Last modified:/, "").trim();
      continue;
    }
    if (line.startsWith("!Entries:") || line.startsWith("! Entries:")) {
      continue;
    }

    if (shouldSkipLine(line)) {
      continue;
    }

    const domain = cleanRule(line);
    totalProcessed++;

    if (isValidHostname(domain)) {
      domains.add(domain);
    } else {
      filteredCount++;
    }
  }

  return { domains, version, filteredCount, totalProcessed };
}

function validateTrackingDomains(domains: unknown, errors: string[]): void {
  if (Array.isArray(domains)) {
    if (domains.length === 0) {
      errors.push("trackingDomains 不能为空");
    }
    for (const domain of domains) {
      if (typeof domain !== "string") {
        errors.push("trackingDomains 包含非字符串值: " + JSON.stringify(domain));
      } else if (!isValidHostname(domain)) {
        errors.push("trackingDomains 包含无效域名: " + domain);
      }
    }
  } else {
    errors.push("trackingDomains 必须是数组");
  }
}

function validateTrackingCookieKeywords(keywords: unknown, errors: string[]): void {
  if (Array.isArray(keywords)) {
    if (keywords.length === 0) {
      errors.push("trackingCookieKeywords 不能为空");
    }
    for (const keyword of keywords) {
      if (typeof keyword !== "string") {
        errors.push("trackingCookieKeywords 包含非字符串值: " + JSON.stringify(keyword));
      } else if (!isValidCookieKeyword(keyword)) {
        errors.push("trackingCookieKeywords 包含无效关键词: " + keyword);
      }
    }
  } else {
    errors.push("trackingCookieKeywords 必须是数组");
  }
}

function validateLastUpdated(lastUpdated: unknown, errors: string[]): void {
  if (lastUpdated && typeof lastUpdated === "string") {
    const lastUpdatedDate = new Date(lastUpdated);
    if (Number.isNaN(lastUpdatedDate.getTime())) {
      errors.push("lastUpdated 必须是可解析的日期字符串");
    }
  } else {
    errors.push("lastUpdated 必须是有效的时间字符串");
  }
}

function validateSources(sources: unknown, errors: string[]): void {
  if (sources && typeof sources === "object") {
    const src = sources as Record<string, unknown>;
    if (!src.easyprivacy || typeof src.easyprivacy !== "object") {
      errors.push("sources.easyprivacy 必须是对象");
    }
    if (!src.peterlowe || typeof src.peterlowe !== "object") {
      errors.push("sources.peterlowe 必须是对象");
    }
  } else {
    errors.push("sources 必须是对象");
  }
}

function validateKeys(data: TrackerData, errors: string[]): void {
  const allowedKeys = ["trackingDomains", "trackingCookieKeywords", "lastUpdated", "sources"];
  const actualKeys = Object.keys(data);
  for (const key of actualKeys) {
    if (!allowedKeys.includes(key)) {
      errors.push("不允许的额外字段: " + key);
    }
  }
  for (const key of allowedKeys) {
    if (!actualKeys.includes(key)) {
      errors.push("缺少必需字段: " + key);
    }
  }
}

function validateTrackerData(data: TrackerData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  validateTrackingDomains(data.trackingDomains, errors);
  validateTrackingCookieKeywords(data.trackingCookieKeywords, errors);
  validateLastUpdated(data.lastUpdated, errors);
  validateSources(data.sources, errors);
  validateKeys(data, errors);

  return { valid: errors.length === 0, errors };
}

interface EasyPrivacyResult {
  domains: Set<string>;
  downloaded: boolean;
  parsed: boolean;
  valid: boolean;
  success: boolean;
  count: number;
  filtered: number;
  total: number;
  version: string;
  versionDate: Date | null;
}

async function fetchEasyPrivacy(): Promise<EasyPrivacyResult> {
  const result: EasyPrivacyResult = {
    domains: new Set<string>(),
    downloaded: false,
    parsed: false,
    valid: false,
    success: false,
    count: 0,
    filtered: 0,
    total: 0,
    version: "unknown",
    versionDate: null,
  };

  console.log("📥 正在下载 EasyPrivacy 数据...");
  try {
    const response = await fetchWithTimeout(EASYPRIVACY_URL);
    result.downloaded = response.ok;
    if (response.ok) {
      const text = await response.text();
      const parsed = parseEasyPrivacy(text);
      result.parsed = true;
      result.domains = parsed.domains;
      result.version = parsed.version;
      result.versionDate = parsed.versionDate;
      result.count = parsed.domains.size;
      result.filtered = parsed.filteredCount;
      result.total = parsed.totalProcessed;
      result.valid = result.count > 0;
      result.success = result.valid;
      console.log("✅ EasyPrivacy: " + result.count + " 个有效域名 (版本: " + result.version + ")");
      console.log(
        "   - 下载: 成功, 解析: 成功, 有效: " +
          (result.valid ? "是" : "否") +
          ", 过滤: " +
          result.filtered +
          " 个非法条目, 处理: " +
          result.total +
          " 个原始规则"
      );
    } else {
      console.log("❌ EasyPrivacy 下载失败: HTTP " + response.status);
    }
  } catch (error) {
    console.log("❌ EasyPrivacy 下载出错: " + error);
  }

  return result;
}

interface PeterLoweResult {
  domains: Set<string>;
  downloaded: boolean;
  parsed: boolean;
  valid: boolean;
  success: boolean;
  count: number;
  filtered: number;
  total: number;
  version: string;
}

async function fetchPeterLowe(): Promise<PeterLoweResult> {
  const result: PeterLoweResult = {
    domains: new Set<string>(),
    downloaded: false,
    parsed: false,
    valid: false,
    success: false,
    count: 0,
    filtered: 0,
    total: 0,
    version: "unknown",
  };

  console.log("\n📥 正在下载 Peter Lowe's Blocklist 数据...");
  console.log(
    "   尝试 " + PETER_LOWE_URLS.length + " 个备用源，每个最多重试 " + MAX_RETRIES + " 次"
  );

  const fetchResult = await fetchWithRetryAndFallback(PETER_LOWE_URLS);

  if (!fetchResult.success || !fetchResult.response) {
    console.log("❌ Peter Lowe's Blocklist 所有下载尝试均失败:");
    for (const error of fetchResult.errors) {
      console.log("   - " + error);
    }
    console.log("   总计尝试: " + fetchResult.attempts + " 次");
    return result;
  }

  result.downloaded = true;
  console.log("✅ 从备用源下载成功: " + fetchResult.usedUrl);
  console.log("   总计尝试: " + fetchResult.attempts + " 次");

  try {
    const text = await fetchResult.response.text();
    const parsed = parsePeterLowe(text);
    result.parsed = true;
    result.domains = parsed.domains;
    result.version = parsed.version;
    result.count = parsed.domains.size;
    result.filtered = parsed.filteredCount;
    result.total = parsed.totalProcessed;
    result.valid = result.count > 0;
    if (result.valid) {
      result.success = true;
      console.log(
        "✅ Peter Lowe's: " + result.count + " 个有效域名 (更新时间: " + result.version + ")"
      );
      console.log(
        "   - 下载: 成功, 解析: 成功, 有效: 是, 过滤: " +
          result.filtered +
          " 个非法条目, 处理: " +
          result.total +
          " 个原始规则"
      );
    } else {
      console.log("⚠️ Peter Lowe's 数据为空，未提取到有效域名");
      console.log("   - 下载: 成功, 解析: 成功, 有效: 否");
    }
  } catch (error) {
    console.log("❌ Peter Lowe's 解析出错: " + error);
  }

  return result;
}

function processKeywords(): Set<string> {
  const invalidKeywords: string[] = [];
  const validKeywords = new Set<string>();
  for (const rawKeyword of trackingCookieKeywordsConfig.keywords) {
    const keyword = String(rawKeyword).toLowerCase();
    if (!isValidCookieKeyword(keyword)) {
      invalidKeywords.push(String(rawKeyword));
      continue;
    }
    validKeywords.add(keyword);
  }

  if (invalidKeywords.length > 0) {
    throw new Error("tracking-cookie-keywords.json 包含无效关键词: " + invalidKeywords.join(", "));
  }

  return validKeywords;
}

async function fetchData(): Promise<{
  data: TrackerData;
  stats: {
    easyPrivacy: {
      downloaded: boolean;
      parsed: boolean;
      valid: boolean;
      success: boolean;
      count: number;
      filtered: number;
      total: number;
      version: string;
      versionDate: Date | null;
    };
    peterLowe: {
      downloaded: boolean;
      parsed: boolean;
      valid: boolean;
      success: boolean;
      count: number;
      filtered: number;
      total: number;
      version: string;
    };
    merged: { count: number; duplicates: number };
  };
}> {
  const easyPrivacy = await fetchEasyPrivacy();
  const peterLowe = await fetchPeterLowe();

  const allDomains = new Set([...easyPrivacy.domains, ...peterLowe.domains]);
  const totalFromBoth = easyPrivacy.domains.size + peterLowe.domains.size;
  const duplicates = totalFromBoth - allDomains.size;
  console.log("\n📊 合并后总计: " + allDomains.size + " 个唯一追踪域名");
  console.log("   - 去重: " + duplicates + " 个重复域名");

  const validKeywords = processKeywords();

  return {
    data: {
      trackingDomains: Array.from(allDomains).sort((a, b) => a.localeCompare(b)),
      trackingCookieKeywords: Array.from(validKeywords).sort((a, b) => a.localeCompare(b)),
      lastUpdated: new Date().toISOString(),
      sources: {
        easyprivacy: {
          count: easyPrivacy.count,
          version: easyPrivacy.version,
        },
        peterlowe: {
          count: peterLowe.count,
          version: peterLowe.version,
        },
      },
    },
    stats: {
      easyPrivacy: {
        downloaded: easyPrivacy.downloaded,
        parsed: easyPrivacy.parsed,
        valid: easyPrivacy.valid,
        success: easyPrivacy.success,
        count: easyPrivacy.count,
        filtered: easyPrivacy.filtered,
        total: easyPrivacy.total,
        version: easyPrivacy.version,
        versionDate: easyPrivacy.versionDate,
      },
      peterLowe: {
        downloaded: peterLowe.downloaded,
        parsed: peterLowe.parsed,
        valid: peterLowe.valid,
        success: peterLowe.success,
        count: peterLowe.count,
        filtered: peterLowe.filtered,
        total: peterLowe.total,
        version: peterLowe.version,
      },
      merged: {
        count: allDomains.size,
        duplicates: duplicates,
      },
    },
  };
}

async function loadExistingData(outputPath: string): Promise<TrackerData | null> {
  const outputFile = Bun.file(outputPath);
  if (!(await outputFile.exists())) return null;
  try {
    const data = (await outputFile.json()) as TrackerData;
    if (data?.lastUpdated) {
      const lastUpdateDate = new Date(data.lastUpdated);
      const now = new Date();
      const diffMs = now.getTime() - lastUpdateDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      console.log("📅 现有数据更新于: " + data.lastUpdated + " (距今 " + diffDays + " 天前)");
    }
    return data;
  } catch {
    console.log("⚠️  无法读取现有数据文件");
    return null;
  }
}

function handleValidationFailure(
  validation: { valid: boolean; errors: string[] },
  allowFailure: boolean
): boolean {
  console.error("❌ 数据验证失败:");
  for (const error of validation.errors) {
    console.error("   - " + error);
  }
  if (!allowFailure) {
    process.exit(1);
  }
  console.log("\n⚠️  允许失败模式：不覆盖现有 tracker-domains.json");
  return false;
}

function handleEasyPrivacyFailure(allowFailure: boolean): boolean {
  console.error("\n❌ EasyPrivacy 必需模式失败：EasyPrivacy 来源必须成功");
  console.error("   - EasyPrivacy: ❌ 失败");
  if (!allowFailure) {
    process.exit(1);
  }
  console.log("\n⚠️  允许失败模式：不覆盖现有 tracker-domains.json");
  return false;
}

function logFreshnessInfo(freshness: FreshnessCheckResult): void {
  if (freshness.checkDate) {
    console.log(
      "📅 新鲜度检查基于: " + freshness.checkSource + " (" + freshness.checkDate.toISOString() + ")"
    );
    const now = new Date();
    const nowUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const diffMs = nowUtc.getTime() - freshness.checkDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    console.log("   距今: " + Math.floor(diffDays) + " 天，限制: " + MAX_STALENESS_DAYS + " 天");
  } else {
    console.log("⚠️  无法获取可靠的新鲜度检查日期");
  }
}

function handleFreshnessFailure(freshness: FreshnessCheckResult, allowFailure: boolean): boolean {
  console.error("\n❌ 新鲜度强制模式失败：数据不满足新鲜度要求！");
  console.error("   - 当前数据新鲜度: ❌ 陈旧");
  console.error("   - 新鲜度检查来源: " + freshness.checkSource);
  if (!allowFailure) {
    process.exit(1);
  }
  console.log("\n⚠️  允许失败模式：不覆盖现有 tracker-domains.json");
  return false;
}

function isCoreDataChanged(newData: TrackerData, existingData: TrackerData | null): boolean {
  if (!existingData) return true;

  const domainsChanged =
    newData.trackingDomains.length !== existingData.trackingDomains.length ||
    newData.trackingDomains.some((domain, i) => domain !== existingData.trackingDomains[i]);

  const keywordsChanged =
    newData.trackingCookieKeywords.length !== existingData.trackingCookieKeywords.length ||
    newData.trackingCookieKeywords.some(
      (keyword, i) => keyword !== existingData.trackingCookieKeywords[i]
    );

  return domainsChanged || keywordsChanged;
}

async function writeTrackerData(
  data: TrackerData,
  outputPath: string,
  tempPath: string,
  existingData: TrackerData | null
): Promise<boolean> {
  if (!isCoreDataChanged(data, existingData)) {
    console.log("\n✅ 数据内容未变化，跳过文件更新（避免无意义 diff）");
    console.log("   - 追踪域名数量: " + data.trackingDomains.length);
    console.log("   - Cookie关键词数量: " + data.trackingCookieKeywords.length);
    console.log("   - EasyPrivacy版本: " + data.sources.easyprivacy.version);
    return false;
  }

  await mkdir(DATA_DIR, { recursive: true });

  await Bun.write(tempPath, JSON.stringify(data, null, 2));
  await rename(tempPath, outputPath);
  console.log("\n✅ 数据已保存到: " + outputPath);
  return true;
}

function printSourceStatus(
  name: string,
  stats: {
    success: boolean;
    downloaded: boolean;
    parsed: boolean;
    valid: boolean;
    count: number;
    version?: string;
  }
): void {
  console.log("📍 " + name + ":");
  if (stats.success) {
    const versionInfo = stats.version ? " (版本: " + stats.version + ")" : "";
    console.log("   ✅ " + stats.count + " 个有效域名" + versionInfo);
  } else if (!stats.downloaded) {
    console.log("   ❌ 下载失败");
  } else if (!stats.parsed) {
    console.log("   ❌ 解析失败");
  } else if (!stats.valid) {
    console.log("   ⚠️ 数据为空");
  }
}

function printStats(
  data: TrackerData,
  stats: Awaited<ReturnType<typeof fetchData>>["stats"],
  finalDataIsStale: boolean,
  dataUpdated: boolean
): void {
  console.log("\n📊 数据更新结果:");
  console.log("----------------------------------------");
  printSourceStatus("EasyPrivacy", stats.easyPrivacy);
  printSourceStatus("Peter Lowe's", stats.peterLowe);

  console.log("📈 合并结果:");
  console.log("   最终唯一域名: " + stats.merged.count);
  console.log("   去重数量: " + stats.merged.duplicates);
  console.log("   Cookie关键词: " + data.trackingCookieKeywords.length);

  if (dataUpdated) {
    console.log("   本地生成时间: " + data.lastUpdated);
    console.log("\n✅ 文件已更新（追踪域名或Cookie关键词发生变化）");
  } else {
    console.log("\n⏭️  文件未更新（域名和关键词均无变化，避免无意义 diff）");
  }

  console.log("\n📋 快速判断:");
  console.log("   数据可信: " + (stats.easyPrivacy.success ? "✅ 是" : "❌ 否"));
  console.log("   数据最新: " + (finalDataIsStale ? "❌ 否" : "✅ 是"));
}

function handleSourceFailures(
  easyPrivacySuccess: boolean,
  peterLoweSuccess: boolean,
  allowFailure: boolean
): boolean {
  if (!easyPrivacySuccess) {
    if (allowFailure) {
      console.log("\n⚠️  允许失败模式：EasyPrivacy 失败，不覆盖现有 tracker-domains.json");
      console.log("   - EasyPrivacy: ❌ 失败");
      console.log("   - Peter Lowe's: " + (peterLoweSuccess ? "✅ 成功" : "❌ 失败"));
      return false;
    }
    handleEasyPrivacyFailure(false);
    return false;
  }

  if (!peterLoweSuccess && !allowFailure) {
    console.error("\n❌ Peter Lowe's 来源失败：默认模式下不写入部分数据");
    console.error("   - EasyPrivacy: ✅ 成功");
    console.error("   - Peter Lowe's: ❌ 失败");
    process.exit(1);
  }

  return true;
}

async function main(
  allowFailure: boolean = false,
  requireEasyPrivacy: boolean = false,
  enforceFreshness: boolean = false
): Promise<void> {
  console.log("🚀 开始更新 Cookie 风险识别数据...");
  console.log("========================================");
  if (requireEasyPrivacy) {
    console.log("🔒  EasyPrivacy 必需模式");
  }
  if (enforceFreshness) {
    console.log("🔒  新鲜度强制模式");
  }
  console.log("");

  try {
    const outputPath = join(DATA_DIR, "tracker-domains.json");
    const tempPath = join(DATA_DIR, "tracker-domains.tmp.json");

    const existingData = await loadExistingData(outputPath);
    console.log("");

    const { data, stats } = await fetchData();

    console.log("\n🔍 正在验证数据...");
    const validation = validateTrackerData(data);
    if (!validation.valid) {
      handleValidationFailure(validation, allowFailure);
      return;
    }
    console.log("✅ 数据验证通过");

    if (requireEasyPrivacy && !stats.easyPrivacy.success) {
      handleEasyPrivacyFailure(allowFailure);
      return;
    }

    const freshness = checkDataFreshness(
      stats.easyPrivacy.success,
      stats.easyPrivacy.versionDate,
      existingData
    );
    logFreshnessInfo(freshness);

    if (enforceFreshness && freshness.isStale) {
      handleFreshnessFailure(freshness, allowFailure);
      return;
    }

    if (!handleSourceFailures(stats.easyPrivacy.success, stats.peterLowe.success, allowFailure)) {
      return;
    }

    const dataUpdated = await writeTrackerData(data, outputPath, tempPath, existingData);
    printStats(data, stats, freshness.isStale, dataUpdated);
  } catch (error) {
    console.error("❌ 更新失败:", error);
    if (allowFailure) {
      console.log("\n⚠️  允许失败模式：不覆盖现有 tracker-domains.json");
      return;
    }
    process.exit(1);
  }
}

const scriptFlags = new Set(Bun.argv.slice(2));
const allowFailure = scriptFlags.has("--allow-failure");
const requireEasyPrivacy = scriptFlags.has("--require-easyprivacy");
const enforceFreshness = scriptFlags.has("--enforce-freshness");

try {
  await main(allowFailure, requireEasyPrivacy, enforceFreshness);
} catch (error) {
  console.error("❌ 未预期的错误:", error);
  process.exit(1);
}
