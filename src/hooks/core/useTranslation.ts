import { i18n } from "#i18n";
import { useCallback } from "react";

export type TranslationFunction = (key: string, params?: Record<string, string | number>) => string;

function applyParams(str: string, params: Record<string, string | number>): string {
  return str.replace(/\{(\w+)\}/g, (_, key: string) => {
    const val = params[key];
    return val !== undefined ? String(val) : `{${key}}`;
  });
}

export function useTranslation() {
  const t = useCallback<TranslationFunction>((key, params) => {
    const base = (i18n.t as (k: string) => string)(key) || key;
    if (!params) return base;
    return applyParams(base, params);
  }, []);

  return { t };
}
