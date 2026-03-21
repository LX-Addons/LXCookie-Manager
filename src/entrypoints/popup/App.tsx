import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useStorage } from "@/hooks/useStorage";
import { useClearLog } from "@/hooks/useClearLog";
import { DomainManager } from "@/components/DomainManager";
import { Settings } from "@/components/Settings";
import { ClearLog } from "@/components/ClearLog";
import { CookieList } from "@/components/CookieList";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useTranslation } from "@/hooks/useTranslation";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { WHITELIST_KEY, BLACKLIST_KEY, SETTINGS_KEY, DEFAULT_SETTINGS } from "@/lib/store";
import type { DomainList, CookieStats, Settings as SettingsType, Cookie } from "@/types";
import { CookieClearType, ThemeMode, ModeType } from "@/types";
import {
  isDomainMatch,
  isInList,
  isTrackingCookie,
  isThirdPartyCookie,
  buildDomainString,
  getHoverColor,
  getActiveColor,
} from "@/utils";
import { performCleanupWithFilter } from "@/utils/cleanup";
import { MESSAGE_DURATION, DEBOUNCE_DELAY_MS } from "@/lib/constants";
import "./style.css";

function IndexPopup() {
  const [currentDomain, setCurrentDomain] = useState("");
  const [activeTab, setActiveTab] = useState("manage");
  const [message, setMessage] = useState({ text: "", isError: false, visible: false });
  const [stats, setStats] = useState<CookieStats>({
    total: 0,
    current: 0,
    session: 0,
    persistent: 0,
    thirdParty: 0,
    tracking: 0,
  });
  const [currentCookies, setCurrentCookies] = useState<Cookie[]>([]);
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => {
    if (typeof globalThis !== "undefined") {
      return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const { confirmState, showConfirm, closeConfirm, handleConfirm } = useConfirmDialog();

  const [whitelist, setWhitelist] = useStorage<DomainList>(WHITELIST_KEY, []);
  const [blacklist, setBlacklist] = useStorage<DomainList>(BLACKLIST_KEY, []);
  const [settings] = useStorage<SettingsType>(SETTINGS_KEY, DEFAULT_SETTINGS);
  const { addLog } = useClearLog();
  const { t } = useTranslation();

  const theme = useMemo(() => {
    const themeMode = settings.themeMode;
    if (themeMode === ThemeMode.AUTO) {
      return systemTheme === "dark" ? ThemeMode.DARK : ThemeMode.LIGHT;
    }
    return themeMode;
  }, [settings.themeMode, systemTheme]);

  const isCurrentInWhitelist = useMemo(
    () => currentDomain && isInList(currentDomain, whitelist),
    [currentDomain, whitelist]
  );

  const isCurrentInBlacklist = useMemo(
    () => currentDomain && isInList(currentDomain, blacklist),
    [currentDomain, blacklist]
  );

  const siteStatus = useMemo(() => {
    if (!currentDomain) return "unknown";
    if (settings.mode === ModeType.WHITELIST) {
      return isCurrentInWhitelist ? "protected" : "normal";
    }
    return isCurrentInBlacklist ? "priority-cleanup" : "normal";
  }, [currentDomain, settings.mode, isCurrentInWhitelist, isCurrentInBlacklist]);

  const riskLevel = useMemo(() => {
    if (stats.tracking > 0) return "high";
    if (stats.thirdParty > 0) return "medium";
    return "low";
  }, [stats.tracking, stats.thirdParty]);

  const tabs = useMemo(
    () => [
      { id: "manage", label: t("tabs.manage") },
      {
        id: "rules",
        label: settings.mode === ModeType.WHITELIST ? t("tabs.whitelist") : t("tabs.blacklist"),
      },
      { id: "settings", label: t("tabs.settings") },
      { id: "log", label: t("tabs.log") },
    ],
    [settings.mode, t]
  );

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
      let newTabId: string | null = null;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % tabs.length;
        newTabId = tabs[nextIndex].id;
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        newTabId = tabs[prevIndex].id;
      } else if (e.key === "Home") {
        e.preventDefault();
        newTabId = tabs[0].id;
      } else if (e.key === "End") {
        e.preventDefault();
        const lastTab = tabs.at(-1);
        if (lastTab) {
          newTabId = lastTab.id;
        }
      }

      if (newTabId && newTabId !== activeTab) {
        setActiveTab(newTabId);
        tabRefs.current[newTabId]?.focus();
      }
    },
    [activeTab, tabs]
  );

  const showMessage = useCallback((text: string, isError = false) => {
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current);
    }
    setMessage({ text, isError, visible: true });
    messageTimerRef.current = setTimeout(
      () => setMessage((prev) => ({ ...prev, visible: false })),
      MESSAGE_DURATION
    );
  }, []);

  const updateStats = useCallback(async () => {
    try {
      const allCookies = await chrome.cookies.getAll({});
      const currentCookiesList = allCookies.filter((c) =>
        currentDomain ? isDomainMatch(c.domain, currentDomain) : false
      );
      const sessionCookies = currentCookiesList.filter((c) => !c.expirationDate);
      const persistentCookies = currentCookiesList.filter((c) => c.expirationDate);

      const thirdPartyCookies = currentCookiesList.filter((c) =>
        isThirdPartyCookie(c.domain, currentDomain)
      );
      const trackingCookies = currentCookiesList.filter((c) => isTrackingCookie(c));

      setStats({
        total: allCookies.length,
        current: currentCookiesList.length,
        session: sessionCookies.length,
        persistent: persistentCookies.length,
        thirdParty: thirdPartyCookies.length,
        tracking: trackingCookies.length,
      });
      setCurrentCookies(
        currentCookiesList.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          secure: c.secure,
          httpOnly: c.httpOnly,
          sameSite: c.sameSite,
          expirationDate: c.expirationDate,
          storeId: c.storeId,
        }))
      );
    } catch (e) {
      console.error("Failed to update stats:", { error: e, currentDomain });
      showMessage(t("popup.updateStatsFailed"), true);
    }
  }, [currentDomain, showMessage, t]);

  const clearCookies = useCallback(
    async (filterFn: (domain: string) => boolean, successMsg: string, logType: CookieClearType) => {
      try {
        const result = await performCleanupWithFilter(filterFn, {
          clearType: logType,
          clearCache: settings.clearCache,
          clearLocalStorage: settings.clearLocalStorage,
          clearIndexedDB: settings.clearIndexedDB,
        });

        if (result.count > 0) {
          const domainStr = buildDomainString(
            new Set(result.clearedDomains),
            successMsg,
            currentDomain,
            t
          );
          addLog(domainStr, logType, result.count, settings.logRetention);
        }

        showMessage(t("popup.clearedSuccess", { successMsg, count: result.count }));
        await updateStats();
      } catch (e) {
        console.error("Failed to clear cookies:", {
          error: e,
          domain: currentDomain,
          trigger: "clearCookies",
          mode: settings.mode,
          clearType: logType,
        });
        showMessage(t("popup.clearCookiesFailed"), true);
      }
    },
    [
      settings.clearCache,
      settings.clearLocalStorage,
      settings.clearIndexedDB,
      settings.logRetention,
      settings.mode,
      currentDomain,
      addLog,
      showMessage,
      updateStats,
      t,
    ]
  );

  const quickAddToRule = useCallback(() => {
    if (settings.mode === ModeType.WHITELIST) {
      if (currentDomain) {
        const isNotInList = !isInList(currentDomain, whitelist);
        if (isNotInList) {
          setWhitelist([...whitelist, currentDomain]);
          showMessage(t("popup.addedToWhitelist", { domain: currentDomain }));
        } else {
          showMessage(t("popup.alreadyInWhitelist", { domain: currentDomain }));
        }
      }
    } else {
      if (currentDomain) {
        const isNotInList = !isInList(currentDomain, blacklist);
        if (isNotInList) {
          setBlacklist([...blacklist, currentDomain]);
          showMessage(t("popup.addedToBlacklist", { domain: currentDomain }));
        } else {
          showMessage(t("popup.alreadyInBlacklist", { domain: currentDomain }));
        }
      }
    }
  }, [
    currentDomain,
    whitelist,
    blacklist,
    setWhitelist,
    setBlacklist,
    showMessage,
    t,
    settings.mode,
  ]);

  const quickClearCurrent = useCallback(() => {
    showConfirm(
      t("popup.confirmClear"),
      t("popup.confirmClearCurrent", { domain: currentDomain }),
      "warning",
      () => {
        clearCookies(
          (d) => isDomainMatch(d, currentDomain),
          t("popup.clearCurrent"),
          settings.clearType
        );
      }
    );
  }, [currentDomain, clearCookies, settings.clearType, showConfirm, t]);

  const quickClearAll = useCallback(() => {
    showConfirm(t("popup.confirmClear"), t("popup.confirmClearAll"), "danger", () => {
      clearCookies(() => true, t("common.allWebsites"), settings.clearType);
    });
  }, [clearCookies, settings.clearType, showConfirm, t]);

  useEffect(() => {
    const cookieListener = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        updateStats();
      }, DEBOUNCE_DELAY_MS);
    };

    chrome.cookies.onChanged.addListener(cookieListener);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (messageTimerRef.current) {
        clearTimeout(messageTimerRef.current);
      }
      chrome.cookies.onChanged.removeListener(cookieListener);
    };
  }, [updateStats]);

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
    const successHover = getHoverColor(customTheme.success);
    const successActive = getActiveColor(customTheme.success);
    const warningHover = getHoverColor(customTheme.warning);
    const warningActive = getActiveColor(customTheme.warning);
    const dangerHover = getHoverColor(customTheme.danger);
    const dangerActive = getActiveColor(customTheme.danger);

    const themeVars: Record<string, string | undefined> = {
      "--accent-primary": customTheme.primary,
      "--accent-success": customTheme.success,
      "--accent-warning": customTheme.warning,
      "--accent-danger": customTheme.danger,
      "--surface-primary": customTheme.bgPrimary,
      "--surface-secondary": customTheme.bgSecondary,
      "--text-primary": customTheme.textPrimary,
      "--text-secondary": customTheme.textSecondary,
      "--primary-500": customTheme.primary,
      "--primary-600": primaryHover,
      "--primary-700": primaryActive,
      "--success-500": customTheme.success,
      "--success-600": successHover,
      "--success-700": successActive,
      "--warning-500": customTheme.warning,
      "--warning-600": warningHover,
      "--warning-700": warningActive,
      "--danger-500": customTheme.danger,
      "--danger-600": dangerHover,
      "--danger-700": dangerActive,
      "--bg-primary": customTheme.bgPrimary,
      "--bg-secondary": customTheme.bgSecondary,
      "--bg-card": customTheme.bgSecondary,
    };
    Object.entries(themeVars).forEach(([prop, value]) => {
      if (value) root.style.setProperty(prop, value);
    });
  }, []);

  const clearCustomTheme = useCallback(() => {
    const root = document.documentElement;
    const customVars = [
      "--accent-primary",
      "--accent-success",
      "--accent-warning",
      "--accent-danger",
      "--surface-primary",
      "--surface-secondary",
      "--text-primary",
      "--text-secondary",
      "--primary-500",
      "--primary-600",
      "--primary-700",
      "--success-500",
      "--success-600",
      "--success-700",
      "--warning-500",
      "--warning-600",
      "--warning-700",
      "--danger-500",
      "--danger-600",
      "--danger-700",
      "--bg-primary",
      "--bg-secondary",
      "--bg-card",
    ];
    customVars.forEach((prop) => root.style.removeProperty(prop));
  }, []);

  useEffect(() => {
    if (settings.themeMode === ThemeMode.CUSTOM) {
      applyCustomTheme(settings.customTheme);
    } else {
      clearCustomTheme();
    }
  }, [settings.themeMode, settings.customTheme, applyCustomTheme, clearCustomTheme]);

  useEffect(() => {
    async function init() {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) {
          try {
            const url = new URL(tab.url);
            setCurrentDomain(url.hostname);
          } catch {
            setCurrentDomain("");
          }
        }
      } catch {
        setCurrentDomain("");
      }
    }
    init();
  }, []);

  useEffect(() => {
    updateStats();
  }, [currentDomain, updateStats]);

  return (
    <ErrorBoundary>
      <div className={`app-shell theme-${theme}`}>
        <header className="app-header">
          <div className="app-brand">
            <h1>{t("app.title")}</h1>
          </div>
          <div className="mode-badge">
            {settings.mode === ModeType.WHITELIST
              ? t("settings.whitelistModeShort")
              : t("settings.blacklistModeShort")}
          </div>
        </header>

        <nav className="tabs" role="tablist" tabIndex={0} onKeyDown={handleTabKeyDown}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              data-testid={`tab-${tab.id}`}
              className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${tab.id}-panel`}
              tabIndex={activeTab === tab.id ? 0 : -1}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {activeTab === "manage" && (
          <main className="tab-content" role="tabpanel" id="manage-panel">
            <section className="site-summary panel" data-testid="site-summary">
              <div className="panel-header">
                <h2 className="site-title">{currentDomain || t("popup.unableToGetDomain")}</h2>
                <div className="status-badges">
                  {siteStatus === "protected" && (
                    <span className="badge badge-success">{t("popup.protectedSite")}</span>
                  )}
                  {siteStatus === "priority-cleanup" && (
                    <span className="badge badge-warning">{t("popup.priorityCleanupSite")}</span>
                  )}
                </div>
              </div>
              <p className="mode-summary">
                {settings.mode === ModeType.WHITELIST
                  ? t("popup.modeSummaryWhitelist")
                  : t("popup.modeSummaryBlacklist")}
              </p>
            </section>

            <section className="insight-strip panel">
              <div className="insight-grid" data-testid="insight-grid">
                <div className="insight-item insight-primary">
                  <span className="insight-value">{stats.current}</span>
                  <span className="insight-label">{t("popup.currentSiteCookies")}</span>
                </div>
                <div className="insight-item">
                  <span className="insight-value">{stats.thirdParty}</span>
                  <span className="insight-label">{t("popup.thirdParty")}</span>
                </div>
                <div className="insight-item insight-danger">
                  <span className="insight-value">{stats.tracking}</span>
                  <span className="insight-label">{t("popup.tracking")}</span>
                </div>
              </div>
              {(stats.thirdParty > 0 || stats.tracking > 0) && (
                <div className={`risk-summary risk-${riskLevel}`}>
                  {stats.tracking > 0
                    ? t("popup.trackingDetected", { count: stats.tracking })
                    : t("popup.thirdPartyDetected", { count: stats.thirdParty })}
                </div>
              )}
            </section>

            <section className="quick-actions-panel panel" data-testid="quick-actions">
              <div className="panel-header">
                <h3>{t("popup.quickManage")}</h3>
              </div>
              <div className="action-cluster">
                <button
                  onClick={quickClearCurrent}
                  className="btn btn-primary btn-block"
                  disabled={!currentDomain}
                >
                  {t("popup.clearCurrent")}
                </button>
                <div className="action-row">
                  <button
                    onClick={quickAddToRule}
                    className="btn btn-secondary"
                    disabled={!currentDomain}
                  >
                    {settings.mode === ModeType.WHITELIST
                      ? t("popup.addToWhitelist")
                      : t("popup.addToBlacklist")}
                  </button>
                  <button onClick={quickClearAll} className="btn btn-danger">
                    {t("popup.clearAllCookies")}
                  </button>
                </div>
              </div>
            </section>

            <section className="cookie-overview-panel panel">
              <div className="panel-header">
                <h3>{t("popup.cookieStats")}</h3>
                <span className="stat-secondary">
                  {t("popup.total")}: {stats.total}
                </span>
              </div>
              <div className="stats-secondary">
                <div className="stat-item-small">
                  <span className="stat-label">{t("popup.session")}</span>
                  <span className="stat-value">{stats.session}</span>
                </div>
                <div className="stat-item-small">
                  <span className="stat-label">{t("popup.persistent")}</span>
                  <span className="stat-value">{stats.persistent}</span>
                </div>
              </div>
            </section>

            <CookieList
              cookies={currentCookies}
              currentDomain={currentDomain}
              onUpdate={updateStats}
              onMessage={(text, isError = false) => showMessage(text, isError)}
              whitelist={whitelist}
              blacklist={blacklist}
              showCookieRisk={settings.showCookieRisk}
              onAddToWhitelist={(domains) => {
                const newDomains = domains.filter((d) => !isInList(d, whitelist));
                if (newDomains.length > 0) {
                  setWhitelist([...whitelist, ...newDomains]);
                }
              }}
              onAddToBlacklist={(domains) => {
                const newDomains = domains.filter((d) => !isInList(d, blacklist));
                if (newDomains.length > 0) {
                  setBlacklist([...blacklist, ...newDomains]);
                }
              }}
            />
          </main>
        )}

        {activeTab === "rules" && (
          <div className="tab-content" role="tabpanel" id="rules-panel">
            <DomainManager
              type={settings.mode === ModeType.WHITELIST ? "whitelist" : "blacklist"}
              currentDomain={currentDomain}
              onMessage={showMessage}
              onClearBlacklist={
                settings.mode === ModeType.BLACKLIST
                  ? async () => {
                      try {
                        const result = await performCleanupWithFilter(
                          (domain) => isInList(domain, blacklist),
                          {
                            clearType: CookieClearType.ALL,
                            clearCache: settings.clearCache,
                            clearLocalStorage: settings.clearLocalStorage,
                            clearIndexedDB: settings.clearIndexedDB,
                          }
                        );

                        if (result.count > 0) {
                          const domainStr = buildDomainString(
                            new Set(result.clearedDomains),
                            t("tabs.blacklist"),
                            currentDomain,
                            t
                          );
                          addLog(
                            domainStr,
                            CookieClearType.ALL,
                            result.count,
                            settings.logRetention
                          );
                          showMessage(t("popup.clearedBlacklist", { count: result.count }));
                          updateStats();
                        } else {
                          showMessage(t("popup.noBlacklistCookies"));
                        }
                      } catch (e) {
                        console.error("Failed to clear blacklist:", {
                          error: e,
                          trigger: "clearBlacklist",
                          mode: settings.mode,
                        });
                        showMessage(t("popup.clearCookiesFailed"), true);
                      }
                    }
                  : undefined
              }
            />
          </div>
        )}

        {activeTab === "settings" && (
          <div className="tab-content" role="tabpanel" id="settings-panel">
            <Settings onMessage={showMessage} />
          </div>
        )}

        {activeTab === "log" && (
          <div className="tab-content" role="tabpanel" id="log-panel">
            <ClearLog onMessage={showMessage} />
          </div>
        )}

        <div
          className={`toast-container ${message.visible ? "visible" : ""} ${message.isError ? "error" : ""}`}
          role={message.isError ? "alert" : "status"}
          aria-live="polite"
          data-testid="toast-message"
        >
          {message.text}
        </div>

        <ConfirmDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          variant={confirmState.variant}
          onConfirm={handleConfirm}
          onCancel={closeConfirm}
        />
      </div>
    </ErrorBoundary>
  );
}

export default IndexPopup;
