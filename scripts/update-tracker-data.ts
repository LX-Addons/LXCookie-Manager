import { writeFileSync, mkdirSync, existsSync, readFileSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isValidHostname, isValidCookieKeyword } from "../src/lib/cookie-data-validators.js";
import type { TrackerData } from "../src/data/tracker-domains.d.ts";
import trackingCookieKeywordsConfig from "./tracking-cookie-keywords.json" with { type: "json" };

/**
 * Cookie 数据维护约定（权威说明）
 * =================================
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
const DISCONNECT_URL =
  "https://raw.githubusercontent.com/disconnectme/disconnect-tracking-protection/master/services.json";

const MAX_STALENESS_DAYS = 14;
const FETCH_TIMEOUT_MS = 30000;

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

function processDomain(
  domain: unknown,
  domains: Set<string>
): { processed: number; filtered: number } {
  let filtered = 0;
  if (typeof domain === "string" && isValidHostname(domain)) {
    domains.add(domain.toLowerCase());
  } else {
    filtered++;
  }
  return { processed: 1, filtered };
}

function processTrackerDomains(
  trackerDomains: unknown,
  domains: Set<string>
): { processed: number; filtered: number } {
  if (!Array.isArray(trackerDomains)) {
    return { processed: 0, filtered: 0 };
  }
  let processed = 0;
  let filtered = 0;
  for (const domain of trackerDomains) {
    const result = processDomain(domain, domains);
    processed += result.processed;
    filtered += result.filtered;
  }
  return { processed, filtered };
}

function processEntityData(
  entityData: Record<string, unknown>,
  domains: Set<string>
): { processed: number; filtered: number } {
  let processed = 0;
  let filtered = 0;
  for (const trackerDomains of Object.values(entityData)) {
    const result = processTrackerDomains(trackerDomains, domains);
    processed += result.processed;
    filtered += result.filtered;
  }
  return { processed, filtered };
}

function processEntity(
  entity: Record<string, unknown>,
  domains: Set<string>
): { processed: number; filtered: number } {
  let processed = 0;
  let filtered = 0;
  for (const entityData of Object.values(entity)) {
    if (entityData && typeof entityData === "object") {
      const result = processEntityData(entityData as Record<string, unknown>, domains);
      processed += result.processed;
      filtered += result.filtered;
    }
  }
  return { processed, filtered };
}

function parseDisconnect(json: Record<string, unknown>): {
  domains: Set<string>;
  filteredCount: number;
  totalProcessed: number;
} {
  const domains = new Set<string>();
  let filteredCount = 0;
  let totalProcessed = 0;

  const categories = json.categories as Record<string, Array<Record<string, unknown>>> | undefined;
  if (!categories) {
    return { domains, filteredCount: 0, totalProcessed: 0 };
  }

  for (const category of Object.values(categories)) {
    for (const entity of category) {
      const result = processEntity(entity, domains);
      totalProcessed += result.processed;
      filteredCount += result.filtered;
    }
  }

  return { domains, filteredCount, totalProcessed };
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
    if (!src.disconnect || typeof src.disconnect !== "object") {
      errors.push("sources.disconnect 必须是对象");
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

interface DisconnectResult {
  domains: Set<string>;
  downloaded: boolean;
  parsed: boolean;
  valid: boolean;
  success: boolean;
  count: number;
  filtered: number;
  total: number;
}

async function fetchDisconnect(): Promise<DisconnectResult> {
  const result: DisconnectResult = {
    domains: new Set<string>(),
    downloaded: false,
    parsed: false,
    valid: false,
    success: false,
    count: 0,
    filtered: 0,
    total: 0,
  };

  console.log("\n📥 正在下载 Disconnect.me 数据...");
  try {
    const response = await fetchWithTimeout(DISCONNECT_URL);
    result.downloaded = response.ok;
    if (response.ok) {
      const json = (await response.json()) as Record<string, unknown>;
      const parsed = parseDisconnect(json);
      result.parsed = true;
      result.domains = parsed.domains;
      result.count = parsed.domains.size;
      result.filtered = parsed.filteredCount;
      result.total = parsed.totalProcessed;
      result.valid = result.count > 0;
      if (result.valid) {
        result.success = true;
        console.log("✅ Disconnect.me: " + result.count + " 个有效域名");
        console.log(
          "   - 下载: 成功, 解析: 成功, 有效: 是, 过滤: " +
            result.filtered +
            " 个非法条目, 处理: " +
            result.total +
            " 个原始条目"
        );
      } else {
        console.log("⚠️ Disconnect.me 数据为空，未提取到有效域名");
        console.log("   - 下载: 成功, 解析: 成功, 有效: 否");
      }
    } else {
      console.log("❌ Disconnect.me 下载失败: HTTP " + response.status);
    }
  } catch (error) {
    console.log("❌ Disconnect.me 下载出错: " + error);
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
    disconnect: {
      downloaded: boolean;
      parsed: boolean;
      valid: boolean;
      success: boolean;
      count: number;
      filtered: number;
      total: number;
    };
    merged: { count: number; duplicates: number };
  };
}> {
  const easyPrivacy = await fetchEasyPrivacy();
  const disconnect = await fetchDisconnect();

  const allDomains = new Set([...easyPrivacy.domains, ...disconnect.domains]);
  const totalFromBoth = easyPrivacy.domains.size + disconnect.domains.size;
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
        disconnect: {
          count: disconnect.count,
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
      disconnect: {
        downloaded: disconnect.downloaded,
        parsed: disconnect.parsed,
        valid: disconnect.valid,
        success: disconnect.success,
        count: disconnect.count,
        filtered: disconnect.filtered,
        total: disconnect.total,
      },
      merged: {
        count: allDomains.size,
        duplicates: duplicates,
      },
    },
  };
}

function loadExistingData(outputPath: string): TrackerData | null {
  if (!existsSync(outputPath)) return null;
  try {
    const data = JSON.parse(readFileSync(outputPath, "utf-8")) as TrackerData;
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

function writeTrackerData(data: TrackerData, outputPath: string, tempPath: string): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
  renameSync(tempPath, outputPath);
  console.log("\n✅ 数据已保存到: " + outputPath);
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
  finalDataIsStale: boolean
): void {
  console.log("\n📊 数据更新结果:");
  console.log("----------------------------------------");
  printSourceStatus("EasyPrivacy", stats.easyPrivacy);
  printSourceStatus("Disconnect.me", stats.disconnect);

  console.log("📈 合并结果:");
  console.log("   最终唯一域名: " + stats.merged.count);
  console.log("   去重数量: " + stats.merged.duplicates);
  console.log("   Cookie关键词: " + data.trackingCookieKeywords.length);
  console.log("   本地生成时间: " + data.lastUpdated);

  console.log("\n📋 快速判断:");
  console.log("   数据可信: " + (stats.easyPrivacy.success ? "✅ 是" : "❌ 否"));
  console.log("   数据最新: " + (finalDataIsStale ? "❌ 否" : "✅ 是"));
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

    const existingData = loadExistingData(outputPath);
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

    if (!stats.easyPrivacy.success) {
      if (allowFailure) {
        console.log("\n⚠️  允许失败模式：EasyPrivacy 失败，不覆盖现有 tracker-domains.json");
        console.log("   - EasyPrivacy: ❌ 失败");
        console.log("   - Disconnect: " + (stats.disconnect.success ? "✅ 成功" : "❌ 失败"));
        return;
      }
      handleEasyPrivacyFailure(false);
      return;
    }

    if (!stats.disconnect.success && !allowFailure) {
      console.error("\n❌ Disconnect.me 来源失败：默认模式下不写入部分数据");
      console.error("   - EasyPrivacy: ✅ 成功");
      console.error("   - Disconnect: ❌ 失败");
      process.exit(1);
    }

    writeTrackerData(data, outputPath, tempPath);
    printStats(data, stats, freshness.isStale);
  } catch (error) {
    console.error("❌ 更新失败:", error);
    if (allowFailure) {
      console.log("\n⚠️  允许失败模式：不覆盖现有 tracker-domains.json");
      return;
    }
    process.exit(1);
  }
}

const allowFailure = process.argv.includes("--allow-failure");
const requireEasyPrivacy = process.argv.includes("--require-easyprivacy");
const enforceFreshness = process.argv.includes("--enforce-freshness");

try {
  await main(allowFailure, requireEasyPrivacy, enforceFreshness);
} catch (error) {
  console.error("❌ 未预期的错误:", error);
  process.exit(1);
}
