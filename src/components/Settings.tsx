import { useStorage } from "@/hooks/useStorage";
import { SETTINGS_KEY, DEFAULT_SETTINGS, DEFAULT_CUSTOM_THEME } from "@/lib/store";
import type { Settings as SettingsType, CustomTheme, Locale } from "@/types";
import { CookieClearType, LogRetention, ThemeMode, ModeType, ScheduleInterval } from "@/types";
import { RadioGroup } from "@/components/RadioGroup";
import { CheckboxGroup } from "@/components/CheckboxGroup";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  onMessage: (msg: string) => void;
}

export const Settings = ({ onMessage }: Props) => {
  const [settings, setSettings] = useStorage<SettingsType>(SETTINGS_KEY, DEFAULT_SETTINGS);
  const { t, setLocale } = useTranslation();

  const showCustomTheme = settings.themeMode === ThemeMode.CUSTOM;

  const updateSetting = <K extends keyof SettingsType>(key: K, value: SettingsType[K]) => {
    setSettings({ ...settings, [key]: value });
  };

  const updateCustomTheme = (key: keyof CustomTheme, value: string) => {
    setSettings({
      ...settings,
      customTheme: { ...(settings.customTheme || DEFAULT_CUSTOM_THEME), [key]: value },
    });
  };

  const resetCustomTheme = () => {
    setSettings({
      ...settings,
      customTheme: { ...DEFAULT_CUSTOM_THEME },
    });
    onMessage(t("settings.resetTheme"));
  };

  const handleLocaleChange = (locale: Locale) => {
    setLocale(locale);
  };

  return (
    <div className="settings-container">
      <div className="settings-section">
        <h3>{t("settings.workMode")}</h3>
        <p className="settings-description">{t("settings.workModeDesc")}</p>
        <RadioGroup
          name="workMode"
          options={[
            { value: ModeType.WHITELIST, label: t("settings.whitelistMode") },
            { value: ModeType.BLACKLIST, label: t("settings.blacklistMode") },
          ]}
          value={settings.mode}
          onChange={(value) => updateSetting("mode", value)}
        />
      </div>

      <div className="settings-section">
        <h3>{t("settings.cookieClearType")}</h3>
        <p className="settings-description">{t("settings.cookieClearTypeDesc")}</p>
        <RadioGroup
          name="cookieClearType"
          options={[
            { value: CookieClearType.SESSION, label: t("settings.clearSessionOnly") },
            { value: CookieClearType.PERSISTENT, label: t("settings.clearPersistentOnly") },
            { value: CookieClearType.ALL, label: t("settings.clearAll") },
          ]}
          value={settings.clearType}
          onChange={(value) => updateSetting("clearType", value)}
        />
      </div>

      <div className="settings-section">
        <h3>{t("settings.scheduledCleanup")}</h3>
        <p className="settings-description">{t("settings.scheduledCleanupDesc")}</p>
        <RadioGroup
          name="scheduleInterval"
          options={[
            { value: ScheduleInterval.DISABLED, label: t("settings.disabled") },
            { value: ScheduleInterval.HOURLY, label: t("settings.hourly") },
            { value: ScheduleInterval.DAILY, label: t("settings.daily") },
            { value: ScheduleInterval.WEEKLY, label: t("settings.weekly") },
          ]}
          value={settings.scheduleInterval}
          onChange={(value) => updateSetting("scheduleInterval", value)}
        />
      </div>

      <div className="settings-section">
        <h3>{t("settings.advancedCleanup")}</h3>
        <p className="settings-description">{t("settings.advancedCleanupDesc")}</p>
        <CheckboxGroup
          options={[
            { value: "clearCache", label: t("settings.clearCache"), checked: settings.clearCache },
            {
              value: "clearLocalStorage",
              label: t("settings.clearLocalStorage"),
              checked: settings.clearLocalStorage,
            },
            {
              value: "clearIndexedDB",
              label: t("settings.clearIndexedDB"),
              checked: settings.clearIndexedDB,
            },
          ]}
          onChange={(values) => {
            updateSetting("clearCache", values.includes("clearCache"));
            updateSetting("clearLocalStorage", values.includes("clearLocalStorage"));
            updateSetting("clearIndexedDB", values.includes("clearIndexedDB"));
          }}
        />
      </div>

      <div className="settings-section">
        <h3>{t("settings.autoCleanup")}</h3>
        <p className="settings-description">{t("settings.autoCleanupDesc")}</p>
        <CheckboxGroup
          options={[
            {
              value: "cleanupOnStartup",
              label: t("settings.cleanupOnStartup"),
              checked: settings.cleanupOnStartup,
            },
            {
              value: "cleanupExpiredCookies",
              label: t("settings.cleanupExpiredCookies"),
              checked: settings.cleanupExpiredCookies,
            },
          ]}
          onChange={(values) => {
            updateSetting("cleanupOnStartup", values.includes("cleanupOnStartup"));
            updateSetting("cleanupExpiredCookies", values.includes("cleanupExpiredCookies"));
          }}
        />
      </div>

      <div className="settings-section">
        <h3>{t("settings.logRetention")}</h3>
        <p className="settings-description">{t("settings.logRetentionDesc")}</p>
        <RadioGroup
          name="logRetention"
          options={[
            { value: LogRetention.ONE_HOUR, label: t("settings.oneHour") },
            { value: LogRetention.SIX_HOURS, label: t("settings.sixHours") },
            { value: LogRetention.TWELVE_HOURS, label: t("settings.twelveHours") },
            { value: LogRetention.ONE_DAY, label: t("settings.oneDay") },
            { value: LogRetention.THREE_DAYS, label: t("settings.threeDays") },
            { value: LogRetention.SEVEN_DAYS, label: t("settings.sevenDays") },
            { value: LogRetention.TEN_DAYS, label: t("settings.tenDays") },
            { value: LogRetention.THIRTY_DAYS, label: t("settings.thirtyDays") },
          ]}
          value={settings.logRetention}
          onChange={(value) => updateSetting("logRetention", value)}
        />
      </div>

      <div className="settings-section">
        <h3>{t("settings.privacyProtection")}</h3>
        <p className="settings-description">{t("settings.privacyProtectionDesc")}</p>
        <CheckboxGroup
          options={[
            {
              value: "showCookieRisk",
              label: t("settings.showCookieRisk"),
              checked: settings.showCookieRisk,
            },
          ]}
          onChange={(values) => {
            updateSetting("showCookieRisk", values.includes("showCookieRisk"));
          }}
        />
      </div>

      <div className="settings-section">
        <h3>{t("settings.themeMode")}</h3>
        <p className="settings-description">{t("settings.themeModeDesc")}</p>
        <RadioGroup
          name="themeMode"
          options={[
            { value: ThemeMode.AUTO, label: t("settings.followBrowser") },
            { value: ThemeMode.LIGHT, label: t("settings.light") },
            { value: ThemeMode.DARK, label: t("settings.dark") },
            { value: ThemeMode.CUSTOM, label: t("settings.custom") },
          ]}
          value={settings.themeMode}
          onChange={(value) => updateSetting("themeMode", value)}
        />
      </div>

      {showCustomTheme && (
        <div className="settings-section custom-theme-settings">
          <h3>{t("settings.customTheme")}</h3>
          <p className="settings-description">{t("settings.customThemeDesc")}</p>
          <div className="color-inputs">
            <div className="color-input">
              <label>{t("settings.primaryColor")}</label>
              <input
                type="color"
                value={settings.customTheme?.primary ?? DEFAULT_CUSTOM_THEME.primary}
                onChange={(e) => updateCustomTheme("primary", e.target.value)}
              />
            </div>
            <div className="color-input">
              <label>{t("settings.successColor")}</label>
              <input
                type="color"
                value={settings.customTheme?.success ?? DEFAULT_CUSTOM_THEME.success}
                onChange={(e) => updateCustomTheme("success", e.target.value)}
              />
            </div>
            <div className="color-input">
              <label>{t("settings.warningColor")}</label>
              <input
                type="color"
                value={settings.customTheme?.warning ?? DEFAULT_CUSTOM_THEME.warning}
                onChange={(e) => updateCustomTheme("warning", e.target.value)}
              />
            </div>
            <div className="color-input">
              <label>{t("settings.dangerColor")}</label>
              <input
                type="color"
                value={settings.customTheme?.danger ?? DEFAULT_CUSTOM_THEME.danger}
                onChange={(e) => updateCustomTheme("danger", e.target.value)}
              />
            </div>
            <div className="color-input">
              <label>{t("settings.bgPrimaryColor")}</label>
              <input
                type="color"
                value={settings.customTheme?.bgPrimary ?? DEFAULT_CUSTOM_THEME.bgPrimary}
                onChange={(e) => updateCustomTheme("bgPrimary", e.target.value)}
              />
            </div>
            <div className="color-input">
              <label>{t("settings.bgSecondaryColor")}</label>
              <input
                type="color"
                value={settings.customTheme?.bgSecondary ?? DEFAULT_CUSTOM_THEME.bgSecondary}
                onChange={(e) => updateCustomTheme("bgSecondary", e.target.value)}
              />
            </div>
            <div className="color-input">
              <label>{t("settings.textPrimaryColor")}</label>
              <input
                type="color"
                value={settings.customTheme?.textPrimary ?? DEFAULT_CUSTOM_THEME.textPrimary}
                onChange={(e) => updateCustomTheme("textPrimary", e.target.value)}
              />
            </div>
            <div className="color-input">
              <label>{t("settings.textSecondaryColor")}</label>
              <input
                type="color"
                value={settings.customTheme?.textSecondary ?? DEFAULT_CUSTOM_THEME.textSecondary}
                onChange={(e) => updateCustomTheme("textSecondary", e.target.value)}
              />
            </div>
          </div>
          <button className="reset-theme-btn" onClick={resetCustomTheme}>
            {t("settings.resetTheme")}
          </button>
        </div>
      )}

      <div className="settings-section">
        <h3>{t("settings.language")}</h3>
        <p className="settings-description">{t("settings.languageDesc")}</p>
        <RadioGroup
          name="locale"
          options={[
            { value: "zh-CN", label: "简体中文" },
            { value: "en", label: "English" },
          ]}
          value={settings.locale}
          onChange={(value) => {
            updateSetting("locale", value as Locale);
            handleLocaleChange(value as Locale);
          }}
        />
      </div>

      <div className="settings-section">
        <h3>{t("settings.showCookieRisk")}</h3>
        <p className="settings-description">{t("settings.showCookieRiskDesc")}</p>
        <CheckboxGroup
          options={[
            {
              value: "showCookieRisk",
              label: t("settings.showCookieRisk"),
              checked: settings.showCookieRisk,
            },
          ]}
          onChange={(values) => {
            updateSetting("showCookieRisk", values.includes("showCookieRisk"));
          }}
        />
      </div>
    </div>
  );
};
