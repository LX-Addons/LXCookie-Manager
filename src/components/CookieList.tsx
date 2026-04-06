import { useState, memo } from "react";
import type { Cookie } from "@/types";
import { CookieEditor } from "./CookieEditor";
import { useConfirmDialogContext } from "@/contexts/ConfirmDialogContext";
import { useTranslation } from "@/hooks";
import { useCookieFilters } from "./cookie-list/useCookieFilters";
import { useCookieSelection } from "./cookie-list/useCookieSelection";
import { CookieListToolbar } from "./cookie-list/CookieListToolbar";
import { CookieBatchActions } from "./cookie-list/CookieBatchActions";
import { CookieDomainGroup } from "./cookie-list/CookieDomainGroup";
import { useCookieOperations } from "@/hooks/useCookieOperations";

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

    const {
      handleDelete,
      handleBatchDelete,
      handleCreate: _handleCreate,
      handleSave,
      handleBatchWhitelist,
      handleBatchBlacklist,
    } = useCookieOperations({
      cookies,
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
    });

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
                  onDeleteSelected={handleBatchDelete}
                  onAddToWhitelist={handleBatchWhitelist}
                  onAddToBlacklist={handleBatchBlacklist}
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
                        onDelete={handleDelete}
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
          onSave={(updatedCookie) => handleSave(editingCookie, updatedCookie)}
          triggerElement={editorTriggerElement}
        />
      </div>
    );
  }
);

CookieList.displayName = "CookieList";
