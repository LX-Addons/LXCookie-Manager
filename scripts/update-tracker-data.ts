import { writeFileSync, mkdirSync, existsSync, readFileSync, renameSync, rmSync } from "node:fs";
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
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.trackingDomains) || d.trackingDomains.length === 0) {
    return false;
  }
  if (!Array.isArray(d.trackingCookieKeywords) || d.trackingCookieKeywords.length === 0) {
    return false;
  }
  if (typeof d.lastUpdated !== "string" || !d.lastUpdated) {
    return false;
  }
  const lastUpdatedDate = new Date(d.lastUpdated);
  if (Number.isNaN(lastUpdatedDate.getTime())) {
    return false;
  }
  if (!d.sources || typeof d.sources !== "object") {
    return false;
  }
  const sources = d.sources as Record<string, unknown>;
  if (!sources.easyprivacy || typeof sources.easyprivacy !== "object") {
    return false;
  }
  if (!sources.disconnect || typeof sources.disconnect !== "object") {
    return false;
  }
  const allowedKeys = ["trackingDomains", "trackingCookieKeywords", "lastUpdated", "sources"];
  const actualKeys = Object.keys(d);
  for (const key of actualKeys) {
    if (!allowedKeys.includes(key)) {
      return false;
    }
  }
  for (const key of allowedKeys) {
    if (!actualKeys.includes(key)) {
      return false;
    }
  }
  for (const domain of d.trackingDomains) {
    if (typeof domain !== "string" || !isValidHostname(domain)) {
      return false;
    }
  }
  for (const keyword of d.trackingCookieKeywords) {
    if (typeof keyword !== "string" || !isValidCookieKeyword(keyword)) {
      return false;
    }
  }
  return true;
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
  } else {
    if (isValidExistingDataForFreshness(existingData)) {
      checkDate = new Date(existingData.lastUpdated);
      checkSource = "现有数据 lastUpdated";
    }
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
      version = line.replace("! Version:", "").trim();
      const dateMatch = /(\d{4})(\d{2})(\d{2})/.exec(version);
      if (dateMatch) {
        const year = Number.parseInt(dateMatch[1], 10);
        const month = Number.parseInt(dateMatch[2], 10) - 1;
        const day = Number.parseInt(dateMatch[3], 10);
        versionDate = new Date(Date.UTC(year, month, day));
      }
    }

    if (line.startsWith("!") || line.startsWith("[") || !line.trim()) {
      continue;
    }

    if (line.startsWith("@@")) {
      continue;
    }

    if (line.startsWith("##") || line.startsWith("#?#") || line.startsWith("#@#")) {
      continue;
    }

    let rule = line.trim();

    if (rule.startsWith("||")) {
      rule = rule.slice(2);
    }

    rule = rule.replace(/\^.*$/, "");
    rule = rule.replace(/\$.*$/, "");
    rule = rule.replace(/\/\*.*$/, "");

    // 只取路径前的主机名部分
    if (rule.includes("/")) {
      rule = rule.split("/")[0];
    }
    if (rule.includes("?")) {
      rule = rule.split("?")[0];
    }

    const domain = rule.toLowerCase().trim();

    totalProcessed++;

    if (isValidHostname(domain)) {
      domains.add(domain);
    } else {
      filteredCount++;
    }
  }

  return { domains, version, versionDate, filteredCount, totalProcessed };
}

function parseDisconnect(json: Record<string, unknown>): {
  domains: Set<string>;
  filteredCount: number;
  totalProcessed: number;
} {
  const domains = new Set<string>();
  let filteredCount = 0;
  let totalProcessed = 0;

  const categories = json.categories as
    | Record<string, Array<{ [key: string]: { [key: string]: string[] } }>>
    | undefined;
  if (!categories) {
    return { domains, filteredCount: 0, totalProcessed: 0 };
  }

  for (const category of Object.values(categories)) {
    for (const entity of category) {
      for (const entityData of Object.values(entity)) {
        for (const trackerDomains of Object.values(entityData)) {
          if (Array.isArray(trackerDomains)) {
            for (const domain of trackerDomains) {
              totalProcessed++;
              if (typeof domain === "string") {
                if (isValidHostname(domain)) {
                  domains.add(domain.toLowerCase());
                } else {
                  filteredCount++;
                }
              } else {
                filteredCount++;
              }
            }
          }
        }
      }
    }
  }

  return { domains, filteredCount, totalProcessed };
}

function validateTrackerData(data: TrackerData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(data.trackingDomains)) {
    errors.push("trackingDomains 必须是数组");
  } else {
    if (data.trackingDomains.length === 0) {
      errors.push("trackingDomains 不能为空");
    }

    for (const domain of data.trackingDomains) {
      if (!isValidHostname(domain)) {
        errors.push("trackingDomains 包含无效域名: " + domain);
      }
    }
  }

  if (!Array.isArray(data.trackingCookieKeywords)) {
    errors.push("trackingCookieKeywords 必须是数组");
  } else {
    if (data.trackingCookieKeywords.length === 0) {
      errors.push("trackingCookieKeywords 不能为空");
    }

    for (const keyword of data.trackingCookieKeywords) {
      if (!isValidCookieKeyword(keyword)) {
        errors.push("trackingCookieKeywords 包含无效关键词: " + keyword);
      }
    }
  }

  if (!data.lastUpdated || typeof data.lastUpdated !== "string") {
    errors.push("lastUpdated 必须是有效的时间字符串");
  }

  if (!data.sources || typeof data.sources !== "object") {
    errors.push("sources 必须是对象");
  } else {
    if (!data.sources.easyprivacy || typeof data.sources.easyprivacy !== "object") {
      errors.push("sources.easyprivacy 必须是对象");
    }
    if (!data.sources.disconnect || typeof data.sources.disconnect !== "object") {
      errors.push("sources.disconnect 必须是对象");
    }
  }

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

  return { valid: errors.length === 0, errors };
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
  const easyPrivacyDomains = new Set<string>();
  let easyPrivacyVersion = "unknown";
  let easyPrivacyVersionDate: Date | null = null;
  let easyPrivacyDownloaded = false;
  let easyPrivacyParsed = false;
  let easyPrivacyValid = false;
  let easyPrivacySuccess = false;
  let easyPrivacyCount = 0;
  let easyPrivacyFiltered = 0;
  let easyPrivacyTotal = 0;

  console.log("📥 正在下载 EasyPrivacy 数据...");
  try {
    const easyPrivacyResponse = await fetchWithTimeout(EASYPRIVACY_URL);
    easyPrivacyDownloaded = easyPrivacyResponse.ok;
    if (easyPrivacyResponse.ok) {
      const easyPrivacyText = await easyPrivacyResponse.text();
      const easyPrivacyData = parseEasyPrivacy(easyPrivacyText);
      easyPrivacyParsed = true;
      for (const domain of easyPrivacyData.domains) {
        easyPrivacyDomains.add(domain);
      }
      easyPrivacyVersion = easyPrivacyData.version;
      easyPrivacyVersionDate = easyPrivacyData.versionDate;
      easyPrivacyCount = easyPrivacyData.domains.size;
      easyPrivacyFiltered = easyPrivacyData.filteredCount;
      easyPrivacyTotal = easyPrivacyData.totalProcessed;
      easyPrivacyValid = easyPrivacyCount > 0;
      easyPrivacySuccess = easyPrivacyValid;
      console.log(
        "✅ EasyPrivacy: " + easyPrivacyCount + " 个有效域名 (版本: " + easyPrivacyVersion + ")"
      );
      console.log(
        "   - 下载: 成功, 解析: 成功, 有效: " +
          (easyPrivacyValid ? "是" : "否") +
          ", 过滤: " +
          easyPrivacyFiltered +
          " 个非法条目, 处理: " +
          easyPrivacyTotal +
          " 个原始规则"
      );
    } else {
      console.log("❌ EasyPrivacy 下载失败: HTTP " + easyPrivacyResponse.status);
    }
  } catch (error) {
    console.log("❌ EasyPrivacy 下载出错: " + error);
  }

  const disconnectDomains = new Set<string>();
  let disconnectDownloaded = false;
  let disconnectParsed = false;
  let disconnectValid = false;
  let disconnectSuccess = false;
  let disconnectCount = 0;
  let disconnectFiltered = 0;
  let disconnectTotal = 0;

  console.log("\n📥 正在下载 Disconnect.me 数据...");
  try {
    const disconnectResponse = await fetchWithTimeout(DISCONNECT_URL);
    disconnectDownloaded = disconnectResponse.ok;
    if (disconnectResponse.ok) {
      const disconnectJson = (await disconnectResponse.json()) as Record<string, unknown>;
      const parsed = parseDisconnect(disconnectJson);
      disconnectParsed = true;
      for (const domain of parsed.domains) {
        disconnectDomains.add(domain);
      }
      disconnectCount = parsed.domains.size;
      disconnectFiltered = parsed.filteredCount;
      disconnectTotal = parsed.totalProcessed;
      disconnectValid = disconnectCount > 0;
      if (disconnectValid) {
        disconnectSuccess = true;
        console.log("✅ Disconnect.me: " + disconnectCount + " 个有效域名");
        console.log(
          "   - 下载: 成功, 解析: 成功, 有效: 是, 过滤: " +
            disconnectFiltered +
            " 个非法条目, 处理: " +
            disconnectTotal +
            " 个原始条目"
        );
      } else {
        console.log("⚠️ Disconnect.me 数据为空，未提取到有效域名");
        console.log("   - 下载: 成功, 解析: 成功, 有效: 否");
      }
    } else {
      console.log("❌ Disconnect.me 下载失败: HTTP " + disconnectResponse.status);
    }
  } catch (error) {
    console.log("❌ Disconnect.me 下载出错: " + error);
  }

  const allDomains = new Set([...easyPrivacyDomains, ...disconnectDomains]);
  const totalFromBoth = easyPrivacyDomains.size + disconnectDomains.size;
  const duplicates = totalFromBoth - allDomains.size;
  console.log("\n📊 合并后总计: " + allDomains.size + " 个唯一追踪域名");
  console.log("   - 去重: " + duplicates + " 个重复域名");

  const trackingCookieKeywords = trackingCookieKeywordsConfig.keywords.filter(isValidCookieKeyword);

  const validKeywords = new Set<string>();
  for (const keyword of trackingCookieKeywords) {
    if (isValidCookieKeyword(keyword)) {
      validKeywords.add(keyword.toLowerCase());
    }
  }

  return {
    data: {
      trackingDomains: Array.from(allDomains).sort((a, b) => a.localeCompare(b)),
      trackingCookieKeywords: Array.from(validKeywords).sort((a, b) => a.localeCompare(b)),
      lastUpdated: new Date().toISOString(),
      sources: {
        easyprivacy: {
          count: easyPrivacyCount,
          version: easyPrivacyVersion,
        },
        disconnect: {
          count: disconnectCount,
        },
      },
    },
    stats: {
      easyPrivacy: {
        downloaded: easyPrivacyDownloaded,
        parsed: easyPrivacyParsed,
        valid: easyPrivacyValid,
        success: easyPrivacySuccess,
        count: easyPrivacyCount,
        filtered: easyPrivacyFiltered,
        total: easyPrivacyTotal,
        version: easyPrivacyVersion,
        versionDate: easyPrivacyVersionDate,
      },
      disconnect: {
        downloaded: disconnectDownloaded,
        parsed: disconnectParsed,
        valid: disconnectValid,
        success: disconnectSuccess,
        count: disconnectCount,
        filtered: disconnectFiltered,
        total: disconnectTotal,
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
  if (existsSync(outputPath)) {
    rmSync(outputPath, { force: true });
  }
  renameSync(tempPath, outputPath);
  console.log("\n✅ 数据已保存到: " + outputPath);
}

function printStats(
  data: TrackerData,
  stats: Awaited<ReturnType<typeof fetchData>>["stats"],
  finalDataIsStale: boolean
): void {
  console.log("\n📊 数据更新结果:");
  console.log("----------------------------------------");
  console.log("📍 EasyPrivacy:");
  if (stats.easyPrivacy.success) {
    console.log(
      "   ✅ " + stats.easyPrivacy.count + " 个有效域名 (版本: " + stats.easyPrivacy.version + ")"
    );
  } else {
    if (!stats.easyPrivacy.downloaded) {
      console.log("   ❌ 下载失败");
    } else if (!stats.easyPrivacy.parsed) {
      console.log("   ❌ 解析失败");
    } else if (!stats.easyPrivacy.valid) {
      console.log("   ⚠️ 数据为空");
    }
  }

  console.log("📍 Disconnect.me:");
  if (stats.disconnect.success) {
    console.log("   ✅ " + stats.disconnect.count + " 个有效域名");
  } else {
    if (!stats.disconnect.downloaded) {
      console.log("   ❌ 下载失败");
    } else if (!stats.disconnect.parsed) {
      console.log("   ❌ 解析失败");
    } else if (!stats.disconnect.valid) {
      console.log("   ⚠️ 数据为空");
    }
  }

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

    if (allowFailure && !stats.easyPrivacy.success) {
      console.log("\n⚠️  允许失败模式：EasyPrivacy 失败，不覆盖现有 tracker-domains.json");
      console.log("   - EasyPrivacy: ❌ 失败");
      console.log("   - Disconnect: " + (stats.disconnect.success ? "✅ 成功" : "❌ 失败"));
      return;
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
main(allowFailure, requireEasyPrivacy, enforceFreshness).catch((error) => {
  console.error("❌ 未预期的错误:", error);
  process.exit(1);
});
