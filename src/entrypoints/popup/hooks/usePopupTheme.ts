import { useState, useMemo, useCallback, useEffect } from "react";
import type { Settings as SettingsType, CustomTheme } from "@/types";
import { ThemeMode } from "@/types";
import {
  getHoverColor,
  getActiveColor,
  getLineSoftColor,
  getLineStrongColor,
  getLighterColor,
  getMutedTextColor,
  getContrastColor,
} from "@/utils/theme";

const CUSTOM_THEME_VARS = [
  "--primary-400",
  "--primary-500",
  "--primary-600",
  "--primary-700",
  "--success-400",
  "--success-500",
  "--success-600",
  "--success-700",
  "--warning-400",
  "--warning-500",
  "--warning-600",
  "--warning-700",
  "--danger-400",
  "--danger-500",
  "--danger-600",
  "--danger-700",
  "--surface-0",
  "--surface-1",
  "--surface-2",
  "--text-1",
  "--text-2",
  "--text-3",
  "--text-muted",
  "--text-on-primary",
  "--text-on-success",
  "--text-on-warning",
  "--text-on-danger",
  "--line-soft",
  "--line-strong",
  "--primary-tint-05",
  "--primary-tint-08",
  "--primary-tint-10",
  "--primary-tint-12",
  "--primary-tint-15",
  "--success-tint-10",
  "--success-tint-15",
  "--warning-tint-10",
  "--warning-tint-15",
  "--danger-tint-05",
  "--danger-tint-08",
  "--danger-tint-10",
  "--danger-tint-12",
  "--danger-tint-15",
] as const;

interface UsePopupThemeProps {
  settings: SettingsType;
}

interface UsePopupThemeReturn {
  themeClasses: string;
}

export const usePopupTheme = ({ settings }: UsePopupThemeProps): UsePopupThemeReturn => {
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => {
    if (typeof globalThis !== "undefined") {
      return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });

  const isCustomThemeDark = useCallback((customTheme: CustomTheme | undefined) => {
    if (!customTheme) return false;
    let hex = customTheme.bgPrimary.replace("#", "");
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (hex.length !== 6 || !/^[0-9A-Fa-f]+$/.test(hex)) {
      return false;
    }
    const r = Number.parseInt(hex.substring(0, 2), 16);
    const g = Number.parseInt(hex.substring(2, 4), 16);
    const b = Number.parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }, []);

  const theme = useMemo(() => {
    const themeMode = settings.themeMode;
    if (themeMode === ThemeMode.AUTO) {
      return systemTheme === "dark" ? ThemeMode.DARK : ThemeMode.LIGHT;
    }
    if (themeMode === ThemeMode.CUSTOM && settings.customTheme) {
      return isCustomThemeDark(settings.customTheme) ? ThemeMode.DARK : ThemeMode.LIGHT;
    }
    return themeMode;
  }, [settings.themeMode, settings.customTheme, systemTheme, isCustomThemeDark]);

  useEffect(() => {
    const mediaQuery = globalThis.matchMedia("(prefers-color-scheme: dark)");

    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const applyCustomTheme = useCallback((customTheme: SettingsType["customTheme"]) => {
    if (!customTheme) return;
    const root = document.documentElement;
    const primaryHover = getHoverColor(customTheme.primary);
    const primaryActive = getActiveColor(customTheme.primary);
    const primaryLighter = getLighterColor(customTheme.primary);
    const successHover = getHoverColor(customTheme.success);
    const successActive = getActiveColor(customTheme.success);
    const successLighter = getLighterColor(customTheme.success);
    const warningHover = getHoverColor(customTheme.warning);
    const warningActive = getActiveColor(customTheme.warning);
    const warningLighter = getLighterColor(customTheme.warning);
    const dangerHover = getHoverColor(customTheme.danger);
    const dangerActive = getActiveColor(customTheme.danger);
    const dangerLighter = getLighterColor(customTheme.danger);
    const textMuted = getMutedTextColor(customTheme.textSecondary);

    const hexToRgba = (hex: string, alpha: number): string => {
      const rgb = hex.replace("#", "");
      const r = Number.parseInt(rgb.substring(0, 2), 16);
      const g = Number.parseInt(rgb.substring(2, 4), 16);
      const b = Number.parseInt(rgb.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const themeVars: Record<string, string | undefined> = {
      "--primary-400": primaryLighter,
      "--primary-500": customTheme.primary,
      "--primary-600": primaryHover,
      "--primary-700": primaryActive,
      "--success-400": successLighter,
      "--success-500": customTheme.success,
      "--success-600": successHover,
      "--success-700": successActive,
      "--warning-400": warningLighter,
      "--warning-500": customTheme.warning,
      "--warning-600": warningHover,
      "--warning-700": warningActive,
      "--danger-400": dangerLighter,
      "--danger-500": customTheme.danger,
      "--danger-600": dangerHover,
      "--danger-700": dangerActive,
      "--surface-0": customTheme.bgPrimary,
      "--surface-1": customTheme.bgSecondary,
      "--surface-2": customTheme.bgSecondary,
      "--text-1": customTheme.textPrimary,
      "--text-2": customTheme.textSecondary,
      "--text-3": customTheme.textSecondary,
      "--text-muted": textMuted,
      "--text-on-primary": getContrastColor(customTheme.primary),
      "--text-on-success": getContrastColor(customTheme.success),
      "--text-on-warning": getContrastColor(customTheme.warning),
      "--text-on-danger": getContrastColor(customTheme.danger),
      "--line-soft": getLineSoftColor(customTheme.textSecondary),
      "--line-strong": getLineStrongColor(customTheme.textSecondary),
      "--primary-tint-05": hexToRgba(customTheme.primary, 0.05),
      "--primary-tint-08": hexToRgba(customTheme.primary, 0.08),
      "--primary-tint-10": hexToRgba(customTheme.primary, 0.1),
      "--primary-tint-12": hexToRgba(customTheme.primary, 0.12),
      "--primary-tint-15": hexToRgba(customTheme.primary, 0.15),
      "--success-tint-10": hexToRgba(customTheme.success, 0.1),
      "--success-tint-15": hexToRgba(customTheme.success, 0.15),
      "--warning-tint-10": hexToRgba(customTheme.warning, 0.1),
      "--warning-tint-15": hexToRgba(customTheme.warning, 0.15),
      "--danger-tint-05": hexToRgba(customTheme.danger, 0.05),
      "--danger-tint-08": hexToRgba(customTheme.danger, 0.08),
      "--danger-tint-10": hexToRgba(customTheme.danger, 0.1),
      "--danger-tint-12": hexToRgba(customTheme.danger, 0.12),
      "--danger-tint-15": hexToRgba(customTheme.danger, 0.15),
    };
    Object.entries(themeVars).forEach(([prop, value]) => {
      if (value) root.style.setProperty(prop, value);
    });
  }, []);

  const clearCustomTheme = useCallback(() => {
    const root = document.documentElement;
    CUSTOM_THEME_VARS.forEach((prop) => root.style.removeProperty(prop));
  }, []);

  useEffect(() => {
    if (settings.themeMode === ThemeMode.CUSTOM) {
      applyCustomTheme(settings.customTheme);
    } else {
      clearCustomTheme();
    }
  }, [settings.themeMode, settings.customTheme, applyCustomTheme, clearCustomTheme]);

  const themeClasses = useMemo(() => {
    const classes = ["app-shell"];
    classes.push(`theme-${theme}`);
    return classes.join(" ");
  }, [theme]);

  return { themeClasses };
};
