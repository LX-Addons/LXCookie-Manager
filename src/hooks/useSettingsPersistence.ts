import { useCallback } from "react";
import { useStorage } from "@/hooks/core/useStorage";
import { SETTINGS_KEY, DEFAULT_SETTINGS, DEFAULT_CUSTOM_THEME } from "@/lib/store";
import type { Settings as SettingsType, CustomTheme } from "@/types";

type CleanupOptionsUpdate = Partial<
  Pick<SettingsType, "clearCache" | "clearLocalStorage" | "clearIndexedDB">
>;
type AutoCleanupOptionsUpdate = Partial<
  Pick<
    SettingsType,
    | "enableAutoCleanup"
    | "cleanupOnTabClose"
    | "cleanupOnBrowserClose"
    | "cleanupOnNavigate"
    | "cleanupOnStartup"
    | "cleanupOnTabDiscard"
    | "cleanupExpiredCookies"
  >
>;

interface UseSettingsPersistenceReturn {
  settings: SettingsType;
  updateSetting: <K extends keyof SettingsType>(key: K, value: SettingsType[K]) => void;
  updateCustomTheme: (key: keyof CustomTheme, value: string) => void;
  resetCustomTheme: () => void;
  updateCleanupOptions: (options: CleanupOptionsUpdate) => void;
  updateAutoCleanupOptions: (options: AutoCleanupOptionsUpdate) => void;
}

export function useSettingsPersistence(): UseSettingsPersistenceReturn {
  const [settings, setSettings] = useStorage<SettingsType>(SETTINGS_KEY, DEFAULT_SETTINGS);

  const updateSetting = useCallback(
    <K extends keyof SettingsType>(key: K, value: SettingsType[K]) => {
      setSettings((prev) => {
        const cleanSettings = Object.fromEntries(
          Object.entries(prev).filter(([, v]) => v !== undefined)
        ) as SettingsType;
        return { ...cleanSettings, [key]: value };
      });
    },
    [setSettings]
  );

  const updateCustomTheme = useCallback(
    (key: keyof CustomTheme, value: string) => {
      setSettings((prev) => ({
        ...prev,
        customTheme: { ...(prev.customTheme || DEFAULT_CUSTOM_THEME), [key]: value },
      }));
    },
    [setSettings]
  );

  const resetCustomTheme = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      customTheme: { ...DEFAULT_CUSTOM_THEME },
    }));
  }, [setSettings]);

  const updateCleanupOptions = useCallback(
    (options: CleanupOptionsUpdate) => {
      setSettings((prev) => ({
        ...prev,
        ...options,
      }));
    },
    [setSettings]
  );

  const updateAutoCleanupOptions = useCallback(
    (options: AutoCleanupOptionsUpdate) => {
      setSettings((prev) => ({
        ...prev,
        ...options,
      }));
    },
    [setSettings]
  );

  return {
    settings,
    updateSetting,
    updateCustomTheme,
    resetCustomTheme,
    updateCleanupOptions,
    updateAutoCleanupOptions,
  };
}
