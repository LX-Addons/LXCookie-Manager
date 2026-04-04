import { useCallback } from "react";
import { BackgroundService } from "@/lib/background-service";
import type { DomainList, Settings as SettingsType } from "@/types";
import { CookieClearType, ModeType } from "@/types";
import { addDomainsToList } from "@/utils/domain-rules";
import { useTranslation } from "@/hooks";
import type { ShowConfirmFn } from "@/contexts/ConfirmDialogContext";

interface UsePopupActionsProps {
  currentDomain: string;
  settings: SettingsType;
  whitelist: DomainList;
  blacklist: DomainList;
  setWhitelist: (list: DomainList) => void;
  setBlacklist: (list: DomainList) => void;
  showMessage: (text: string, isError?: boolean) => void;
  updateStats: () => Promise<void>;
  showConfirm: ShowConfirmFn;
}

interface UsePopupActionsReturn {
  quickAddToRule: () => void;
  quickClearCurrent: (triggerElement?: HTMLElement | null) => void;
  quickClearAll: (triggerElement?: HTMLElement | null) => void;
  handleAddToWhitelist: (domains: string[]) => void;
  handleAddToBlacklist: (domains: string[]) => void;
  handleClearBlacklist: () => Promise<void>;
}

export function usePopupActions({
  currentDomain,
  settings,
  whitelist,
  blacklist,
  setWhitelist,
  setBlacklist,
  showMessage,
  updateStats,
  showConfirm,
}: UsePopupActionsProps): UsePopupActionsReturn {
  const { t } = useTranslation();

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
          try {
            await updateStats();
          } catch (statsError) {
            console.error("Failed to update stats after clearing cookies:", statsError);
          }
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
      alreadyInKey: string,
      listType: string
    ) => {
      const result = addDomainsToList([domain], list);
      if (result.changed) {
        setList(result.nextList);
        showMessage(t(addedKey, { listType }));
      } else {
        showMessage(t(alreadyInKey, { domain, listType }));
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
        "domainManager.addedToList",
        "domainManager.alreadyInList",
        t("tabs.whitelist")
      );
    } else {
      addToListOrShowMessage(
        currentDomain,
        blacklist,
        setBlacklist,
        "domainManager.addedToList",
        "domainManager.alreadyInList",
        t("tabs.blacklist")
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
    t,
  ]);

  const quickClearCurrent = useCallback(
    (triggerElement?: HTMLElement | null) => {
      if (!currentDomain) return;

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
      const result = addDomainsToList(domains, whitelist);
      if (result.changed) {
        setWhitelist(result.nextList);
      }
    },
    [whitelist, setWhitelist]
  );

  const handleAddToBlacklist = useCallback(
    (domains: string[]) => {
      const result = addDomainsToList(domains, blacklist);
      if (result.changed) {
        setBlacklist(result.nextList);
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
          try {
            await updateStats();
          } catch (statsError) {
            console.error("Failed to update stats after clearing blacklist:", statsError);
          }
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

  return {
    quickAddToRule,
    quickClearCurrent,
    quickClearAll,
    handleAddToWhitelist,
    handleAddToBlacklist,
    handleClearBlacklist,
  };
}
