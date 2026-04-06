import { useCallback } from "react";
import type { Cookie } from "@/types";
import { ErrorCode } from "@/types";
import { BackgroundService } from "@/lib/background-service";
import { isSensitiveCookie } from "@/utils/cookie-risk";
import { getCookieKey } from "@/utils/format";
import { getSelectedDomains, filterRedundantDomains } from "@/components/cookie-list/utils";

interface UseCookieOperationsProps {
  cookies: Cookie[];
  currentDomain: string;
  selectedCookies: Set<string>;
  onUpdate?: () => void;
  onMessage?: (msg: string, isError?: boolean) => void;
  whitelist?: string[];
  blacklist?: string[];
  onAddToWhitelist?: (domains: string[]) => void;
  onAddToBlacklist?: (domains: string[]) => void;
  clearSelectedCookies: () => void;
  showConfirm: (
    title: string,
    message: string,
    variant: "warning" | "danger",
    onConfirm: () => void,
    options?: { triggerElement?: HTMLElement | null }
  ) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useCookieOperations({
  cookies,
  currentDomain: _currentDomain,
  selectedCookies,
  onUpdate,
  onMessage,
  whitelist,
  blacklist,
  onAddToWhitelist,
  onAddToBlacklist,
  clearSelectedCookies,
  showConfirm,
  t,
}: UseCookieOperationsProps) {
  const getErrorMessage = useCallback(
    (errorCode?: ErrorCode, defaultMessage?: string): string => {
      switch (errorCode) {
        case ErrorCode.INSUFFICIENT_PERMISSIONS:
          return t("cookieList.errorInsufficientPermissions");
        case ErrorCode.INVALID_PARAMETERS:
          return t("cookieList.errorInvalidParameters");
        case ErrorCode.INTERNAL_ERROR:
          return t("cookieList.errorInternalError");
        case ErrorCode.COOKIE_REMOVE_FAILED:
          return t("cookieList.errorCookieRemoveFailed");
        case ErrorCode.COOKIE_CREATE_FAILED:
          return t("cookieList.errorCookieCreateFailed");
        case ErrorCode.COOKIE_UPDATE_FAILED:
          return t("cookieList.errorCookieUpdateFailed");
        default:
          return defaultMessage || t("cookieList.errorOperationFailed");
      }
    },
    [t]
  );

  const performDelete = useCallback(
    async (cookie: Cookie) => {
      try {
        const response = await BackgroundService.deleteCookie(cookie);
        if (response.success) {
          onMessage?.(t("cookieList.deletedCookie", { name: cookie.name }));
          onUpdate?.();
        } else {
          const errorMessage = getErrorMessage(
            response.error?.code,
            t("cookieList.deleteCookieFailed")
          );
          onMessage?.(errorMessage, true);
        }
      } catch (e) {
        console.error("Failed to delete cookie:", e);
        onMessage?.(t("cookieList.deleteCookieFailed"), true);
      }
    },
    [onUpdate, onMessage, getErrorMessage, t]
  );

  const handleDelete = useCallback(
    (cookie: Cookie, triggerElement?: HTMLElement | null) => {
      const sensitive = isSensitiveCookie(cookie);
      const title = sensitive
        ? t("cookieList.deleteSensitiveCookie")
        : t("cookieList.deleteConfirm");
      const message = sensitive
        ? t("cookieList.deleteSensitiveMessage", { name: cookie.name })
        : t("cookieList.deleteMessage", { name: cookie.name });
      const variant = sensitive ? "danger" : "warning";

      showConfirm(title, message, variant, () => performDelete(cookie), { triggerElement });
    },
    [performDelete, showConfirm, t]
  );

  const updateCookie = useCallback(
    async (original: Cookie, updatedCookie: Cookie): Promise<boolean> => {
      const supportedFields = [
        "value",
        "httpOnly",
        "secure",
        "sameSite",
        "expirationDate",
      ] as const;
      const updates: Partial<Cookie> = {};
      for (const field of supportedFields) {
        if (field in updatedCookie) {
          (updates as Record<string, unknown>)[field] = updatedCookie[field];
        }
      }
      const response = await BackgroundService.updateCookie(original, updates);
      if (response.success) {
        onMessage?.(t("cookieList.cookieUpdated"));
        onUpdate?.();
        return true;
      }
      const errorMessage = getErrorMessage(
        response.error?.code,
        t("cookieList.updateCookieFailed")
      );
      onMessage?.(errorMessage, true);
      return false;
    },
    [onUpdate, onMessage, getErrorMessage, t]
  );

  const createCookie = useCallback(
    async (updatedCookie: Cookie): Promise<boolean> => {
      const response = await BackgroundService.createCookie(updatedCookie);
      if (response.success) {
        onMessage?.(t("cookieEditor.createSuccess"));
        onUpdate?.();
        return true;
      }
      const errorMessage = getErrorMessage(response.error?.code, t("cookieEditor.createFailed"));
      onMessage?.(errorMessage, true);
      return false;
    },
    [onUpdate, onMessage, getErrorMessage, t]
  );

  const handleSave = useCallback(
    async (original: Cookie | null, updatedCookie: Cookie): Promise<boolean> => {
      try {
        if (original) {
          return await updateCookie(original, updatedCookie);
        }
        return await createCookie(updatedCookie);
      } catch (e) {
        console.error("Failed to save cookie:", e);
        onMessage?.(
          original ? t("cookieList.updateCookieFailed") : t("cookieEditor.createFailed"),
          true
        );
        return false;
      }
    },
    [updateCookie, createCookie, onMessage, t]
  );

  const handleCreate = useCallback(
    async (updatedCookie: Cookie): Promise<boolean> => {
      try {
        return await createCookie(updatedCookie);
      } catch (e) {
        console.error("Failed to create cookie:", e);
        onMessage?.(t("cookieEditor.createFailed"), true);
        return false;
      }
    },
    [createCookie, onMessage, t]
  );

  const performBatchDelete = useCallback(async () => {
    let deleted = 0;
    let failed = 0;
    let lastError: string | undefined;

    for (const cookie of cookies) {
      const key = getCookieKey(cookie.name, cookie.domain, cookie.path, cookie.storeId);
      if (selectedCookies.has(key)) {
        try {
          const response = await BackgroundService.deleteCookie(cookie);
          if (response.success) {
            deleted++;
          } else {
            failed++;
            lastError = getErrorMessage(response.error?.code);
          }
        } catch (e) {
          console.error("Failed to delete cookie:", e);
          failed++;
        }
      }
    }

    if (deleted > 0) {
      let message = t("cookieList.deletedSelected", { count: deleted });
      if (failed > 0) {
        message += t("cookieList.partialDeleteFailed", {
          failed,
          reason: lastError || t("common.unknownError"),
        });
      }
      onMessage?.(message, failed > 0);
      clearSelectedCookies();
      onUpdate?.();
    } else if (failed > 0) {
      onMessage?.(
        t("cookieList.deleteFailedWithReason", { reason: lastError || t("common.unknownError") }),
        true
      );
    }
  }, [cookies, selectedCookies, onUpdate, onMessage, clearSelectedCookies, getErrorMessage, t]);

  const handleBatchDelete = useCallback(
    (triggerElement?: HTMLElement | null) => {
      const sensitiveCount = cookies
        .filter((c) => selectedCookies.has(getCookieKey(c.name, c.domain, c.path, c.storeId)))
        .filter((c) => isSensitiveCookie(c)).length;

      const title =
        sensitiveCount > 0
          ? t("cookieList.deleteSelectedSensitive")
          : t("cookieList.deleteSelectedConfirm");
      const message =
        sensitiveCount > 0
          ? t("cookieList.deleteSelectedSensitiveMessage", {
              sensitiveCount,
              selectedCount: selectedCookies.size,
            })
          : t("cookieList.deleteSelectedMessage", { selectedCount: selectedCookies.size });
      const variant = sensitiveCount > 0 ? "danger" : "warning";

      showConfirm(title, message, variant, performBatchDelete, { triggerElement });
    },
    [cookies, selectedCookies, performBatchDelete, showConfirm, t]
  );

  const handleBatchWhitelist = useCallback(() => {
    if (!onAddToWhitelist) {
      onMessage?.(t("cookieList.functionUnavailable"), true);
      return;
    }
    const domains = getSelectedDomains(cookies, selectedCookies);
    const domainArray = Array.from(domains);
    const newDomains = filterRedundantDomains(domainArray, whitelist);
    if (newDomains.length > 0) {
      onAddToWhitelist(newDomains);
      onMessage?.(t("cookieList.addedDomainsToWhitelist", { count: newDomains.length }));
    } else if (domainArray.length > 0) {
      onMessage?.(t("cookieList.domainsAlreadyInWhitelist"));
    } else {
      onMessage?.(t("cookieList.selectDomainsFirst"), true);
    }
  }, [cookies, selectedCookies, whitelist, onAddToWhitelist, onMessage, t]);

  const handleBatchBlacklist = useCallback(() => {
    if (!onAddToBlacklist) {
      onMessage?.(t("cookieList.functionUnavailable"), true);
      return;
    }
    const domains = getSelectedDomains(cookies, selectedCookies);
    const domainArray = Array.from(domains);
    const newDomains = filterRedundantDomains(domainArray, blacklist);
    if (newDomains.length > 0) {
      onAddToBlacklist(newDomains);
      onMessage?.(t("cookieList.addedDomainsToBlacklist", { count: newDomains.length }));
    } else if (domainArray.length > 0) {
      onMessage?.(t("cookieList.domainsAlreadyInBlacklist"));
    } else {
      onMessage?.(t("cookieList.selectDomainsFirst"), true);
    }
  }, [cookies, selectedCookies, blacklist, onAddToBlacklist, onMessage, t]);

  return {
    handleDelete,
    handleBatchDelete,
    handleCreate,
    handleSave,
    handleBatchWhitelist,
    handleBatchBlacklist,
  };
}
