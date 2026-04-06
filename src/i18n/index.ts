/**
 * 自定义运行时i18n系统（方案C：双系统架构）
 *
 * 职责分工：
 * - public/_locales/: Chrome原生locale文件，仅用于manifest.json的国际化
 * - src/i18n/: 自定义运行时i18n系统，用于popup/options页面的UI文本翻译
 *
 * 设计理由：
 * 1. WXT i18n模块主要用于构建时处理和manifest i18n
 * 2. 运行时UI需要更灵活的翻译功能（动态参数、fallback等）
 * 3. 双系统避免耦合，各自独立维护
 */

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

const DEFAULT_LOCALE: Locale = "zh-CN";

function getTranslationValue(locale: Locale, path: string): string | undefined {
  const keys = path.split(".");
  let value: unknown = translations[locale];

  for (const key of keys) {
    if (value && typeof value === "object" && key in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return typeof value === "string" ? value : undefined;
}

export function t(path: string, params?: Record<string, string | number>): string {
  let value = getTranslationValue(currentLocale, path);

  if (value === undefined && currentLocale !== DEFAULT_LOCALE) {
    if (import.meta.env.DEV) {
      console.warn(
        `Translation key not found in ${currentLocale}, falling back to ${DEFAULT_LOCALE}: ${path}`
      );
    }
    value = getTranslationValue(DEFAULT_LOCALE, path);
  }

  if (value === undefined) {
    if (import.meta.env.DEV) {
      console.warn(`Translation key not found in any locale: ${path}`);
    }
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
