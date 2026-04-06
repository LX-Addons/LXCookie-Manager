import type { Settings, CookieClearType, CleanupOverrides } from "@/types";

export function getCleanupOptionsFromSettings(settings: Settings): CleanupOverrides {
  return {
    clearType: settings.clearType as CookieClearType,
    clearCache: settings.clearCache,
    clearLocalStorage: settings.clearLocalStorage,
    clearIndexedDB: settings.clearIndexedDB,
  };
}
