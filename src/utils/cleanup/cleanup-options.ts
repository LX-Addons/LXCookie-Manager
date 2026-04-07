import type { Settings, CleanupOverrides } from "@/types";

export function getCleanupOptionsFromSettings(settings: Settings): CleanupOverrides {
  return {
    clearType: settings.clearType,
    clearCache: settings.clearCache,
    clearLocalStorage: settings.clearLocalStorage,
    clearIndexedDB: settings.clearIndexedDB,
  };
}
