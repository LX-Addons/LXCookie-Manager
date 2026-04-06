import { useEffect } from "react";
import { useStorage, useTranslation, useSiteStatus } from "@/hooks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Icon } from "@/components/Icon";
import { WHITELIST_KEY, BLACKLIST_KEY, SETTINGS_KEY, DEFAULT_SETTINGS } from "@/lib/store";
import type { DomainList, Settings as SettingsType } from "@/types";
import { ModeType } from "@/types";
import { usePopupData } from "./hooks/usePopupData";
import { usePopupMessage } from "./hooks/usePopupMessage";
import { usePopupTheme } from "./hooks/usePopupTheme";
import { usePopupTabs } from "./hooks/usePopupTabs";
import { usePopupActions } from "./hooks/usePopupActions";
import { ConfirmDialogProvider } from "@/contexts/ConfirmDialogProvider";
import { useConfirmDialogContext } from "@/contexts/ConfirmDialogContext";
import { ManageSection } from "./sections/ManageSection";
import { RulesSection } from "./sections/RulesSection";
import { SettingsSection } from "./sections/SettingsSection";
import { LogSection } from "./sections/LogSection";
import "./style.css";

const EMPTY_DOMAIN_LIST: DomainList = [];

function IndexPopup() {
  const showConfirm = useConfirmDialogContext();

  const [whitelist, setWhitelist] = useStorage<DomainList>(WHITELIST_KEY, EMPTY_DOMAIN_LIST);
  const [blacklist, setBlacklist] = useStorage<DomainList>(BLACKLIST_KEY, EMPTY_DOMAIN_LIST);
  const [settings] = useStorage<SettingsType>(SETTINGS_KEY, DEFAULT_SETTINGS);
  const { t } = useTranslation();

  const { message, showMessage } = usePopupMessage();

  const { loadingState, stats, currentCookies, currentDomain, init, updateStats } = usePopupData({
    onErrorMessage: showMessage,
  });

  const { themeClasses } = usePopupTheme({ settings });

  const { activeTab, tabs, tabRefs, setActiveTab, handleTabKeyDown } = usePopupTabs({ settings });

  const {
    status: siteStatus,
    statusText: siteStatusLabel,
    statusIcon: siteStatusIcon,
  } = useSiteStatus({
    currentDomain,
    mode: settings.mode,
    whitelist,
    blacklist,
    t,
  });

  const actions = usePopupActions({
    currentDomain,
    settings,
    whitelist,
    blacklist,
    setWhitelist,
    setBlacklist,
    showMessage,
    updateStats,
    showConfirm,
  });

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    document.documentElement.lang = browser.i18n.getUILanguage();
  }, []);

  return (
    <div className={themeClasses}>
      <header className="app-header">
        <div className="app-header-top">
          <div className="app-brand">
            <h1>{t("app.title")}</h1>
          </div>
          <div className="mode-badge">
            {settings.mode === ModeType.WHITELIST
              ? t("settings.whitelistModeShort")
              : t("settings.blacklistModeShort")}
          </div>
        </div>
        {currentDomain && (
          <div className="app-header-info">
            <span className="header-domain" title={currentDomain}>
              {currentDomain}
            </span>
            <span className={`header-status ${siteStatus}`}>
              <Icon name={siteStatusIcon} size={12} />
              {siteStatusLabel}
            </span>
          </div>
        )}
      </header>

      <div className="tabs" role="tablist" tabIndex={0} onKeyDown={handleTabKeyDown}>
        {tabs.map((tab) => {
          const tabClasses = "tab-btn " + (activeTab === tab.id ? "active" : "");
          return (
            <button
              key={tab.id}
              id={tab.id + "-tab"}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              data-testid={"tab-" + tab.id}
              className={tabClasses}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={tab.id + "-panel"}
              tabIndex={activeTab === tab.id ? 0 : -1}
            >
              <Icon name={tab.iconName} size={14} className="tab-icon" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "manage" && (
        <ManageSection
          loadingState={loadingState}
          stats={stats}
          currentCookies={currentCookies}
          currentDomain={currentDomain}
          settings={settings}
          whitelist={whitelist}
          blacklist={blacklist}
          updateStats={updateStats}
          showMessage={showMessage}
          quickClearCurrent={actions.quickClearCurrent}
          quickAddToRule={actions.quickAddToRule}
          quickClearAll={actions.quickClearAll}
          handleAddToWhitelist={actions.handleAddToWhitelist}
          handleAddToBlacklist={actions.handleAddToBlacklist}
        />
      )}

      {activeTab === "rules" && (
        <RulesSection
          settings={settings}
          currentDomain={currentDomain}
          onMessage={showMessage}
          handleClearBlacklist={actions.handleClearBlacklist}
        />
      )}

      {activeTab === "settings" && <SettingsSection onMessage={showMessage} />}

      {activeTab === "log" && <LogSection onMessage={showMessage} />}

      <div
        className={
          "toast-container " +
          (message.visible ? "visible" : "") +
          " " +
          (message.isError ? "error" : "")
        }
        role={message.isError ? "alert" : "status"}
        aria-live={message.isError ? "assertive" : "polite"}
        data-testid="toast-message"
      >
        {message.text}
      </div>
    </div>
  );
}

export default function IndexPopupWrapper() {
  return (
    <ErrorBoundary>
      <ConfirmDialogProvider>
        <IndexPopup />
      </ConfirmDialogProvider>
    </ErrorBoundary>
  );
}
