import { storage, WHITELIST_KEY, BLACKLIST_KEY } from "@/lib/store";
import type { Settings } from "@/types";
import { ModeType } from "@/types";
import { isInList, normalizeDomain } from "@/utils/domain";

export interface DomainPolicyCheckOptions {
  domain: string;
  mode?: ModeType;
  whitelist?: string[];
  blacklist?: string[];
}

export const shouldCleanupDomain = (options: DomainPolicyCheckOptions): boolean => {
  const { domain, mode, whitelist, blacklist } = options;
  const normalizedDomain = normalizeDomain(domain);
  if (mode === ModeType.WHITELIST) {
    return !isInList(normalizedDomain, whitelist || []);
  } else if (mode === ModeType.BLACKLIST) {
    return isInList(normalizedDomain, blacklist || []);
  }
  return false;
};

export const getCleanupSettings = async (
  settings: Settings
): Promise<{
  settings: Settings;
  whitelist: string[];
  blacklist: string[];
}> => {
  // 注意：此处的列表读取可能与 DomainManager 的写入存在极低概率的并发
  // 详细分析见 src/components/DomainManager.tsx 顶部的架构决策说明
  // 当前评估：可接受的风险（写入频率 < 0.01 Hz，cleanup 读取耗时 < 100ms）
  const whitelist = (await storage.getItem<string[]>(WHITELIST_KEY)) || [];
  const blacklist = (await storage.getItem<string[]>(BLACKLIST_KEY)) || [];

  return { settings, whitelist, blacklist };
};
