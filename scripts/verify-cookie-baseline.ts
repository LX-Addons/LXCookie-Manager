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

import { execSync } from "child_process";

// 定义影响 Cookie 数据生成的文件（修改这些文件必须同步更新 tracker-domains.json）
const COOKIE_RELATED_FILES = [
  "scripts/update-tracker-data.ts",
  "src/data/tracker-domains.d.ts",
  "src/lib/cookie-data-validators.ts",
];

// 定义策略/CI 文件（修改这些文件不会触发强制更新数据，但必须经过 CI 策略校验）
const POLICY_FILES = [
  "package.json",
  ".github/workflows/build-and-check.yml",
  ".github/workflows/release.yml",
  "scripts/verify-cookie-baseline.ts",
];

// 必须同步更新的数据文件
const TRACKER_DATA_FILE = "src/data/tracker-domains.json";

function getChangedFiles(baseSha: string, headSha: string): string[] {
  try {
    const output = execSync(`git diff --name-only ${baseSha}...${headSha}`, {
      encoding: "utf-8",
    });
    return output.trim().split("\n").filter(Boolean);
  } catch (error) {
    console.error("❌ 获取变更文件失败:", error);
    process.exit(1);
  }
}

function getChangedFilesForFirstPush(afterSha: string): string[] {
  try {
    const output = execSync(`git diff-tree --no-commit-id --name-only -r ${afterSha}`, {
      encoding: "utf-8",
    });
    return output.trim().split("\n").filter(Boolean);
  } catch (error) {
    console.error("❌ 获取首次 push 变更文件失败:", error);
    process.exit(1);
  }
}

function verifyConsistency(): void {
  console.log("🔍 Cookie 数据基线一致性校验");
  console.log("========================================");

  let changedFiles: string[] = [];
  let baseSha: string = "";
  let headSha: string = "";

  // 解析命令行参数
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("❌ 请提供参数：");
    console.error("   --pr <base-sha> <head-sha> : PR 模式");
    console.error("   --push <before-sha> <after-sha> : Push 模式");
    process.exit(1);
  }

  if (args[0] === "--pr" && args.length === 3) {
    baseSha = args[1];
    headSha = args[2];
    console.log("📋 模式: PR 比较");
    console.log("   Base SHA:", baseSha);
    console.log("   Head SHA:", headSha);
    changedFiles = getChangedFiles(baseSha, headSha);
  } else if (args[0] === "--push" && args.length === 3) {
    baseSha = args[1];
    headSha = args[2];
    console.log("📋 模式: Push 比较");
    console.log("   Before SHA:", baseSha);
    console.log("   After SHA:", headSha);

    if (baseSha === "0000000000000000000000000000000000000000") {
      console.log("   检测到首次 push");
      changedFiles = getChangedFilesForFirstPush(headSha);
    } else {
      changedFiles = getChangedFiles(baseSha, headSha);
    }
  } else {
    console.error("❌ 无效的参数组合");
    process.exit(1);
  }

  console.log("\n📝 变更的文件:");
  if (changedFiles.length === 0) {
    console.log("   (无变更)");
  } else {
    changedFiles.forEach((file) => console.log("   -", file));
  }

  // 检查是否有 Cookie 数据相关文件变更
  const hasCookieRelatedChanges = COOKIE_RELATED_FILES.some((file) => changedFiles.includes(file));

  // 检查 tracker-domains.json 是否也在变更文件中
  const hasTrackerDataChanges = changedFiles.includes(TRACKER_DATA_FILE);

  console.log("\n🔍 检查结果:");
  console.log("   Cookie 相关文件变更:", hasCookieRelatedChanges ? "✅ 是" : "❌ 否");
  console.log("   tracker-domains.json 变更:", hasTrackerDataChanges ? "✅ 是" : "❌ 否");

  const hasPolicyChanges = POLICY_FILES.some((file) => changedFiles.includes(file));
  if (hasPolicyChanges) {
    console.log("   策略/CI 文件变更:", "⚠️  是");
    console.log("   （策略文件变更不要求强制更新数据文件，但必须经过 CI 策略校验）");
  }

  if (hasCookieRelatedChanges && !hasTrackerDataChanges) {
    console.error("\n❌ 校验失败！");
    console.error("   Cookie 数据相关文件有变更，但 tracker-domains.json 未同步更新！");
    console.error("\n   请执行以下步骤:");
    console.error("   1. 运行: pnpm run prepare:cookie-data");
    console.error("   2. 提交: git add src/data/tracker-domains.json");
    process.exit(1);
  }

  if (hasCookieRelatedChanges && hasTrackerDataChanges) {
    console.log("\n✅ 校验通过！");
    console.log("   Cookie 数据相关文件和 tracker-domains.json 都已同步更新");
  } else {
    console.log("\n⚠️  无 Cookie 数据相关文件变更，跳过强制校验");
  }

  process.exit(0);
}

verifyConsistency();
