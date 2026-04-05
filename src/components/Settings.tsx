import { useStorage, useTranslation } from "@/hooks";
import { SETTINGS_KEY, DEFAULT_SETTINGS, DEFAULT_CUSTOM_THEME } from "@/lib/store";
import type { Settings as SettingsType, CustomTheme, Locale } from "@/types";
import { CookieClearType, LogRetention, ThemeMode, ModeType, ScheduleInterval } from "@/types";
import { RadioGroup } from "@/components/RadioGroup";
import { CheckboxGroup } from "@/components/CheckboxGroup";
import { Select } from "@/components/Select";
import { Icon } from "@/components/Icon";

interface Props {
  onMessage: (text: string, isError?: boolean) => void;
}

export const Settings = ({ onMessage }: Props) => {
  const [settings, setSettings] = useStorage<SettingsType>(SETTINGS_KEY, DEFAULT_SETTINGS);
  const { t } = useTranslation();

  const showCustomTheme = settings.themeMode === ThemeMode.CUSTOM;

  const updateSetting = <K extends keyof SettingsType>(key: K, value: SettingsType[K]) => {
    const cleanSettings = Object.fromEntries(
      Object.entries(settings).filter(([, v]) => v !== undefined)
    ) as SettingsType;
    setSettings({ ...cleanSettings, [key]: value });
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

  return (
    <div className="settings-container">
      <section className="settings-group panel">
        <div className="settings-group-header">
          <h3 className="settings-group-title">
            <Icon name="trash" size={16} className="settings-group-icon" />
            {t("settings.group.cleanupStrategy")}
          </h3>
          <p className="settings-group-desc">{t("settings.group.cleanupStrategyDesc")}</p>
        </div>

        <div className="settings-subsection">
          <h4 className="settings-subsection-title">{t("settings.workMode")}</h4>
          <RadioGroup
            name="workMode"
            options={[
              { value: ModeType.WHITELIST, label: t("settings.whitelistMode") },
              { value: ModeType.BLACKLIST, label: t("settings.blacklistMode") },
            ]}
            value={settings.mode}
            onChange={(value) => updateSetting("mode", value)}
            variant="card"
          />
        </div>

        <div className="settings-subsection">
          <h4 className="settings-subsection-title">{t("settings.cookieClearType")}</h4>
          <RadioGroup
            name="cookieClearType"
            options={[
              { value: CookieClearType.SESSION, label: t("settings.clearSessionOnly") },
              { value: CookieClearType.PERSISTENT, label: t("settings.clearPersistentOnly") },
              { value: CookieClearType.ALL, label: t("settings.clearAll") },
            ]}
            value={settings.clearType}
            onChange={(value) => updateSetting("clearType", value)}
            variant="card"
          />
        </div>

        <div className="settings-subsection">
          <h4 className="settings-subsection-title">{t("settings.advancedCleanup")}</h4>
          <CheckboxGroup
            options={[
              {
                value: "clearCache",
                label: t("settings.clearCache"),
                description: t("settings.clearCacheDesc"),
                checked: settings.clearCache,
              },
              {
                value: "clearLocalStorage",
                label: t("settings.clearLocalStorage"),
                description: t("settings.clearLocalStorageDesc"),
                checked: settings.clearLocalStorage,
              },
              {
                value: "clearIndexedDB",
                label: t("settings.clearIndexedDB"),
                description: t("settings.clearIndexedDBDesc"),
                checked: settings.clearIndexedDB,
              },
            ]}
            onChange={(values) => {
              setSettings((prev) => ({
                ...prev,
                clearCache: values.includes("clearCache"),
                clearLocalStorage: values.includes("clearLocalStorage"),
                clearIndexedDB: values.includes("clearIndexedDB"),
              }));
            }}
          />
        </div>
      </section>

      <section className="settings-group panel">
        <div className="settings-group-header">
          <h3 className="settings-group-title">
            <Icon name="clock" size={16} className="settings-group-icon" />
            {t("settings.group.automation")}
          </h3>
          <p className="settings-group-desc">{t("settings.group.automationDesc")}</p>
        </div>

        <div className="settings-note">
          <Icon name="info" size={14} className="settings-note-icon" />
          <p className="settings-note-text">{t("settings.permissionsNote")}</p>
        </div>

        <div className="settings-subsection">
          <h4 className="settings-subsection-title">{t("settings.scheduledCleanup")}</h4>
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
            variant="card"
          />
        </div>

        <div className="settings-subsection">
          <h4 className="settings-subsection-title">{t("settings.autoCleanup")}</h4>
          <CheckboxGroup
            options={[
              {
                value: "enableAutoCleanup",
                label: t("settings.enableAutoCleanup"),
                checked: settings.enableAutoCleanup,
              },
              {
                value: "cleanupOnTabClose",
                label: t("settings.cleanupOnTabClose"),
                description: t("settings.cleanupOnTabCloseDesc"),
                checked: settings.cleanupOnTabClose,
                disabled: !settings.enableAutoCleanup,
              },
              {
                value: "cleanupOnBrowserClose",
                label: t("settings.cleanupOnBrowserClose"),
                description: t("settings.cleanupOnBrowserCloseDesc"),
                checked: settings.cleanupOnBrowserClose,
                disabled: !settings.enableAutoCleanup,
              },
              {
                value: "cleanupOnNavigate",
                label: t("settings.cleanupOnNavigate"),
                description: t("settings.cleanupOnNavigateDesc"),
                checked: settings.cleanupOnNavigate,
                disabled: !settings.enableAutoCleanup,
              },
              {
                value: "cleanupOnStartup",
                label: t("settings.cleanupOnStartup"),
                description: t("settings.cleanupOnStartupDesc"),
                checked: settings.cleanupOnStartup,
                disabled: !settings.enableAutoCleanup,
              },
              {
                value: "cleanupOnTabDiscard",
                label: t("settings.cleanupOnTabDiscard"),
                description: t("settings.cleanupOnTabDiscardDesc"),
                checked: settings.cleanupOnTabDiscard,
                disabled: !settings.enableAutoCleanup,
              },
              {
                value: "cleanupExpiredCookies",
                label: t("settings.cleanupExpiredCookies"),
                description: t("settings.cleanupExpiredCookiesDesc"),
                checked: settings.cleanupExpiredCookies,
                disabled: !settings.enableAutoCleanup,
              },
            ]}
            onChange={(values) => {
              setSettings((prev) => ({
                ...prev,
                enableAutoCleanup: values.includes("enableAutoCleanup"),
                cleanupOnTabClose: values.includes("cleanupOnTabClose"),
                cleanupOnBrowserClose: values.includes("cleanupOnBrowserClose"),
                cleanupOnNavigate: values.includes("cleanupOnNavigate"),
                cleanupOnStartup: values.includes("cleanupOnStartup"),
                cleanupOnTabDiscard: values.includes("cleanupOnTabDiscard"),
                cleanupExpiredCookies: values.includes("cleanupExpiredCookies"),
              }));
            }}
          />
        </div>
      </section>

      <section className="settings-group panel">
        <div className="settings-group-header">
          <h3 className="settings-group-title">
            <Icon name="alertTriangle" size={16} className="settings-group-icon" />
            {t("settings.group.privacyRisk")}
          </h3>
          <p className="settings-group-desc">{t("settings.group.privacyRiskDesc")}</p>
        </div>

        <CheckboxGroup
          options={[
            {
              value: "showCookieRisk",
              label: t("settings.showCookieRisk"),
              description: t("settings.showCookieRiskDesc"),
              checked: settings.showCookieRisk,
            },
          ]}
          onChange={(values) => {
            updateSetting("showCookieRisk", values.includes("showCookieRisk"));
          }}
        />
      </section>

      <section className="settings-group panel">
        <div className="settings-group-header">
          <h3 className="settings-group-title">
            <Icon name="palette" size={16} className="settings-group-icon" />
            {t("settings.group.appearance")}
          </h3>
          <p className="settings-group-desc">{t("settings.group.appearanceDesc")}</p>
        </div>

        <div className="settings-subsection">
          <h4 className="settings-subsection-title">{t("settings.themeMode")}</h4>
          <RadioGroup
            name="themeMode"
            options={[
              {
                value: ThemeMode.AUTO,
                label: t("settings.followBrowser"),
                description: t("settings.followBrowserDesc"),
              },
              {
                value: ThemeMode.LIGHT,
                label: t("settings.light"),
                description: t("settings.lightDesc"),
              },
              {
                value: ThemeMode.DARK,
                label: t("settings.dark"),
                description: t("settings.darkDesc"),
              },
              {
                value: ThemeMode.CUSTOM,
                label: t("settings.custom"),
                description: t("settings.customDesc"),
              },
            ]}
            value={settings.themeMode}
            onChange={(value) => updateSetting("themeMode", value)}
            variant="card"
          />
        </div>

        {showCustomTheme && (
          <div className="settings-subsection custom-theme-settings">
            <h4 className="settings-subsection-title">{t("settings.customTheme")}</h4>
            <div className="color-inputs">
              <div className="color-input">
                <label htmlFor="custom-theme-primary">{t("settings.primaryColor")}</label>
                <input
                  id="custom-theme-primary"
                  type="color"
                  value={settings.customTheme?.primary ?? DEFAULT_CUSTOM_THEME.primary}
                  onChange={(e) => updateCustomTheme("primary", e.target.value)}
                />
              </div>
              <div className="color-input">
                <label htmlFor="custom-theme-success">{t("settings.successColor")}</label>
                <input
                  id="custom-theme-success"
                  type="color"
                  value={settings.customTheme?.success ?? DEFAULT_CUSTOM_THEME.success}
                  onChange={(e) => updateCustomTheme("success", e.target.value)}
                />
              </div>
              <div className="color-input">
                <label htmlFor="custom-theme-warning">{t("settings.warningColor")}</label>
                <input
                  id="custom-theme-warning"
                  type="color"
                  value={settings.customTheme?.warning ?? DEFAULT_CUSTOM_THEME.warning}
                  onChange={(e) => updateCustomTheme("warning", e.target.value)}
                />
              </div>
              <div className="color-input">
                <label htmlFor="custom-theme-danger">{t("settings.dangerColor")}</label>
                <input
                  id="custom-theme-danger"
                  type="color"
                  value={settings.customTheme?.danger ?? DEFAULT_CUSTOM_THEME.danger}
                  onChange={(e) => updateCustomTheme("danger", e.target.value)}
                />
              </div>
              <div className="color-input">
                <label htmlFor="custom-theme-bg-primary">{t("settings.bgPrimaryColor")}</label>
                <input
                  id="custom-theme-bg-primary"
                  type="color"
                  value={settings.customTheme?.bgPrimary ?? DEFAULT_CUSTOM_THEME.bgPrimary}
                  onChange={(e) => updateCustomTheme("bgPrimary", e.target.value)}
                />
              </div>
              <div className="color-input">
                <label htmlFor="custom-theme-bg-secondary">{t("settings.bgSecondaryColor")}</label>
                <input
                  id="custom-theme-bg-secondary"
                  type="color"
                  value={settings.customTheme?.bgSecondary ?? DEFAULT_CUSTOM_THEME.bgSecondary}
                  onChange={(e) => updateCustomTheme("bgSecondary", e.target.value)}
                />
              </div>
              <div className="color-input">
                <label htmlFor="custom-theme-text-primary">{t("settings.textPrimaryColor")}</label>
                <input
                  id="custom-theme-text-primary"
                  type="color"
                  value={settings.customTheme?.textPrimary ?? DEFAULT_CUSTOM_THEME.textPrimary}
                  onChange={(e) => updateCustomTheme("textPrimary", e.target.value)}
                />
              </div>
              <div className="color-input">
                <label htmlFor="custom-theme-text-secondary">
                  {t("settings.textSecondaryColor")}
                </label>
                <input
                  id="custom-theme-text-secondary"
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
      </section>

      <section className="settings-group panel">
        <div className="settings-group-header">
          <h3 className="settings-group-title">
            <Icon name="info" size={16} className="settings-group-icon" />
            {t("settings.group.languageLogs")}
          </h3>
          <p className="settings-group-desc">{t("settings.group.languageLogsDesc")}</p>
        </div>

        <div className="settings-subsection">
          <h4 className="settings-subsection-title">{t("settings.language")}</h4>
          <RadioGroup
            name="locale"
            options={[
              { value: "zh-CN", label: "简体中文" },
              { value: "en-US", label: "English" },
            ]}
            value={settings.locale}
            onChange={(value) => {
              updateSetting("locale", value as Locale);
            }}
            variant="card"
          />
        </div>

        <div className="settings-subsection">
          <h4 className="settings-subsection-title">{t("settings.logRetention")}</h4>
          <Select
            name="logRetention"
            value={settings.logRetention}
            onChange={(value) => updateSetting("logRetention", value)}
            options={[
              { value: LogRetention.ONE_HOUR, label: t("settings.oneHour") },
              { value: LogRetention.SIX_HOURS, label: t("settings.sixHours") },
              { value: LogRetention.TWELVE_HOURS, label: t("settings.twelveHours") },
              { value: LogRetention.ONE_DAY, label: t("settings.oneDay") },
              { value: LogRetention.THREE_DAYS, label: t("settings.threeDays") },
              { value: LogRetention.SEVEN_DAYS, label: t("settings.sevenDays") },
              { value: LogRetention.TEN_DAYS, label: t("settings.tenDays") },
              { value: LogRetention.THIRTY_DAYS, label: t("settings.thirtyDays") },
              { value: LogRetention.FOREVER, label: t("settings.forever") },
            ]}
          />
        </div>
      </section>
    </div>
  );
};
