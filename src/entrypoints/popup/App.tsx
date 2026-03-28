import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useStorage } from "@/hooks/useStorage";
import { DomainManager } from "@/components/DomainManager";
import { Settings } from "@/components/Settings";
import { ClearLog } from "@/components/ClearLog";
import { CookieList } from "@/components/CookieList";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusPanel } from "@/components/StatusPanel";
import { Icon, type IconName } from "@/components/Icon";
import { useTranslation } from "@/hooks/useTranslation";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { WHITELIST_KEY, BLACKLIST_KEY, SETTINGS_KEY, DEFAULT_SETTINGS } from "@/lib/store";
import { BackgroundService } from "@/lib/background-service";
import type {
  DomainList,
  CookieStats,
  Settings as SettingsType,
  Cookie as CookieType,
  CustomTheme,
  GetCurrentTabCookiesData,
  ApiResponse,
} from "@/types";
import { CookieClearType, ThemeMode, ModeType, ErrorCode } from "@/types";
import { isInList } from "@/utils/domain";
import {
  getHoverColor,
  getActiveColor,
  getLineSoftColor,
  getLineStrongColor,
  getLighterColor,
  getMutedTextColor,
  getContrastColor,
} from "@/utils/theme";
import { MESSAGE_DURATION, DEBOUNCE_DELAY_MS } from "@/lib/constants";
import "./style.css";

type LoadingState = "idle" | "loading" | "domain-unavailable" | "load-failed" | "permission-denied";

function IndexPopup() {
  const [currentDomain, setCurrentDomain] = useState("");
  const [activeTab, setActiveTab] = useState("manage");
  const [message, setMessage] = useState({ text: "", isError: false, visible: false });
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [stats, setStats] = useState<CookieStats>({
    total: 0,
    current: 0,
    session: 0,
    persistent: 0,
    thirdParty: 0,
    tracking: 0,
  });
  const [currentCookies, setCurrentCookies] = useState<CookieType[]>([]);
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => {
    if (typeof globalThis !== "undefined") {
      return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const loadRequestIdRef = useRef(0);

  const { confirmState, showConfirm, closeConfirm, handleConfirm } = useConfirmDialog();

  const [whitelist, setWhitelist] = useStorage<DomainList>(WHITELIST_KEY, []);
  const [blacklist, setBlacklist] = useStorage<DomainList>(BLACKLIST_KEY, []);
  const [settings] = useStorage<SettingsType>(SETTINGS_KEY, DEFAULT_SETTINGS);
  const { t } = useTranslation();

  const isCustomThemeDark = useCallback((customTheme: CustomTheme | undefined) => {
    if (!customTheme) return false;
    const hex = customTheme.bgPrimary.replace("#", "");
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

  const tabs = useMemo<
    Array<{
      id: string;
      label: string;
      iconName: IconName;
    }>
  >(
    () => [
      { id: "manage", label: t("tabs.manage"), iconName: "cookie" },
      {
        id: "rules",
        label: settings.mode === ModeType.WHITELIST ? t("tabs.whitelist") : t("tabs.blacklist"),
        iconName: "list",
      },
      { id: "settings", label: t("tabs.settings"), iconName: "settings" },
      { id: "log", label: t("tabs.log"), iconName: "shield" },
    ],
    [settings.mode, t]
  );

  const getNewTabId = (e: React.KeyboardEvent, activeTab: string, tabs: Array<{ id: string }>) => {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        return tabs[(currentIndex + 1) % tabs.length].id;
      case "ArrowLeft":
        e.preventDefault();
        return tabs[(currentIndex - 1 + tabs.length) % tabs.length].id;
      case "Home":
        e.preventDefault();
        return tabs[0].id;
      case "End":
        e.preventDefault();
        return tabs.at(-1)?.id;
      default:
        return null;
    }
  };

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const newTabId = getNewTabId(e, activeTab, tabs);

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

  const resetPermissionDeniedState = useCallback(() => {
    setLoadingState("permission-denied");
    setCurrentDomain("");
    setStats({
      total: 0,
      current: 0,
      session: 0,
      persistent: 0,
      thirdParty: 0,
      tracking: 0,
    });
    setCurrentCookies([]);
  }, []);

  const handleCookiesResponseSuccess = useCallback(
    async (cookiesData: GetCurrentTabCookiesData, requestId: number, isInit: boolean) => {
      const requestedDomain = cookiesData.domain;
      const statsResponse = await BackgroundService.getStats(requestedDomain);
      if (requestId !== loadRequestIdRef.current) return;

      if (statsResponse.success && statsResponse.data) {
        setCurrentDomain(requestedDomain);
        setCurrentCookies(cookiesData.cookies);
        setStats(statsResponse.data);
        setLoadingState("idle");
      } else if (statsResponse.error?.code === ErrorCode.INSUFFICIENT_PERMISSIONS) {
        resetPermissionDeniedState();
      } else {
        setLoadingState("load-failed");
        if (!isInit) {
          showMessage(t("popup.updateStatsFailed"), true);
        }
      }
    },
    [resetPermissionDeniedState, showMessage, t]
  );

  const handleCookiesResponse = useCallback(
    async (
      cookiesResponse: ApiResponse<GetCurrentTabCookiesData>,
      requestId: number,
      isInit: boolean
    ) => {
      if (cookiesResponse.success && cookiesResponse.data) {
        await handleCookiesResponseSuccess(cookiesResponse.data, requestId, isInit);
      } else if (cookiesResponse.error?.code === ErrorCode.INSUFFICIENT_PERMISSIONS) {
        resetPermissionDeniedState();
      } else {
        setLoadingState("domain-unavailable");
        setCurrentDomain("");
      }
    },
    [handleCookiesResponseSuccess, resetPermissionDeniedState]
  );

  const loadStats = useCallback(
    async (options: { isInit: boolean }) => {
      const { isInit } = options;
      const requestId = ++loadRequestIdRef.current;
      let requestedDomain: string | undefined;
      try {
        setLoadingState("loading");
        const cookiesResponse = await BackgroundService.getCurrentTabCookies();
        if (requestId !== loadRequestIdRef.current) return;
        await handleCookiesResponse(cookiesResponse, requestId, isInit);
      } catch (e) {
        if (requestId !== loadRequestIdRef.current) return;
        console.error("Failed to load stats:", {
          error: e,
          currentDomain: requestedDomain,
          isInit,
        });
        setLoadingState("load-failed");
        if (!isInit) {
          showMessage(t("popup.updateStatsFailed"), true);
        }
      }
    },
    [handleCookiesResponse, showMessage, t]
  );

  const init = useCallback(async () => {
    await loadStats({ isInit: true });
  }, [loadStats]);

  const updateStats = useCallback(async () => {
    await loadStats({ isInit: false });
  }, [loadStats]);

  const clearCookies = useCallback(
    async (
      filterType: "all" | "domain",
      filterValue: string | undefined,
      successMsg: string,
      logType: CookieClearType
    ) => {
      try {
        const response = await BackgroundService.cleanupWithFilter(
          filterType,
          filterValue,
          filterType === "all" ? "manual-all" : "manual-current",
          {
            clearType: logType,
            clearCache: settings.clearCache,
            clearLocalStorage: settings.clearLocalStorage,
            clearIndexedDB: settings.clearIndexedDB,
          }
        );

        if (response.success && response.data) {
          const result = response.data;
          if (result.cookiesRemoved > 0) {
            showMessage(t("popup.clearedSuccess", { successMsg, count: result.cookiesRemoved }));
          } else {
            showMessage(t("popup.noCookiesCleared"));
          }
          await updateStats();
        } else {
          showMessage(t("popup.clearCookiesFailed"), true);
        }
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
      settings.mode,
      currentDomain,
      showMessage,
      updateStats,
      t,
    ]
  );

  const addToListOrShowMessage = useCallback(
    (
      domain: string,
      list: DomainList,
      setList: (newList: DomainList) => void,
      addedKey: string,
      alreadyInKey: string
    ) => {
      const isIn = isInList(domain, list);
      if (isIn) {
        showMessage(t(alreadyInKey, { domain }));
      } else {
        setList([...list, domain]);
        showMessage(t(addedKey, { domain }));
      }
    },
    [showMessage, t]
  );

  const quickAddToRule = useCallback(() => {
    if (!currentDomain) return;

    if (settings.mode === ModeType.WHITELIST) {
      addToListOrShowMessage(
        currentDomain,
        whitelist,
        setWhitelist,
        "popup.addedToWhitelist",
        "popup.alreadyInWhitelist"
      );
    } else {
      addToListOrShowMessage(
        currentDomain,
        blacklist,
        setBlacklist,
        "popup.addedToBlacklist",
        "popup.alreadyInBlacklist"
      );
    }
  }, [
    currentDomain,
    whitelist,
    blacklist,
    setWhitelist,
    setBlacklist,
    addToListOrShowMessage,
    settings.mode,
  ]);

  const quickClearCurrent = useCallback(
    (triggerElement?: HTMLElement | null) => {
      showConfirm(
        t("popup.confirmClear"),
        t("popup.confirmClearCurrent", { domain: currentDomain }),
        "warning",
        () => {
          clearCookies("domain", currentDomain, t("popup.clearCurrent"), settings.clearType);
        },
        { triggerElement }
      );
    },
    [currentDomain, clearCookies, settings.clearType, showConfirm, t]
  );

  const quickClearAll = useCallback(
    (triggerElement?: HTMLElement | null) => {
      showConfirm(
        t("popup.confirmClear"),
        t("popup.confirmClearAll"),
        "danger",
        () => {
          clearCookies("all", undefined, t("common.allWebsites"), settings.clearType);
        },
        { triggerElement }
      );
    },
    [clearCookies, settings.clearType, showConfirm, t]
  );

  const handleAddToWhitelist = useCallback(
    (domains: string[]) => {
      const newDomains = domains.filter((d) => !isInList(d, whitelist));
      if (newDomains.length > 0) {
        setWhitelist([...whitelist, ...newDomains]);
      }
    },
    [whitelist, setWhitelist]
  );

  const handleAddToBlacklist = useCallback(
    (domains: string[]) => {
      const newDomains = domains.filter((d) => !isInList(d, blacklist));
      if (newDomains.length > 0) {
        setBlacklist([...blacklist, ...newDomains]);
      }
    },
    [blacklist, setBlacklist]
  );

  const handleClearBlacklist = useCallback(async () => {
    try {
      const response = await BackgroundService.cleanupWithFilter(
        "domain-list",
        undefined,
        "manual-all",
        {
          clearType: CookieClearType.ALL,
          clearCache: settings.clearCache,
          clearLocalStorage: settings.clearLocalStorage,
          clearIndexedDB: settings.clearIndexedDB,
          domainList: blacklist,
        }
      );

      if (response.success && response.data) {
        const result = response.data;
        if (result.cookiesRemoved > 0) {
          showMessage(t("popup.clearedBlacklist", { count: result.cookiesRemoved }));
          updateStats();
        } else {
          showMessage(t("popup.noBlacklistCookies"));
        }
      } else {
        showMessage(t("popup.clearCookiesFailed"), true);
      }
    } catch (e) {
      console.error("Failed to clear blacklist:", {
        error: e,
        trigger: "clearBlacklist",
        mode: settings.mode,
      });
      showMessage(t("popup.clearCookiesFailed"), true);
    }
  }, [
    blacklist,
    settings.clearCache,
    settings.clearLocalStorage,
    settings.clearIndexedDB,
    settings.mode,
    showMessage,
    t,
    updateStats,
  ]);

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
    const customVars = [
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
    init();
  }, [init]);

  const renderSiteStatusIcon = () => {
    if (siteStatus === "protected") {
      return <Icon name="shieldCheck" size={12} />;
    }
    if (siteStatus === "priority-cleanup") {
      return <Icon name="shieldAlert" size={12} />;
    }
    return null;
  };

  const themeClasses = useMemo(() => {
    const classes = ["app-shell"];
    classes.push(`theme-${theme}`);
    return classes.join(" ");
  }, [theme]);

  return (
    <ErrorBoundary>
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
              <span className="header-domain">{currentDomain}</span>
              {siteStatus !== "unknown" && siteStatus !== "normal" && (
                <span className={`header-status ${siteStatus}`}>
                  {renderSiteStatusIcon()}
                  {siteStatus === "protected"
                    ? t("popup.protectedSite")
                    : t("popup.priorityCleanupSite")}
                </span>
              )}
            </div>
          )}
        </header>

        <div className="tabs" role="tablist" tabIndex={0} onKeyDown={handleTabKeyDown}>
          {tabs.map((tab) => {
            return (
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
                <Icon name={tab.iconName} size={14} className="tab-icon" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab === "manage" && (
          <main className="tab-content" role="tabpanel" id="manage-panel">
            {loadingState === "permission-denied" && (
              <section className="panel permission-denied-panel">
                <StatusPanel
                  variant="error"
                  title={t("popup.permissionDenied")}
                  message={t("popup.permissionDeniedDesc")}
                  action={
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        chrome.runtime.openOptionsPage();
                      }}
                    >
                      <Icon name="settings" size={14} />
                      {t("popup.openExtensionSettings")}
                    </button>
                  }
                />
              </section>
            )}
            {loadingState === "domain-unavailable" && (
              <section className="panel domain-unavailable-panel">
                <StatusPanel
                  variant="info"
                  title={t("popup.unableToGetDomain")}
                  message={t("popup.domainUnavailableDesc")}
                />
              </section>
            )}
            {loadingState === "load-failed" && (
              <section className="panel load-error-panel">
                <StatusPanel
                  variant="error"
                  title={t("popup.updateStatsFailed")}
                  message={t("popup.loadFailedDesc")}
                  action={
                    <button className="btn btn-primary" onClick={updateStats}>
                      <Icon name="refresh" size={14} />
                      {t("popup.retry")}
                    </button>
                  }
                />
              </section>
            )}
            {loadingState === "loading" && (
              <section className="panel loading-panel">
                <StatusPanel variant="loading" title={t("popup.loading")} />
              </section>
            )}
            {loadingState === "idle" && (
              <>
                <section className="insight-strip panel" data-testid="insight-strip">
                  <div className="insight-grid">
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

                <section className="mode-summary panel">
                  <p className="mode-summary-text">
                    {settings.mode === ModeType.WHITELIST
                      ? t("popup.modeSummaryWhitelist")
                      : t("popup.modeSummaryBlacklist")}
                  </p>
                </section>

                <section className="quick-actions-panel panel" data-testid="quick-actions">
                  <div className="panel-header">
                    <h3>{t("popup.quickManage")}</h3>
                  </div>
                  <div className="action-cluster">
                    <button
                      onClick={(e) => quickClearCurrent(e.currentTarget)}
                      className="btn btn-primary btn-block"
                      disabled={!currentDomain}
                      data-testid="clear-current-btn"
                    >
                      {t("popup.clearCurrent")}
                    </button>
                    <button
                      onClick={quickAddToRule}
                      className="btn btn-secondary btn-block"
                      disabled={!currentDomain}
                      data-testid="add-to-rule-btn"
                    >
                      {settings.mode === ModeType.WHITELIST
                        ? t("popup.addToWhitelist")
                        : t("popup.addToBlacklist")}
                    </button>
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
                  onAddToWhitelist={handleAddToWhitelist}
                  onAddToBlacklist={handleAddToBlacklist}
                />

                <section className="danger-zone-panel panel">
                  <div className="panel-header">
                    <h3 className="danger-zone-title">{t("popup.dangerZone")}</h3>
                  </div>
                  <p className="danger-zone-desc">{t("popup.dangerZoneDesc")}</p>
                  <button
                    onClick={(e) => quickClearAll(e.currentTarget)}
                    className="btn btn-danger btn-block"
                    data-testid="clear-all-btn"
                  >
                    {t("popup.clearAllCookies")}
                  </button>
                </section>
              </>
            )}
          </main>
        )}

        {activeTab === "rules" && (
          <div className="tab-content" role="tabpanel" id="rules-panel">
            <DomainManager
              type={settings.mode === ModeType.WHITELIST ? "whitelist" : "blacklist"}
              currentDomain={currentDomain}
              onMessage={showMessage}
              onClearBlacklist={
                settings.mode === ModeType.BLACKLIST ? handleClearBlacklist : undefined
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
          aria-live={message.isError ? "assertive" : "polite"}
          data-testid="toast-message"
        >
          {message.text}
        </div>

        <ConfirmDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          description={confirmState.description}
          message={confirmState.message}
          confirmText={confirmState.confirmText}
          cancelText={confirmState.cancelText}
          variant={confirmState.variant}
          onConfirm={handleConfirm}
          onCancel={closeConfirm}
          triggerElement={confirmState.triggerElement}
        />
      </div>
    </ErrorBoundary>
  );
}

export default IndexPopup;
