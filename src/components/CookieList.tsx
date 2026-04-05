import { useState, memo } from "react";
import type { Cookie } from "@/types";
import { ErrorCode } from "@/types";
import { BackgroundService } from "@/lib/background-service";
import { isSensitiveCookie } from "@/utils/cookie-risk";
import { getCookieKey } from "@/utils/format";
import { CookieEditor } from "./CookieEditor";
import { useConfirmDialogContext } from "@/contexts/ConfirmDialogContext";
import { useTranslation } from "@/hooks";
import { useCookieFilters } from "./cookie-list/useCookieFilters";
import { useCookieSelection } from "./cookie-list/useCookieSelection";
import { CookieListToolbar } from "./cookie-list/CookieListToolbar";
import { CookieBatchActions } from "./cookie-list/CookieBatchActions";
import { CookieDomainGroup } from "./cookie-list/CookieDomainGroup";
import { getSelectedDomains, filterRedundantDomains } from "./cookie-list/utils";

interface Props {
  cookies: Cookie[];
  currentDomain?: string;
  onUpdate?: () => void;
  onMessage?: (msg: string, isError?: boolean) => void;
  whitelist?: string[];
  blacklist?: string[];
  onAddToWhitelist?: (domains: string[]) => void;
  onAddToBlacklist?: (domains: string[]) => void;
  showCookieRisk?: boolean;
}

export const CookieList = memo(
  ({
    cookies,
    currentDomain,
    onUpdate,
    onMessage,
    whitelist,
    blacklist,
    onAddToWhitelist,
    onAddToBlacklist,
    showCookieRisk,
  }: Props) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [editingCookie, setEditingCookie] = useState<Cookie | null>(null);
    const [editorTriggerElement, setEditorTriggerElement] = useState<HTMLElement | null>(null);

    const { t } = useTranslation();
    const showConfirm = useConfirmDialogContext();
    const riskEnabled = showCookieRisk ?? true;

    const {
      searchText,
      setSearchText,
      riskFilter,
      setRiskFilter,
      typeFilter,
      setTypeFilter,
      domainScopeFilter,
      setDomainScopeFilter,
      cookieRiskMap,
      filteredCookies,
      filteredGroupedCookies,
      hasActiveFilters,
      clearFilters,
    } = useCookieFilters({ cookies, currentDomain, riskEnabled, t });

    const {
      selectedCookies,
      visibleValues,
      expandedDomains,
      expandedCookies,
      selectAll,
      toggleSelectAll,
      clearSelectedCookies,
      toggleCookieSelection,
      toggleValueVisibility,
      toggleDomainExpansion,
      toggleCookieExpansion,
    } = useCookieSelection({ cookies, filteredCookies, currentDomain });

    const getErrorMessage = (errorCode?: ErrorCode, defaultMessage?: string): string => {
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
    };

    const performDeleteCookie = async (cookie: Cookie) => {
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
    };

    const handleDeleteCookie = (cookie: Cookie, triggerElement?: HTMLElement | null) => {
      const sensitive = isSensitiveCookie(cookie);
      const title = sensitive
        ? t("cookieList.deleteSensitiveCookie")
        : t("cookieList.deleteConfirm");
      const message = sensitive
        ? t("cookieList.deleteSensitiveMessage", { name: cookie.name })
        : t("cookieList.deleteMessage", { name: cookie.name });
      const variant = sensitive ? "danger" : "warning";

      showConfirm(title, message, variant, () => performDeleteCookie(cookie), { triggerElement });
    };

    const handleEditCookie = (cookie: Cookie, triggerElement?: HTMLElement | null) => {
      setEditorTriggerElement(triggerElement || null);
      setEditingCookie(cookie);
      setShowEditor(true);
    };

    const handleCreateCookie = (triggerElement?: HTMLElement | null) => {
      setEditorTriggerElement(triggerElement || null);
      setEditingCookie(null);
      setShowEditor(true);
    };

    const updateCookie = async (updatedCookie: Cookie): Promise<boolean> => {
      if (!editingCookie) return false;
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
      const response = await BackgroundService.updateCookie(editingCookie, updates);
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
    };

    const createCookie = async (updatedCookie: Cookie): Promise<boolean> => {
      const response = await BackgroundService.createCookie(updatedCookie);
      if (response.success) {
        onMessage?.(t("cookieEditor.createSuccess"));
        onUpdate?.();
        return true;
      }
      const errorMessage = getErrorMessage(response.error?.code, t("cookieEditor.createFailed"));
      onMessage?.(errorMessage, true);
      return false;
    };

    const handleSaveCookie = async (updatedCookie: Cookie): Promise<boolean> => {
      try {
        if (editingCookie) {
          return await updateCookie(updatedCookie);
        }
        return await createCookie(updatedCookie);
      } catch (e) {
        console.error("Failed to save cookie:", e);
        onMessage?.(
          editingCookie ? t("cookieList.updateCookieFailed") : t("cookieEditor.createFailed"),
          true
        );
        return false;
      }
    };

    const performDeleteSelected = async () => {
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
    };

    const handleDeleteSelected = (triggerElement?: HTMLElement | null) => {
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

      showConfirm(title, message, variant, performDeleteSelected, { triggerElement });
    };

    const handleAddToWhitelist = () => {
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
        onMessage?.(t("cookieList.domainsAlreadyInWhitelist"), true);
      } else {
        onMessage?.(t("cookieList.selectDomainsFirst"), true);
      }
    };

    const handleAddToBlacklist = () => {
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
        onMessage?.(t("cookieList.domainsAlreadyInBlacklist"), true);
      } else {
        onMessage?.(t("cookieList.selectDomainsFirst"), true);
      }
    };

    return (
      <div className="cookie-list-container">
        {cookies.length === 0 ? (
          <div className="cookie-list-empty">
            <p>{t("cookieList.noCookies")}</p>
            <button
              type="button"
              onClick={(e) => handleCreateCookie(e.currentTarget)}
              className="btn btn-primary"
            >
              {t("cookieEditor.createCookie")}
            </button>
          </div>
        ) : (
          <>
            <CookieListToolbar
              cookieCount={cookies.length}
              isExpanded={isExpanded}
              onToggleExpand={() => setIsExpanded(!isExpanded)}
              searchText={searchText}
              onSearchChange={setSearchText}
              riskFilter={riskFilter}
              onRiskFilterChange={setRiskFilter}
              typeFilter={typeFilter}
              onTypeFilterChange={setTypeFilter}
              domainScopeFilter={domainScopeFilter}
              onDomainScopeFilterChange={setDomainScopeFilter}
              riskEnabled={riskEnabled}
              currentDomain={currentDomain}
              hasActiveFilters={hasActiveFilters}
              filteredCount={filteredCookies.length}
              totalCount={cookies.length}
              onClearFilters={clearFilters}
              t={t}
            />

            {isExpanded && (
              <>
                <CookieBatchActions
                  selectedCount={selectedCookies.size}
                  selectAll={selectAll}
                  onDeleteSelected={handleDeleteSelected}
                  onAddToWhitelist={handleAddToWhitelist}
                  onAddToBlacklist={handleAddToBlacklist}
                  onCreateCookie={handleCreateCookie}
                  onSelectAll={toggleSelectAll}
                  t={t}
                />

                <div className="cookie-list">
                  {filteredCookies.length === 0 && hasActiveFilters ? (
                    <div className="cookie-list-empty-filtered">
                      <p>{t("cookieList.noMatchingCookies")}</p>
                      <button type="button" onClick={clearFilters} className="btn btn-secondary">
                        {t("cookieList.clearFilters")}
                      </button>
                    </div>
                  ) : (
                    Array.from(filteredGroupedCookies.entries()).map(([domain, domainCookies]) => (
                      <CookieDomainGroup
                        key={domain}
                        domain={domain}
                        domainCookies={domainCookies}
                        currentDomain={currentDomain}
                        isExpanded={expandedDomains.has(domain)}
                        riskEnabled={riskEnabled}
                        cookieRiskMap={cookieRiskMap}
                        selectedCookies={selectedCookies}
                        visibleValues={visibleValues}
                        expandedCookies={expandedCookies}
                        onToggleDomainExpansion={toggleDomainExpansion}
                        onToggleSelection={toggleCookieSelection}
                        onToggleValueVisibility={toggleValueVisibility}
                        onToggleCookieExpansion={toggleCookieExpansion}
                        onEdit={handleEditCookie}
                        onDelete={handleDeleteCookie}
                        t={t}
                      />
                    ))
                  )}
                </div>
              </>
            )}
          </>
        )}

        <CookieEditor
          isOpen={showEditor}
          cookie={editingCookie}
          currentDomain={currentDomain}
          onClose={() => setShowEditor(false)}
          onSave={handleSaveCookie}
          triggerElement={editorTriggerElement}
        />
      </div>
    );
  }
);

CookieList.displayName = "CookieList";
