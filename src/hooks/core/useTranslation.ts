import { useEffect, useCallback, useState } from "react";
import { storage } from "wxt/utils/storage";
import { SETTINGS_KEY, DEFAULT_SETTINGS } from "@/lib/store";
import type { Settings, Locale } from "@/types";
import { setLocale, detectBrowserLocale, t as translate } from "@/i18n";

export type TranslationFunction = (
  path: string,
  params?: Record<string, string | number>
) => string;

export function useTranslation() {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_SETTINGS.locale);

  useEffect(() => {
    let isMounted = true;

    storage.getItem<Settings>(SETTINGS_KEY).then((val) => {
      if (!isMounted) return;
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

    return () => {
      isMounted = false;
      unwatch();
    };
  }, []);

  const t = useCallback(
    (path: string, params?: Record<string, string | number>): string => {
      return translate(path, params);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale]
  );

  const setTranslationLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setLocale(newLocale);

    storage
      .getItem<Settings>(SETTINGS_KEY)
      .then((current) => {
        const newSettings = { ...(current || DEFAULT_SETTINGS), locale: newLocale };
        return storage.setItem(SETTINGS_KEY, newSettings);
      })
      .catch((error) => {
        console.error("Failed to persist locale:", error);
      });
  }, []);

  return {
    t,
    locale,
    setLocale: setTranslationLocale,
  };
}
