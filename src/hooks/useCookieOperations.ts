import { useCallback } from "react";
import type { Cookie } from "@/types";
import { ErrorCode } from "@/types";
import { BackgroundService } from "@/lib/background-service";
import { EDITABLE_COOKIE_FIELDS } from "@/lib/constants";
import { isSensitiveCookie } from "@/utils/cookie-risk";
import { getCookieKey } from "@/utils/format";
import { getSelectedDomains, filterRedundantDomains } from "@/components/cookie-list/utils";
import type { TranslationFunction } from "@/hooks/core/useTranslation";

interface UseCookieOperationsProps {
  cookies: Cookie[];
  selectedCookies: Set<string>;
  onUpdate?: () => void;
  onMessage?: (msg: string, isError?: boolean) => void;
  whitelist?: string[];
  blacklist?: string[];
  onAddToWhitelist?: (domains: string[]) => void;
  onAddToBlacklist?: (domains: string[]) => void;
  clearSelectedCookies: () => void;
  removeSelectedCookies: (keys: string[]) => void;
  showConfirm: (
    title: string,
    message: string,
    variant: "warning" | "danger",
    onConfirm: () => void,
    options?: { triggerElement?: HTMLElement | null }
  ) => void;
  t: TranslationFunction;
}

export function useCookieOperations({
  cookies,
  selectedCookies,
  onUpdate,
  onMessage,
  whitelist,
  blacklist,
  onAddToWhitelist,
  onAddToBlacklist,
  clearSelectedCookies,
  removeSelectedCookies,
  showConfirm,
  t,
}: UseCookieOperationsProps) {
  const getErrorMessage = useCallback(
    (errorCode?: ErrorCode, defaultMessage?: string): string => {
      switch (errorCode) {
        case ErrorCode.PERMISSION_DENIED:
          return t("cookieList.errorPermissionDenied");
        case ErrorCode.INVALID_URL:
          return t("cookieList.errorInvalidUrl");
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
        case ErrorCode.QUEUE_FULL:
          return t("cookieList.errorQueueFull");
        case ErrorCode.TASK_EXPIRED:
          return t("cookieList.errorTaskExpired");
        case ErrorCode.LOCK_RETRY_FAILED:
          return t("cookieList.errorLockRetryFailed");
        case ErrorCode.QUEUE_CLEARED:
          return t("cookieList.errorQueueCleared");
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
      const updates: Partial<Cookie> = {};
      for (const field of EDITABLE_COOKIE_FIELDS) {
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

  const deleteSingleCookie = useCallback(
    async (cookie: Cookie): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await BackgroundService.deleteCookie(cookie);
        if (response.success) {
          return { success: true };
        }
        return { success: false, error: getErrorMessage(response.error?.code) };
      } catch (e) {
        console.error("Failed to delete cookie:", e);
        return { success: false, error: getErrorMessage(undefined) };
      }
    },
    [getErrorMessage]
  );

  const buildBatchDeleteMessage = useCallback(
    (
      deleted: number,
      failed: number,
      lastError?: string
    ): { message: string; isError: boolean } => {
      if (deleted > 0) {
        let message = t("cookieList.deletedSelected", { count: deleted });
        if (failed > 0) {
          message += t("cookieList.partialDeleteFailed", {
            failed,
            reason: lastError || t("common.unknownError"),
          });
        }
        return { message, isError: failed > 0 };
      }
      return {
        message: t("cookieList.deleteFailedWithReason", {
          reason: lastError || t("common.unknownError"),
        }),
        isError: true,
      };
    },
    [t]
  );

  const processBatchDeletions = useCallback(async () => {
    let deleted = 0;
    let failed = 0;
    let lastError: string | undefined;
    const deletedKeys: string[] = [];

    for (const cookie of cookies) {
      const key = getCookieKey(cookie.name, cookie.domain, cookie.path, cookie.storeId);
      if (selectedCookies.has(key)) {
        const result = await deleteSingleCookie(cookie);
        if (result.success) {
          deleted++;
          deletedKeys.push(key);
        } else {
          failed++;
          lastError = result.error;
        }
      }
    }
    return { deleted, failed, lastError, deletedKeys };
  }, [cookies, selectedCookies, deleteSingleCookie]);

  const handleBatchResults = useCallback(
    (deleted: number, failed: number, lastError: string | undefined, deletedKeys: string[]) => {
      if (deleted === 0 && failed === 0) {
        return;
      }
      const { message, isError } = buildBatchDeleteMessage(deleted, failed, lastError);
      onMessage?.(message, isError);
      if (deleted > 0) {
        if (failed === 0) {
          clearSelectedCookies();
        } else {
          removeSelectedCookies(deletedKeys);
        }
        onUpdate?.();
      }
    },
    [buildBatchDeleteMessage, onMessage, clearSelectedCookies, removeSelectedCookies, onUpdate]
  );

  const performBatchDelete = useCallback(async () => {
    const { deleted, failed, lastError, deletedKeys } = await processBatchDeletions();
    handleBatchResults(deleted, failed, lastError, deletedKeys);
  }, [processBatchDeletions, handleBatchResults]);

  const handleBatchDelete = useCallback(
    (triggerElement?: HTMLElement | null) => {
      const sensitiveCount = cookies.filter(
        (c) =>
          selectedCookies.has(getCookieKey(c.name, c.domain, c.path, c.storeId)) &&
          isSensitiveCookie(c)
      ).length;

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

  const handleBatchListAction = useCallback(
    (
      listType: "whitelist" | "blacklist",
      list: string[] | undefined,
      onAdd: ((domains: string[]) => void) | undefined
    ) => {
      if (!onAdd) {
        onMessage?.(t("cookieList.functionUnavailable"), true);
        return;
      }
      const domains = getSelectedDomains(cookies, selectedCookies);
      const domainArray = Array.from(domains);
      const newDomains = filterRedundantDomains(domainArray, list);
      if (newDomains.length > 0) {
        onAdd(newDomains);
        onMessage?.(
          t(`cookieList.addedDomainsTo${listType === "whitelist" ? "Whitelist" : "Blacklist"}`, {
            count: newDomains.length,
          })
        );
      } else if (domainArray.length > 0) {
        onMessage?.(
          t(`cookieList.domainsAlreadyIn${listType === "whitelist" ? "Whitelist" : "Blacklist"}`)
        );
      } else {
        onMessage?.(t("cookieList.selectDomainsFirst"), true);
      }
    },
    [cookies, selectedCookies, onMessage, t]
  );

  const handleBatchWhitelist = useCallback(
    () => handleBatchListAction("whitelist", whitelist, onAddToWhitelist),
    [handleBatchListAction, whitelist, onAddToWhitelist]
  );

  const handleBatchBlacklist = useCallback(
    () => handleBatchListAction("blacklist", blacklist, onAddToBlacklist),
    [handleBatchListAction, blacklist, onAddToBlacklist]
  );

  return {
    handleDelete,
    handleBatchDelete,
    handleCreate,
    handleSave,
    handleBatchWhitelist,
    handleBatchBlacklist,
  };
}
