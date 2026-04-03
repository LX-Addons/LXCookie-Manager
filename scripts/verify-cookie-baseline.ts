#!/usr/bin/env tsx
/**
 * Cookie 数据基线校验
 * =====================================
 *
 * 【职责】当 Cookie 数据相关文件变更时，tracker-domains.json 必须同步更新
 *
 * 【触发文件】COOKIE_RELATED_FILES 中的文件变更时触发强制校验
 *
 * 【调用方式】
 * - tsx scripts/verify-cookie-baseline.ts --pr <base-sha> <head-sha>
 * - tsx scripts/verify-cookie-baseline.ts --push <before-sha> <after-sha>
 */

import { execFileSync } from "node:child_process";

const COOKIE_RELATED_FILES = [
  "scripts/update-tracker-data.ts",
  "scripts/tracking-cookie-keywords.json",
  "src/data/tracker-domains.d.ts",
  "src/lib/cookie-data-validators.ts",
];

// 策略/CI 相关文件：变更时仅输出提示信息，不强制执行验证逻辑
const POLICY_FILES = [
  "package.json",
  ".github/workflows/build-and-check.yml",
  ".github/workflows/release.yml",
  "scripts/verify-cookie-baseline.ts",
];

const TRACKER_DATA_FILE = "src/data/tracker-domains.json";

const SHA_REGEX = /^[0-9a-f]{7,40}$/i;
const ZERO_SHA = "0000000000000000000000000000000000000000";

function isValidSha(sha: string): boolean {
  return SHA_REGEX.test(sha);
}

function validateSha(sha: string, name: string): void {
  if (!isValidSha(sha)) {
    console.error(`❌ 无效的 ${name} SHA 格式: "${sha}"`);
    console.error("   SHA 应为 7-40 位十六进制字符");
    process.exit(1);
  }
}

function getChangedFiles(baseSha: string, headSha: string): string[] {
  validateSha(baseSha, "base");
  validateSha(headSha, "head");
  try {
    const output = execFileSync("git", ["diff", "--name-only", `${baseSha}...${headSha}`], {
      encoding: "utf-8",
    });
    return output.trim().split("\n").filter(Boolean);
  } catch (error) {
    console.error("❌ 获取变更文件失败:", error);
    process.exit(1);
  }
}

function getChangedFilesForFirstPush(afterSha: string): string[] {
  validateSha(afterSha, "after");
  try {
    const output = execFileSync(
      "git",
      ["diff-tree", "--no-commit-id", "--name-only", "-r", afterSha],
      {
        encoding: "utf-8",
      }
    );
    return output.trim().split("\n").filter(Boolean);
  } catch (error) {
    console.error("❌ 获取首次 push 变更文件失败:", error);
    process.exit(1);
  }
}

interface ParsedArgs {
  mode: "pr" | "push";
  baseSha: string;
  headSha: string;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("❌ 请提供参数：");
    console.error("   --pr <base-sha> <head-sha> : PR 模式");
    console.error("   --push <before-sha> <after-sha> : Push 模式");
    process.exit(1);
  }

  if (args[0] === "--pr" && args.length === 3) {
    return { mode: "pr", baseSha: args[1], headSha: args[2] };
  }
  if (args[0] === "--push" && args.length === 3) {
    return { mode: "push", baseSha: args[1], headSha: args[2] };
  }

  console.error("❌ 无效的参数组合");
  process.exit(1);
}

function getChangedFilesForMode(args: ParsedArgs): string[] {
  if (args.mode === "pr") {
    console.log("📋 模式: PR 比较");
    console.log("   Base SHA:", args.baseSha);
    console.log("   Head SHA:", args.headSha);
    return getChangedFiles(args.baseSha, args.headSha);
  }

  console.log("📋 模式: Push 比较");
  console.log("   Before SHA:", args.baseSha);
  console.log("   After SHA:", args.headSha);

  if (args.baseSha === ZERO_SHA) {
    console.log("   检测到首次 push");
    return getChangedFilesForFirstPush(args.headSha);
  }
  return getChangedFiles(args.baseSha, args.headSha);
}

function checkConsistency(changedFiles: string[]): boolean {
  const hasCookieRelatedChanges = COOKIE_RELATED_FILES.some((file) => changedFiles.includes(file));
  const hasTrackerDataChanges = changedFiles.includes(TRACKER_DATA_FILE);
  const hasPolicyChanges = POLICY_FILES.some((file) => changedFiles.includes(file));

  console.log("\n🔍 检查结果:");
  console.log("   Cookie 相关文件变更:", hasCookieRelatedChanges ? "✅ 是" : "❌ 否");
  console.log("   tracker-domains.json 变更:", hasTrackerDataChanges ? "✅ 是" : "❌ 否");

  if (hasPolicyChanges) {
    console.log("   策略/CI 文件变更:", "⚠️  是");
    console.log("   （策略文件变更不要求强制更新数据文件，仅作提示）");
  }

  if (hasCookieRelatedChanges && !hasTrackerDataChanges) {
    console.error("\n❌ 校验失败！");
    console.error("   Cookie 数据相关文件有变更，但 tracker-domains.json 未同步更新！");
    console.error("\n   请执行以下步骤:");
    console.error("   1. 运行: pnpm run prepare:cookie-data");
    console.error("   2. 提交: git add src/data/tracker-domains.json");
    return false;
  }

  if (hasCookieRelatedChanges && hasTrackerDataChanges) {
    console.log("\n✅ 校验通过！");
    console.log("   Cookie 数据相关文件和 tracker-domains.json 都已同步更新");
  } else {
    console.log("\n⚠️  无 Cookie 数据相关文件变更，跳过强制校验");
  }

  return true;
}

function verifyConsistency(): void {
  console.log("🔍 Cookie 数据基线一致性校验");
  console.log("========================================");

  const args = parseArgs();
  const changedFiles = getChangedFilesForMode(args);

  console.log("\n📝 变更的文件:");
  if (changedFiles.length === 0) {
    console.log("   (无变更)");
  } else {
    changedFiles.forEach((file) => console.log("   -", file));
  }

  const isValid = checkConsistency(changedFiles);
  process.exit(isValid ? 0 : 1);
}

verifyConsistency();
