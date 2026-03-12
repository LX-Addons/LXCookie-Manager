import zhCN from "./zh-CN.json";
import enUS from "./en-US.json";
import type { Locale as ProjectLocale } from "@/types";
import type { Translations } from "./types";

type Locale = ProjectLocale;

const translations: Record<Locale, Translations> = {
  "zh-CN": zhCN as unknown as Translations,
  "en-US": enUS as unknown as Translations,
};

let currentLocale: Locale = "zh-CN";

export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function detectBrowserLocale(): Locale {
  const browserLang =
    navigator.language || (navigator as Navigator & { userLanguage?: string }).userLanguage;
  if (browserLang?.startsWith("zh")) {
    return "zh-CN";
  }
  return "en-US";
}

export function t(path: string, params?: Record<string, string | number>): string {
  const keys = path.split(".");
  let value: unknown = translations[currentLocale];

  for (const key of keys) {
    if (value && typeof value === "object" && key in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[key];
    } else {
      console.warn(`Translation key not found: ${path}`);
      return path;
    }
  }

  if (typeof value !== "string") {
    console.warn(`Translation value is not a string: ${path}`);
    return path;
  }

  if (params) {
    return value.replaceAll(/\{(\w+)\}/g, (_, key) => {
      return params[key]?.toString() || `{${key}}`;
    });
  }

  return value;
}

export function getTranslations(): Translations {
  return translations[currentLocale];
}

export function getAllLocales(): Locale[] {
  return Object.keys(translations) as Locale[];
}
