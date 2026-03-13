import { useEffect, useCallback, useState, useRef } from "react";
import { storage } from "wxt/utils/storage";
import { SETTINGS_KEY, DEFAULT_SETTINGS } from "@/lib/store";
import type { Settings, Locale } from "@/types";
import { setLocale, detectBrowserLocale, t as translate } from "@/i18n";

export function useTranslation() {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_SETTINGS.locale);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    storage.getItem<Settings>(SETTINGS_KEY).then((val) => {
      const localeToUse = val?.locale || detectBrowserLocale();
      setLocaleState(localeToUse);
      setLocale(localeToUse);
    });

    const unwatch = storage.watch<Settings>(SETTINGS_KEY, (newValue) => {
      if (newValue?.locale) {
        setLocaleState(newValue.locale);
        setLocale(newValue.locale);
      }
    });

    return () => unwatch();
  }, []);

  const t = useCallback(
    (path: string, params?: Record<string, string | number>): string => {
      return translate(path, params);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale]
  );

  const setTranslationLocale = useCallback((locale: Locale) => {
    storage.getItem<Settings>(SETTINGS_KEY).then((current) => {
      const newSettings = { ...(current || DEFAULT_SETTINGS), locale };
      storage.setItem(SETTINGS_KEY, newSettings);
    });
  }, []);

  return {
    t,
    locale,
    setLocale: setTranslationLocale,
  };
}
