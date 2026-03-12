import { useEffect, useCallback, useState } from "react";
import { storage } from "wxt/utils/storage";
import { SETTINGS_KEY, DEFAULT_SETTINGS } from "@/lib/store";
import type { Settings, Locale } from "@/types";
import { setLocale, detectBrowserLocale, t as translate } from "@/i18n";

export function useTranslation() {
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    storage.getItem<Settings>(SETTINGS_KEY).then((val) => {
      if (val !== undefined && val !== null) setSettingsState(val);
    });
  }, []);

  const setSettings = useCallback((newSettings: Settings) => {
    setSettingsState(newSettings);
    storage.setItem(SETTINGS_KEY, newSettings);
  }, []);

  useEffect(() => {
    let localeToUse: Locale;
    if (settings.locale) {
      localeToUse = settings.locale;
    } else {
      localeToUse = detectBrowserLocale();
    }
    setLocale(localeToUse);
  }, [settings.locale]);

  const setTranslationLocale = useCallback(
    (locale: Locale) => {
      setSettings({ ...settings, locale });
    },
    [settings, setSettings]
  );

  const t = useCallback(
    (path: string, params?: Record<string, string | number>): string => {
      return translate(path, params);
    },
    // locale dependency is required to invalidate memoization when language changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.locale]
  );

  return {
    t,
    locale: settings.locale,
    setLocale: setTranslationLocale,
  };
}
