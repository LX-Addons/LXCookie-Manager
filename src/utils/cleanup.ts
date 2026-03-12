import { storage, WHITELIST_KEY, BLACKLIST_KEY, SETTINGS_KEY, DEFAULT_SETTINGS } from "@/lib/store";
import type { Settings } from "@/types";
import { ModeType, CookieClearType } from "@/types";
import { isInList, isDomainMatch } from "@/utils";
import { clearBrowserData, clearCookies, type ClearBrowserDataOptions } from "@/utils";

export interface CleanupOptions {
  domain: string;
  clearType?: CookieClearType;
  clearCache?: boolean;
  clearLocalStorage?: boolean;
  clearIndexedDB?: boolean;
}

export interface CleanupResult {
  count: number;
  clearedDomains: string[];
}

const getCleanupSettings = async (
  options?: Partial<CleanupOptions>
): Promise<{
  settings: Settings;
  whitelist: string[];
  blacklist: string[];
  clearType: CookieClearType;
  clearOptions: ClearBrowserDataOptions;
}> => {
  let settings = await storage.getItem<Settings>(SETTINGS_KEY);
  if (!settings) {
    settings = DEFAULT_SETTINGS;
    await storage.setItem(SETTINGS_KEY, DEFAULT_SETTINGS);
  }

  const whitelist = (await storage.getItem<string[]>(WHITELIST_KEY)) || [];
  const blacklist = (await storage.getItem<string[]>(BLACKLIST_KEY)) || [];

  const clearType = options?.clearType ?? settings.clearType;
  const clearOptions: ClearBrowserDataOptions = {
    clearCache: options?.clearCache ?? settings.clearCache,
    clearLocalStorage: options?.clearLocalStorage ?? settings.clearLocalStorage,
    clearIndexedDB: options?.clearIndexedDB ?? settings.clearIndexedDB,
  };

  return { settings, whitelist, blacklist, clearType, clearOptions };
};

const shouldCleanupDomain = (
  domain: string,
  mode: ModeType,
  whitelist: string[],
  blacklist: string[]
): boolean => {
  if (mode === ModeType.WHITELIST) {
    return !isInList(domain, whitelist);
  } else if (mode === ModeType.BLACKLIST) {
    return isInList(domain, blacklist);
  }
  return false;
};

export const performCleanup = async (options: CleanupOptions): Promise<CleanupResult | null> => {
  const { settings, whitelist, blacklist, clearType, clearOptions } =
    await getCleanupSettings(options);

  if (!shouldCleanupDomain(options.domain, settings.mode, whitelist, blacklist)) {
    return null;
  }

  const result = await clearCookies({
    filterFn: (cookieDomain) => isDomainMatch(cookieDomain, options.domain),
    clearType,
  });

  await clearBrowserData(result.clearedDomains, clearOptions);

  return {
    count: result.count,
    clearedDomains: Array.from(result.clearedDomains),
  };
};

export const performCleanupWithFilter = async (
  filterFn: (domain: string) => boolean,
  options: Partial<CleanupOptions> = {}
): Promise<CleanupResult> => {
  const { settings, whitelist, blacklist, clearType, clearOptions } =
    await getCleanupSettings(options);

  const isInWhitelist = settings.mode === ModeType.WHITELIST;
  const domainList = isInWhitelist ? whitelist : blacklist;
  const shouldIncludeDomain = isInWhitelist
    ? (domain: string) => !isInList(domain, domainList)
    : (domain: string) => isInList(domain, domainList);

  const result = await clearCookies({
    filterFn: (domain) => filterFn(domain) && shouldIncludeDomain(domain),
    clearType,
  });

  await clearBrowserData(result.clearedDomains, clearOptions);

  return {
    count: result.count,
    clearedDomains: Array.from(result.clearedDomains),
  };
};

export const cleanupExpiredCookies = async (): Promise<number> => {
  const cookies = await chrome.cookies.getAll({});
  const now = Date.now();
  let count = 0;

  for (const cookie of cookies) {
    try {
      if (cookie.expirationDate && cookie.expirationDate * 1000 < now) {
        const cleanedDomain = cookie.domain.replace(/^\./, "");
        const url = `http${cookie.secure ? "s" : ""}://${cleanedDomain}${cookie.path}`;
        await chrome.cookies.remove({ url, name: cookie.name });
        count++;
      }
    } catch (e) {
      console.error(`Failed to clear expired cookie ${cookie.name}:`, e);
    }
  }

  return count;
};
