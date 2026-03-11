import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { useStorage } from "@/hooks/useStorage";
import { DomainManager } from "@/components/DomainManager";
import { Settings } from "@/components/Settings";
import { ClearLog } from "@/components/ClearLog";
import { CookieList } from "@/components/CookieList";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useTranslation } from "@/hooks/useTranslation";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import {
  WHITELIST_KEY,
  BLACKLIST_KEY,
  SETTINGS_KEY,
  CLEAR_LOG_KEY,
  DEFAULT_SETTINGS,
  LOG_RETENTION_MAP,
} from "@/lib/store";
import type {
  DomainList,
  CookieStats,
  Settings as SettingsType,
  ClearLogEntry,
  Cookie,
} from "@/types";
import { CookieClearType, ThemeMode, LogRetention, ModeType } from "@/types";
import { isDomainMatch, isInList, isTrackingCookie, isThirdPartyCookie } from "@/utils";
import {
  performCleanupWithFilter,
  cleanupExpiredCookies as cleanupExpiredCookiesUtil,
  performCleanup,
} from "@/utils/cleanup";
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
  const logIdCounterRef = useRef<number>(0);

  const { confirmState, showConfirm, closeConfirm, handleConfirm } = useConfirmDialog();

  const [whitelist, setWhitelist] = useStorage<DomainList>(WHITELIST_KEY, []);
  const [blacklist, setBlacklist] = useStorage<DomainList>(BLACKLIST_KEY, []);
  const [settings] = useStorage<SettingsType>(SETTINGS_KEY, DEFAULT_SETTINGS);
  const [, setLogs] = useStorage<ClearLogEntry[]>(CLEAR_LOG_KEY, []);
  const { t } = useTranslation();

  const theme = useMemo(() => {
    const themeMode = settings.themeMode;
    if (themeMode === ThemeMode.AUTO) {
      return systemTheme === "dark" ? ThemeMode.DARK : ThemeMode.LIGHT;
    }
    return themeMode;
  }, [settings.themeMode, systemTheme]);

  const tabs = useMemo(
    () => [
      { id: "manage", label: t("tabs.manage"), icon: "🏠" },
      {
        id: settings.mode === ModeType.WHITELIST ? "whitelist" : "blacklist",
        label: settings.mode === ModeType.WHITELIST ? t("tabs.whitelist") : t("tabs.blacklist"),
        icon: "📝",
      },
      { id: "settings", label: t("tabs.settings"), icon: "⚙️" },
      { id: "log", label: t("tabs.log"), icon: "📋" },
    ],
    [settings.mode, t]
  );

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = tabs.findIndex((t) => t.id === activeTab);
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % tabs.length;
        setActiveTab(tabs[nextIndex].id);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        setActiveTab(tabs[prevIndex].id);
      } else if (e.key === "Home") {
        e.preventDefault();
        setActiveTab(tabs[0].id);
      } else if (e.key === "End") {
        e.preventDefault();
        const lastTab = tabs.at(-1);
        if (lastTab) {
          setActiveTab(lastTab.id);
        }
      }
    },
    [activeTab, tabs]
  );

  const showMessage = useCallback((text: string, isError = false) => {
    setMessage({ text, isError, visible: true });
    setTimeout(() => setMessage((prev) => ({ ...prev, visible: false })), MESSAGE_DURATION);
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
      console.error("Failed to update stats:", e);
      showMessage(t("popup.updateStatsFailed"), true);
    }
  }, [currentDomain, showMessage, t]);

  const addLog = useCallback(
    (
      domain: string,
      cookieType: CookieClearType,
      count: number,
      action: "clear" | "edit" | "delete" | "import" | "export" = "clear",
      details?: string
    ) => {
      // 使用递增计数器生成唯一ID，避免使用 Math.random()
      logIdCounterRef.current += 1;
      const newLog: ClearLogEntry = {
        id: `${Date.now()}-${logIdCounterRef.current}`,
        domain,
        cookieType,
        count,
        timestamp: Date.now(),
        action,
        details,
      };

      if (settings.logRetention === LogRetention.FOREVER) {
        setLogs((prev) => [newLog, ...(prev ?? [])]);
        return;
      }

      const now = Date.now();
      const retentionMs = LOG_RETENTION_MAP[settings.logRetention] || 7 * 24 * 60 * 60 * 1000;
      setLogs((prev) => {
        const currentPrev = prev ?? [];
        const filteredLogs = currentPrev.filter((log) => now - log.timestamp <= retentionMs);
        return [newLog, ...filteredLogs];
      });
    },
    [settings.logRetention, setLogs]
  );

  const buildDomainString = useCallback(
    (clearedDomains: Set<string>, successMsg: string): string => {
      if (clearedDomains.size === 1) {
        return Array.from(clearedDomains)[0];
      }
      if (clearedDomains.size > 1) {
        return t("common.domains", {
          domain: Array.from(clearedDomains)[0],
          count: clearedDomains.size,
        });
      }
      return successMsg.includes(t("common.allWebsites")) ? t("common.allWebsites") : currentDomain;
    },
    [currentDomain, t]
  );

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
          const domainStr = buildDomainString(new Set(result.clearedDomains), successMsg);
          addLog(domainStr, logType, result.count);
        }

        showMessage(t("popup.clearedSuccess", { successMsg, count: result.count }));
        await updateStats();
      } catch (e) {
        console.error("Failed to clear cookies:", e);
        showMessage(t("popup.clearCookiesFailed"), true);
      }
    },
    [
      settings.clearCache,
      settings.clearLocalStorage,
      settings.clearIndexedDB,
      buildDomainString,
      addLog,
      showMessage,
      updateStats,
      t,
    ]
  );

  const cleanupStartup = useCallback(async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        try {
          const url = new URL(tab.url);
          const result = await performCleanup({
            domain: url.hostname,
            clearType: settings.clearType,
            clearCache: settings.clearCache,
          });

          if (result && result.count > 0) {
            addLog(t("popup.startupCleanup"), settings.clearType, result.count);
          }
        } catch (e) {
          console.error("Failed to cleanup on startup:", e);
        }
      }
    } catch (e) {
      console.error("Failed to cleanup on startup:", e);
    }
  }, [settings.clearType, settings.clearCache, addLog, t]);

  const cleanupExpiredCookies = useCallback(async () => {
    try {
      const count = await cleanupExpiredCookiesUtil();

      if (count > 0) {
        addLog(t("popup.expiredCookieCleanup"), CookieClearType.ALL, count);
        showMessage(t("popup.cleanedExpired", { count }));
      } else {
        showMessage(t("popup.noExpiredFound"));
      }

      updateStats();
    } catch (e) {
      console.error("Failed to cleanup expired cookies:", e);
      showMessage(t("popup.cleanExpiredFailed"), true);
    }
  }, [addLog, showMessage, updateStats, t]);

  const quickAddToWhitelist = useCallback(() => {
    if (currentDomain && !whitelist.includes(currentDomain)) {
      setWhitelist([...whitelist, currentDomain]);
      showMessage(t("popup.addedToWhitelist", { domain: currentDomain }));
    } else if (currentDomain) {
      showMessage(t("popup.alreadyInWhitelist", { domain: currentDomain }));
    }
  }, [currentDomain, whitelist, setWhitelist, showMessage, t]);

  const quickAddToBlacklist = useCallback(() => {
    if (currentDomain && !blacklist.includes(currentDomain)) {
      setBlacklist([...blacklist, currentDomain]);
      showMessage(t("popup.addedToBlacklist", { domain: currentDomain }));
    } else if (currentDomain) {
      showMessage(t("popup.alreadyInBlacklist", { domain: currentDomain }));
    }
  }, [currentDomain, blacklist, setBlacklist, showMessage, t]);

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

  useEffect(() => {
    if (settings.themeMode === ThemeMode.CUSTOM && settings.customTheme) {
      const root = document.documentElement;
      const { primary, success, warning, danger, bgPrimary, textPrimary } = settings.customTheme;
      if (primary) root.style.setProperty("--primary-500", primary);
      if (success) root.style.setProperty("--success-500", success);
      if (warning) root.style.setProperty("--warning-500", warning);
      if (danger) root.style.setProperty("--danger-500", danger);
      if (bgPrimary) root.style.setProperty("--bg-primary", bgPrimary);
      if (textPrimary) root.style.setProperty("--text-primary", textPrimary);
    }
  }, [settings.themeMode, settings.customTheme]);

  useEffect(() => {
    async function init() {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        try {
          const url = new URL(tab.url);
          setCurrentDomain(url.hostname);
        } catch {
          setCurrentDomain("");
        }
      }
      updateStats();

      if (settings.cleanupOnStartup) {
        await cleanupStartup();
      }

      if (settings.cleanupExpiredCookies) {
        await cleanupExpiredCookies();
      }
    }
    init();
  }, [
    settings.mode,
    settings.cleanupOnStartup,
    settings.cleanupExpiredCookies,
    updateStats,
    cleanupStartup,
    cleanupExpiredCookies,
  ]);

  return (
    <ErrorBoundary>
      <div className={`container theme-${theme}`}>
        <header>
          <h1>
            <span aria-hidden="true">🍪</span> Cookie Manager Pro
          </h1>
        </header>

        <div className="tabs" role="tablist" tabIndex={0} onKeyDown={handleTabKeyDown}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              data-testid={`tab-${tab.id}`}
              className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${tab.id}-panel`}
              tabIndex={activeTab === tab.id ? 0 : -1}
            >
              <span className="tab-icon" aria-hidden="true">
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === "manage" && (
          <div className="tab-content" role="tabpanel" id="manage-panel">
            <div className="section">
              <h3>
                <span className="section-icon" aria-hidden="true">
                  🌐
                </span>
                {t("popup.currentWebsite")}
              </h3>
              <div className="domain-info">{currentDomain || t("popup.unableToGetDomain")}</div>
            </div>

            <div className="section">
              <h3>
                <span className="section-icon" aria-hidden="true">
                  📊
                </span>
                {t("popup.cookieStats")}
              </h3>
              <div className="stats">
                <div className="stat-item">
                  <span className="stat-label">{t("popup.total")}</span>
                  <span className="stat-value">{stats.total}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">{t("popup.current")}</span>
                  <span className="stat-value">{stats.current}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">{t("popup.session")}</span>
                  <span className="stat-value">{stats.session}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">{t("popup.persistent")}</span>
                  <span className="stat-value">{stats.persistent}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">{t("popup.thirdParty")}</span>
                  <span className="stat-value">{stats.thirdParty}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">{t("popup.tracking")}</span>
                  <span className="stat-value">{stats.tracking}</span>
                </div>
              </div>
            </div>

            <div className="section">
              <h3>
                <span className="section-icon" aria-hidden="true">
                  ⚡
                </span>
                {t("popup.quickActions")}
              </h3>
              <div className="button-group">
                <button onClick={quickAddToWhitelist} className="btn btn-success">
                  <span className="btn-icon" aria-hidden="true">
                    ✓
                  </span>
                  {t("popup.addToWhitelist")}
                </button>
                <button onClick={quickAddToBlacklist} className="btn btn-secondary">
                  <span className="btn-icon" aria-hidden="true">
                    ✗
                  </span>
                  {t("popup.addToBlacklist")}
                </button>
                <button onClick={quickClearCurrent} className="btn btn-warning">
                  <span className="btn-icon" aria-hidden="true">
                    🧹
                  </span>
                  {t("popup.clearCurrent")}
                </button>
                <button onClick={quickClearAll} className="btn btn-danger">
                  <span className="btn-icon" aria-hidden="true">
                    🔥
                  </span>
                  {t("popup.clearAllCookies")}
                </button>
              </div>
            </div>

            <CookieList
              cookies={currentCookies}
              currentDomain={currentDomain}
              onUpdate={updateStats}
              onMessage={(text, isError = false) => showMessage(text, isError)}
              whitelist={whitelist}
              blacklist={blacklist}
              onAddToWhitelist={(domains) => {
                const newDomains = domains.filter((d) => !whitelist.includes(d));
                if (newDomains.length > 0) {
                  setWhitelist([...whitelist, ...newDomains]);
                }
              }}
              onAddToBlacklist={(domains) => {
                const newDomains = domains.filter((d) => !blacklist.includes(d));
                if (newDomains.length > 0) {
                  setBlacklist([...blacklist, ...newDomains]);
                }
              }}
            />
          </div>
        )}

        {activeTab === "whitelist" && (
          <div className="tab-content" role="tabpanel" id="whitelist-panel">
            <DomainManager type="whitelist" currentDomain={currentDomain} onMessage={showMessage} />
          </div>
        )}

        {activeTab === "blacklist" && (
          <div className="tab-content" role="tabpanel" id="blacklist-panel">
            <DomainManager
              type="blacklist"
              currentDomain={currentDomain}
              onMessage={showMessage}
              onClearBlacklist={async () => {
                const result = await performCleanupWithFilter(
                  (domain) => isInList(domain, blacklist),
                  {
                    clearType: CookieClearType.ALL,
                  }
                );

                if (result.count > 0) {
                  const domainStr = buildDomainString(
                    new Set(result.clearedDomains),
                    t("tabs.blacklist")
                  );
                  addLog(domainStr, CookieClearType.ALL, result.count);
                  showMessage(t("popup.clearedBlacklist", { count: result.count }));
                  updateStats();
                } else {
                  showMessage(t("popup.noBlacklistCookies"));
                }
              }}
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
          className={`message ${message.isError ? "error" : ""} ${message.visible ? "visible" : ""}`}
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

// Only render in browser environment, not in tests
// In test environment, vitest sets import.meta.env.TEST to true
const isTestEnvironment =
  import.meta.env?.TEST === true ||
  (typeof globalThis !== "undefined" &&
    (globalThis as typeof globalThis & { __VITEST__?: boolean }).__VITEST__);

if (!isTestEnvironment) {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<IndexPopup />);
  }
}
