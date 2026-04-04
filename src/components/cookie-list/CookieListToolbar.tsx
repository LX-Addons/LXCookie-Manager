import { memo } from "react";
import { Icon } from "@/components/Icon";
import type { TranslationFunction } from "@/hooks";

type RiskFilter = "all" | "low" | "medium" | "high" | "critical";
type TypeFilter = "all" | "session" | "persistent";
type DomainScopeFilter = "all" | "current" | "third-party";

interface CookieListToolbarProps {
  cookieCount: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  searchText: string;
  onSearchChange: (value: string) => void;
  riskFilter: RiskFilter;
  onRiskFilterChange: (value: RiskFilter) => void;
  typeFilter: TypeFilter;
  onTypeFilterChange: (value: TypeFilter) => void;
  domainScopeFilter: DomainScopeFilter;
  onDomainScopeFilterChange: (value: DomainScopeFilter) => void;
  riskEnabled: boolean;
  currentDomain?: string;
  hasActiveFilters: boolean;
  filteredCount: number;
  totalCount: number;
  onClearFilters: () => void;
  t: TranslationFunction;
}

export const CookieListToolbar = memo(function CookieListToolbar({
  cookieCount,
  isExpanded,
  onToggleExpand,
  searchText,
  onSearchChange,
  riskFilter,
  onRiskFilterChange,
  typeFilter,
  onTypeFilterChange,
  domainScopeFilter,
  onDomainScopeFilterChange,
  riskEnabled,
  currentDomain,
  hasActiveFilters,
  filteredCount,
  totalCount,
  onClearFilters,
  t,
}: CookieListToolbarProps) {
  return (
    <>
      <button
        type="button"
        className="cookie-list-header"
        onClick={onToggleExpand}
        aria-expanded={isExpanded}
      >
        <h3 className="cookie-heading">{t("cookieList.cookieDetails", { count: cookieCount })}</h3>
        <span className={`expand-icon ${isExpanded ? "expanded" : ""}`} aria-hidden="true">
          <Icon name="chevronDown" size={16} />
        </span>
      </button>

      {isExpanded && (
        <div className="cookie-filter-bar" data-testid="cookie-toolbar">
          <div className="filter-search">
            <input
              type="text"
              placeholder={t("cookieList.searchPlaceholder")}
              value={searchText}
              onChange={(e) => onSearchChange(e.target.value)}
              className="filter-input"
              data-testid="cookie-search"
              aria-label={t("cookieList.searchPlaceholder")}
            />
          </div>
          <div className="filter-row">
            {riskEnabled && (
              <select
                value={riskFilter}
                onChange={(e) => onRiskFilterChange(e.target.value as RiskFilter)}
                className="filter-select"
                aria-label={t("cookieList.filterRiskAll")}
              >
                <option value="all">{t("cookieList.filterRiskAll")}</option>
                <option value="critical">{t("cookieList.filterRiskCritical")}</option>
                <option value="high">{t("cookieList.filterRiskHigh")}</option>
                <option value="medium">{t("cookieList.filterRiskMedium")}</option>
                <option value="low">{t("cookieList.filterRiskLow")}</option>
              </select>
            )}
            <select
              value={typeFilter}
              onChange={(e) => onTypeFilterChange(e.target.value as TypeFilter)}
              className="filter-select"
              aria-label={t("cookieList.filterTypeAll")}
            >
              <option value="all">{t("cookieList.filterTypeAll")}</option>
              <option value="session">{t("cookieList.filterTypeSession")}</option>
              <option value="persistent">{t("cookieList.filterTypePersistent")}</option>
            </select>
            <select
              value={domainScopeFilter}
              onChange={(e) => onDomainScopeFilterChange(e.target.value as DomainScopeFilter)}
              className="filter-select"
              disabled={currentDomain === undefined || currentDomain === ""}
              title={!currentDomain ? t("cookieList.filterDomainDisabled") : undefined}
              aria-label={t("cookieList.filterDomainAll")}
              aria-describedby={!currentDomain ? "domain-filter-disabled-hint" : undefined}
            >
              <option value="all">{t("cookieList.filterDomainAll")}</option>
              <option value="current">{t("cookieList.filterDomainCurrent")}</option>
              <option value="third-party">{t("cookieList.filterDomainThirdParty")}</option>
            </select>
            {!currentDomain && (
              <span id="domain-filter-disabled-hint" className="sr-only">
                {t("cookieList.filterDomainDisabled")}
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <div className="filter-status">
              <span className="filter-count">
                {t("cookieList.filterResult", {
                  count: filteredCount,
                  total: totalCount,
                })}
              </span>
              <button type="button" onClick={onClearFilters} className="btn btn-ghost btn-sm">
                {t("cookieList.clearFilters")}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
});
