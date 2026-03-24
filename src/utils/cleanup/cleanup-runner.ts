import type { CleanupExecutionResult, CleanupTrigger, Settings } from "@/types";
import { CookieClearType, ModeType, CleanupError, CleanupStage, ErrorCode } from "@/types";
import { getCleanupSettings, shouldCleanupDomain } from "./domain-policy";
import { clearCookies, ClearCookiesOptions, ClearCookiesResult } from "./cookie-ops";
import { clearBrowserData, ClearBrowserDataOptions } from "./site-data-ops";
import { isDomainMatch } from "@/utils/domain";

export interface CleanupOptions {
  domain?: string;
  clearType?: CookieClearType;
  clearCache?: boolean;
  clearLocalStorage?: boolean;
  clearIndexedDB?: boolean;
  trigger: CleanupTrigger;
}

const getClearOptions = (
  options: CleanupOptions,
  settings: {
    clearType: CookieClearType;
    clearCache: boolean;
    clearLocalStorage: boolean;
    clearIndexedDB: boolean;
  }
): ClearBrowserDataOptions => ({
  clearCache: options.clearCache ?? settings.clearCache,
  clearLocalStorage: options.clearLocalStorage ?? settings.clearLocalStorage,
  clearIndexedDB: options.clearIndexedDB ?? settings.clearIndexedDB,
});

const createCookieResult = async (
  options: CleanupOptions,
  clearType: CookieClearType,
  settings: { mode: ModeType },
  whitelist: string[],
  blacklist: string[]
): Promise<ClearCookiesResult> => {
  if (options.domain) {
    const domain = options.domain;
    const cookieOptions: ClearCookiesOptions = {
      clearType,
      filterFn: (cookieDomain) => isDomainMatch(cookieDomain, domain),
    };
    return clearCookies(cookieOptions);
  }

  const shouldIncludeDomain = (domain: string) =>
    shouldCleanupDomain({ domain, mode: settings.mode, whitelist, blacklist });
  const cookieOptions: ClearCookiesOptions = {
    clearType,
    filterFn: shouldIncludeDomain,
  };
  return clearCookies(cookieOptions);
};

const createInitialResult = (
  options: CleanupOptions,
  startTime: number
): CleanupExecutionResult => ({
  success: false,
  trigger: options.trigger,
  requestedDomain: options.domain,
  matchedDomains: [],
  cookiesRemoved: 0,
  browserDataCleared: {
    cache: { success: true, attempted: false },
    localStorage: { success: true, attempted: false },
    indexedDB: { success: true, attempted: false },
  },
  partialFailures: [],
  durationMs: 0,
  timestamp: startTime,
});

const handleBrowserDataClear = async (
  result: CleanupExecutionResult,
  clearedDomains: Set<string>,
  clearOptions: ClearBrowserDataOptions,
  domain?: string
): Promise<void> => {
  try {
    const browserDataResult = await clearBrowserData(clearedDomains, clearOptions);
    result.browserDataCleared = browserDataResult;

    if (!browserDataResult.cache.success && browserDataResult.cache.error) {
      result.partialFailures.push({
        stage: CleanupStage.CACHE,
        domain,
        reason: browserDataResult.cache.error,
      });
    }
    if (!browserDataResult.localStorage.success && browserDataResult.localStorage.error) {
      result.partialFailures.push({
        stage: CleanupStage.LOCAL_STORAGE,
        domain,
        reason: browserDataResult.localStorage.error,
      });
    }
    if (!browserDataResult.indexedDB.success && browserDataResult.indexedDB.error) {
      result.partialFailures.push({
        stage: CleanupStage.INDEXED_DB,
        domain,
        reason: browserDataResult.indexedDB.error,
      });
    }
  } catch (e) {
    result.partialFailures.push({
      stage: CleanupStage.STORAGE,
      domain,
      reason: e instanceof Error ? e.message : "Unknown error",
    });
  }
};

const handleCookieClearError = (domain?: string, error?: unknown): never => {
  const message = error instanceof Error ? error.message : "Unknown error";

  if (error instanceof CleanupError) {
    throw error;
  }

  if (
    error instanceof Error &&
    (error.message.includes("permission") ||
      error.message.includes("Permission") ||
      error.message.includes("access denied"))
  ) {
    throw new CleanupError(ErrorCode.PERMISSION_DENIED, CleanupStage.COOKIES, message);
  }

  throw new CleanupError(ErrorCode.COOKIE_REMOVE_FAILED, CleanupStage.COOKIES, message);
};

const handleStorageError = (error: unknown): never => {
  if (error instanceof CleanupError) {
    throw error;
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  throw new CleanupError(ErrorCode.STORAGE_READ_FAILED, CleanupStage.STORAGE, message);
};

export const runCleanup = async (options: CleanupOptions): Promise<CleanupExecutionResult> => {
  const startTime = Date.now();
  const result = createInitialResult(options, startTime);

  let settingsData: { settings: Settings; whitelist: string[]; blacklist: string[] };
  try {
    settingsData = await getCleanupSettings();
  } catch (e) {
    throw handleStorageError(e);
  }

  const { settings, whitelist, blacklist } = settingsData;

  try {
    const clearType = options.clearType ?? settings.clearType;
    const clearOptions = getClearOptions(options, settings);

    if (
      options.domain &&
      !shouldCleanupDomain({ domain: options.domain, mode: settings.mode, whitelist, blacklist })
    ) {
      result.durationMs = Date.now() - startTime;
      result.success = true;
      return result;
    }

    const cookieResult = await createCookieResult(
      options,
      clearType,
      settings,
      whitelist,
      blacklist
    );

    result.cookiesRemoved = cookieResult.count;
    result.matchedDomains = Array.from(cookieResult.clearedDomains);

    const domainsToClean = options.domain ? new Set([options.domain]) : cookieResult.clearedDomains;

    if (domainsToClean.size > 0) {
      await handleBrowserDataClear(result, domainsToClean, clearOptions, options.domain);
    }

    result.success = true;
  } catch (e) {
    handleCookieClearError(options.domain, e);
  }

  result.durationMs = Date.now() - startTime;
  return result;
};

export const runCleanupWithFilter = async (
  filterFn: (domain: string) => boolean,
  options: Omit<CleanupOptions, "domain"> & Partial<Pick<CleanupOptions, "domain">>,
  targetDomains?: string[]
): Promise<CleanupExecutionResult> => {
  const startTime = Date.now();
  const result = createInitialResult(options, startTime);

  let settingsData: { settings: Settings; whitelist: string[]; blacklist: string[] };
  try {
    settingsData = await getCleanupSettings();
  } catch (e) {
    throw handleStorageError(e);
  }

  const { settings, whitelist, blacklist } = settingsData;

  try {
    const clearType = options.clearType ?? settings.clearType;
    const clearOptions = getClearOptions(options, settings);

    const shouldIncludeDomain = (domain: string) =>
      shouldCleanupDomain({ domain, mode: settings.mode, whitelist, blacklist });
    const cookieOptions: ClearCookiesOptions = {
      clearType,
      filterFn: (domain) => filterFn(domain) && shouldIncludeDomain(domain),
    };
    const cookieResult = await clearCookies(cookieOptions);

    result.cookiesRemoved = cookieResult.count;
    result.matchedDomains = Array.from(cookieResult.clearedDomains);

    const domainsToClean =
      targetDomains && targetDomains.length > 0
        ? new Set(targetDomains)
        : cookieResult.clearedDomains;

    if (domainsToClean.size > 0) {
      await handleBrowserDataClear(result, domainsToClean, clearOptions, options.domain);
    }

    result.success = true;
  } catch (e) {
    handleCookieClearError(options.domain, e);
  }

  result.durationMs = Date.now() - startTime;
  return result;
};
