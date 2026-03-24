import type { DataClearResult } from "@/types";

export interface ClearBrowserDataOptions {
  clearCache?: boolean;
  clearLocalStorage?: boolean;
  clearIndexedDB?: boolean;
}

export interface ClearBrowserDataResult {
  cache: DataClearResult;
  localStorage: DataClearResult;
  indexedDB: DataClearResult;
}

export const buildOrigins = (domains: Set<string>): string[] => {
  return [...domains].flatMap((d) => [`https://${d}`, `http://${d}`]);
};

export const buildNonEmptyOrigins = (domains: Set<string>): [string, ...string[]] | null => {
  if (domains.size === 0) {
    return null;
  }
  const origins = buildOrigins(domains);
  if (origins.length === 0) {
    return null;
  }
  return origins as [string, ...string[]];
};

type BrowsingDataType = "cache" | "localStorage" | "indexedDB";

const BROWSING_DATA_OPTIONS: Record<BrowsingDataType, chrome.browsingData.DataTypeSet> = {
  cache: { cache: true, cacheStorage: true, fileSystems: true, serviceWorkers: true },
  localStorage: { localStorage: true },
  indexedDB: { indexedDB: true },
};

const clearSingleDataType = async (
  origins: [string, ...string[]] | null,
  dataType: BrowsingDataType
): Promise<DataClearResult> => {
  if (!origins) {
    return { success: true };
  }
  try {
    await chrome.browsingData.remove({ origins }, BROWSING_DATA_OPTIONS[dataType]);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
};

export const clearBrowserData = async (
  domains: Set<string>,
  options: ClearBrowserDataOptions
): Promise<ClearBrowserDataResult> => {
  const origins = buildNonEmptyOrigins(domains);

  return {
    cache: options.clearCache ? await clearSingleDataType(origins, "cache") : { success: true },
    localStorage: options.clearLocalStorage
      ? await clearSingleDataType(origins, "localStorage")
      : { success: true },
    indexedDB: options.clearIndexedDB
      ? await clearSingleDataType(origins, "indexedDB")
      : { success: true },
  };
};
