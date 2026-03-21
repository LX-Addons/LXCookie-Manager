import { useState, useEffect, memo, useMemo } from "react";
import type { Cookie } from "@/types";
import { COOKIE_VALUE_MASK } from "@/lib/constants";
import {
  assessCookieRisk,
  getRiskLevelText,
  clearSingleCookie,
  editCookie,
  createCookie,
  normalizeDomain,
  maskCookieValue,
  getCookieKey,
  toggleSetValue,
  isSensitiveCookie,
  formatCookieSameSite,
} from "@/utils";
import { CookieEditor } from "./CookieEditor";
import { ConfirmDialogWrapper, type ShowConfirmFn } from "./ConfirmDialogWrapper";
import { useTranslation } from "@/hooks/useTranslation";

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

interface CookieListContentProps extends Props {
  showConfirm: ShowConfirmFn;
}

type RiskFilter = "all" | "low" | "medium" | "high";
type TypeFilter = "all" | "session" | "persistent";
type DomainScopeFilter = "all" | "current" | "third-party";

export const CookieListContent = memo(
  ({
    cookies,
    currentDomain,
    onUpdate,
    onMessage,
    showConfirm,
    whitelist: _whitelist,
    blacklist: _blacklist,
    onAddToWhitelist,
    onAddToBlacklist,
    showCookieRisk,
  }: CookieListContentProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [visibleValues, setVisibleValues] = useState<Set<string>>(new Set());
    const [selectedCookies, setSelectedCookies] = useState<Set<string>>(new Set());
    const [showEditor, setShowEditor] = useState(false);
    const [editingCookie, setEditingCookie] = useState<Cookie | null>(null);
    const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
    const [expandedCookies, setExpandedCookies] = useState<Set<string>>(new Set());

    const [searchText, setSearchText] = useState("");
    const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
    const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
    const [domainScopeFilter, setDomainScopeFilter] = useState<DomainScopeFilter>("all");

    const { t } = useTranslation();

    const cookieRiskMap = useMemo(() => {
      const map = new Map<string, ReturnType<typeof assessCookieRisk>>();
      for (const cookie of cookies) {
        const key = getCookieKey(cookie.name, cookie.domain, cookie.path, cookie.storeId);
        map.set(key, assessCookieRisk(cookie, currentDomain, t));
      }
      return map;
    }, [cookies, currentDomain, t]);

    const filteredCookies = useMemo(() => {
      let result = [...cookies];

      if (searchText.trim()) {
        const search = searchText.toLowerCase().trim();
        result = result.filter(
          (cookie) =>
            cookie.name.toLowerCase().includes(search) ||
            cookie.domain.toLowerCase().includes(search) ||
            cookie.value.toLowerCase().includes(search)
        );
      }

      if (riskFilter !== "all") {
        result = result.filter((cookie) => {
          const key = getCookieKey(cookie.name, cookie.domain, cookie.path, cookie.storeId);
          const risk = cookieRiskMap.get(key);
          return risk?.level === riskFilter;
        });
      }

      if (typeFilter !== "all") {
        result = result.filter((cookie) => {
          if (typeFilter === "session") return !cookie.expirationDate;
          return !!cookie.expirationDate;
        });
      }

      if (domainScopeFilter !== "all" && currentDomain) {
        result = result.filter((cookie) => {
          const normalizedCookieDomain = normalizeDomain(cookie.domain);
          const normalizedCurrentDomain = normalizeDomain(currentDomain);
          const isCurrentDomain =
            normalizedCookieDomain === normalizedCurrentDomain ||
            normalizedCookieDomain.endsWith("." + normalizedCurrentDomain);
          if (domainScopeFilter === "current") return isCurrentDomain;
          return !isCurrentDomain;
        });
      }

      return result;
    }, [
      cookies,
      searchText,
      riskFilter,
      typeFilter,
      domainScopeFilter,
      currentDomain,
      cookieRiskMap,
    ]);

    const selectAll = useMemo(() => {
      if (filteredCookies.length === 0) return false;
      return filteredCookies.every((cookie) =>
        selectedCookies.has(getCookieKey(cookie.name, cookie.domain, cookie.path, cookie.storeId))
      );
    }, [filteredCookies, selectedCookies]);

    useEffect(() => {
      const validKeys = new Set(
        cookies.map((cookie) =>
          getCookieKey(cookie.name, cookie.domain, cookie.path, cookie.storeId)
        )
      );
      setSelectedCookies((prev) => new Set([...prev].filter((key) => validKeys.has(key))));
      setExpandedCookies((prev) => new Set([...prev].filter((key) => validKeys.has(key))));
      setVisibleValues((prev) => new Set([...prev].filter((key) => validKeys.has(key))));
    }, [cookies]);

    const filteredGroupedCookies = useMemo(() => {
      const grouped = new Map<string, Cookie[]>();
      for (const cookie of filteredCookies) {
        const domain = normalizeDomain(cookie.domain);
        if (!grouped.has(domain)) {
          grouped.set(domain, []);
        }
        const domainCookies = grouped.get(domain);
        if (domainCookies) {
          domainCookies.push(cookie);
        }
      }
      return grouped;
    }, [filteredCookies]);

    const toggleValueVisibility = (key: string) => {
      setVisibleValues((prev) => toggleSetValue(prev, key));
    };

    const toggleCookieSelection = (key: string) => {
      setSelectedCookies((prev) => toggleSetValue(prev, key));
    };

    const toggleDomainExpansion = (domain: string) => {
      setExpandedDomains((prev) => toggleSetValue(prev, domain));
    };

    const toggleCookieExpansion = (key: string) => {
      setExpandedCookies((prev) => toggleSetValue(prev, key));
    };

    const toggleSelectAll = () => {
      if (selectAll) {
        setSelectedCookies(new Set());
      } else {
        const allKeys = new Set<string>();
        for (const cookie of filteredCookies) {
          allKeys.add(getCookieKey(cookie.name, cookie.domain, cookie.path, cookie.storeId));
        }
        setSelectedCookies(allKeys);
      }
    };

    const performDeleteCookie = async (cookie: Cookie) => {
      try {
        const cleanedDomain = cookie.domain.replace(/^\./, "");
        const success = await clearSingleCookie(
          cookie as unknown as chrome.cookies.Cookie,
          cleanedDomain
        );
        if (success) {
          onMessage?.(t("cookieList.deletedCookie", { name: cookie.name }));
          onUpdate?.();
        } else {
          onMessage?.(t("cookieList.deleteCookieFailed"), true);
        }
      } catch (e) {
        console.error("Failed to delete cookie:", e);
        onMessage?.(t("cookieList.deleteCookieFailed"), true);
      }
    };

    const handleDeleteCookie = (cookie: Cookie) => {
      const sensitive = isSensitiveCookie(cookie);
      const title = sensitive
        ? t("cookieList.deleteSensitiveCookie")
        : t("cookieList.deleteConfirm");
      const message = sensitive
        ? t("cookieList.deleteSensitiveMessage", { name: cookie.name })
        : t("cookieList.deleteMessage", { name: cookie.name });
      const variant = sensitive ? "danger" : "warning";

      showConfirm(title, message, variant, () => performDeleteCookie(cookie));
    };

    const handleEditCookie = (cookie: Cookie) => {
      setEditingCookie(cookie);
      setShowEditor(true);
    };

    const handleCreateCookie = () => {
      setEditingCookie(null);
      setShowEditor(true);
    };

    const handleSaveCookie = async (updatedCookie: Cookie): Promise<boolean> => {
      try {
        let success = false;
        if (editingCookie) {
          success = await editCookie(
            editingCookie as unknown as chrome.cookies.Cookie,
            updatedCookie as Partial<chrome.cookies.Cookie>
          );
          if (success) {
            onMessage?.(t("cookieList.cookieUpdated"));
            onUpdate?.();
          } else {
            onMessage?.(t("cookieList.updateCookieFailed"), true);
          }
        } else {
          success = await createCookie(updatedCookie as Partial<chrome.cookies.Cookie>);
          if (success) {
            onMessage?.(t("cookieEditor.createSuccess"));
            onUpdate?.();
          } else {
            onMessage?.(t("cookieEditor.createFailed"), true);
          }
        }
        return success;
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
      for (const cookie of cookies) {
        const key = getCookieKey(cookie.name, cookie.domain, cookie.path, cookie.storeId);
        if (selectedCookies.has(key)) {
          try {
            const cleanedDomain = cookie.domain.replace(/^\./, "");
            const success = await clearSingleCookie(
              cookie as unknown as chrome.cookies.Cookie,
              cleanedDomain
            );
            if (success) deleted++;
          } catch (e) {
            console.error("Failed to delete cookie:", e);
          }
        }
      }
      if (deleted > 0) {
        onMessage?.(t("cookieList.deletedSelected", { count: deleted }));
        setSelectedCookies(new Set());
        onUpdate?.();
      }
    };

    const handleDeleteSelected = () => {
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

      showConfirm(title, message, variant, performDeleteSelected);
    };

    const getSelectedDomains = (): Set<string> => {
      const domains = new Set<string>();
      for (const cookie of cookies) {
        const key = getCookieKey(cookie.name, cookie.domain, cookie.path, cookie.storeId);
        if (selectedCookies.has(key)) {
          domains.add(normalizeDomain(cookie.domain));
        }
      }
      return domains;
    };

    const filterRedundantDomains = (domains: string[], existingList?: string[]): string[] => {
      const normalizedDomains = domains.map((d) => normalizeDomain(d));
      const existingNormalized = existingList?.map((d) => normalizeDomain(d)) || [];

      const result: string[] = [];
      for (const domain of normalizedDomains) {
        const isCoveredByExisting = existingNormalized.some((existing) => {
          return domain === existing || domain.endsWith("." + existing);
        });
        if (isCoveredByExisting) {
          continue;
        }

        const isSubdomainOfAnotherNew = result.some((added) => {
          return domain === added || domain.endsWith("." + added);
        });
        if (isSubdomainOfAnotherNew) {
          continue;
        }

        const isParentOfAnotherNew = normalizedDomains.some((other) => {
          return other !== domain && (other === domain || other.endsWith("." + domain));
        });
        if (isParentOfAnotherNew) {
          const alreadyHasParent = result.some((added) => {
            return added === domain || added.endsWith("." + domain);
          });
          if (!alreadyHasParent) {
            result.push(domain);
          }
        } else {
          result.push(domain);
        }
      }

      return result;
    };

    const handleAddToWhitelist = () => {
      if (!onAddToWhitelist) {
        onMessage?.(t("cookieList.functionUnavailable"), true);
        return;
      }
      const domains = getSelectedDomains();
      const domainArray = Array.from(domains);
      const newDomains = filterRedundantDomains(domainArray, _whitelist);
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
      const domains = getSelectedDomains();
      const domainArray = Array.from(domains);
      const newDomains = filterRedundantDomains(domainArray, _blacklist);
      if (newDomains.length > 0) {
        onAddToBlacklist(newDomains);
        onMessage?.(t("cookieList.addedDomainsToBlacklist", { count: newDomains.length }));
      } else if (domainArray.length > 0) {
        onMessage?.(t("cookieList.domainsAlreadyInBlacklist"), true);
      } else {
        onMessage?.(t("cookieList.selectDomainsFirst"), true);
      }
    };

    const clearFilters = () => {
      setSearchText("");
      setRiskFilter("all");
      setTypeFilter("all");
      setDomainScopeFilter("all");
    };

    const hasActiveFilters =
      searchText.trim() !== "" ||
      riskFilter !== "all" ||
      typeFilter !== "all" ||
      domainScopeFilter !== "all";

    return (
      <div className="cookie-list-container">
        {cookies.length === 0 ? (
          <div className="cookie-list-empty">
            <p>{t("cookieList.noCookies")}</p>
            <button type="button" onClick={handleCreateCookie} className="btn btn-primary">
              {t("cookieEditor.createCookie")}
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="cookie-list-header"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-expanded={isExpanded}
            >
              <h3 className="cookie-heading">
                {t("cookieList.cookieDetails", { count: cookies.length })}
              </h3>
              <span className={`expand-icon ${isExpanded ? "expanded" : ""}`} aria-hidden="true">
                ▼
              </span>
            </button>

            {isExpanded && (
              <>
                <div className="cookie-filter-bar" data-testid="cookie-toolbar">
                  <div className="filter-search">
                    <input
                      type="text"
                      placeholder={t("cookieList.searchPlaceholder")}
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="filter-input"
                      data-testid="cookie-search"
                      aria-label={t("cookieList.searchPlaceholder")}
                    />
                  </div>
                  <div className="filter-row">
                    <select
                      value={riskFilter}
                      onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
                      className="filter-select"
                      aria-label={t("cookieList.filterRiskAll")}
                    >
                      <option value="all">{t("cookieList.filterRiskAll")}</option>
                      <option value="low">{t("cookieList.filterRiskLow")}</option>
                      <option value="medium">{t("cookieList.filterRiskMedium")}</option>
                      <option value="high">{t("cookieList.filterRiskHigh")}</option>
                    </select>
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                      className="filter-select"
                      aria-label={t("cookieList.filterTypeAll")}
                    >
                      <option value="all">{t("cookieList.filterTypeAll")}</option>
                      <option value="session">{t("cookieList.filterTypeSession")}</option>
                      <option value="persistent">{t("cookieList.filterTypePersistent")}</option>
                    </select>
                    <select
                      value={domainScopeFilter}
                      onChange={(e) => setDomainScopeFilter(e.target.value as DomainScopeFilter)}
                      className="filter-select"
                      aria-label={t("cookieList.filterDomainAll")}
                    >
                      <option value="all">{t("cookieList.filterDomainAll")}</option>
                      <option value="current">{t("cookieList.filterDomainCurrent")}</option>
                      <option value="third-party">{t("cookieList.filterDomainThirdParty")}</option>
                    </select>
                  </div>
                  {hasActiveFilters && (
                    <div className="filter-status">
                      <span className="filter-count">
                        {t("cookieList.filterResult", {
                          count: filteredCookies.length,
                          total: cookies.length,
                        })}
                      </span>
                      <button type="button" onClick={clearFilters} className="btn btn-ghost btn-sm">
                        {t("cookieList.clearFilters")}
                      </button>
                    </div>
                  )}
                </div>

                <div className="batch-actions">
                  {selectedCookies.size > 0 && (
                    <>
                      <span className="batch-count">
                        {t("cookieList.selected", { count: selectedCookies.size })}
                      </span>
                      <div className="batch-buttons">
                        <button onClick={handleDeleteSelected} className="btn btn-danger btn-sm">
                          {t("cookieList.deleteSelected")}
                        </button>
                        <button onClick={handleAddToWhitelist} className="btn btn-success btn-sm">
                          {t("cookieList.addToWhitelist")}
                        </button>
                        <button onClick={handleAddToBlacklist} className="btn btn-secondary btn-sm">
                          {t("cookieList.addToBlacklist")}
                        </button>
                      </div>
                    </>
                  )}
                  {selectedCookies.size === 0 && (
                    <div className="batch-buttons ml-auto">
                      <button
                        type="button"
                        onClick={handleCreateCookie}
                        className="btn btn-primary btn-sm"
                      >
                        {t("cookieEditor.createCookie")}
                      </button>
                    </div>
                  )}
                </div>

                <div className="select-all-row">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} />
                    <span>{t("cookieList.selectAll")}</span>
                  </label>
                </div>

                <div className="cookie-list">
                  {filteredCookies.length === 0 && hasActiveFilters ? (
                    <div className="cookie-list-empty-filtered">
                      <p>{t("cookieList.noMatchingCookies")}</p>
                      <button type="button" onClick={clearFilters} className="btn btn-secondary">
                        {t("cookieList.clearFilters")}
                      </button>
                    </div>
                  ) : (
                    Array.from(filteredGroupedCookies.entries()).map(([domain, domainCookies]) => {
                      const isCurrentDomain =
                        currentDomain &&
                        (domain === normalizeDomain(currentDomain) ||
                          domain.endsWith("." + normalizeDomain(currentDomain)));
                      const isThirdParty = currentDomain && !isCurrentDomain;

                      return (
                        <div
                          key={domain}
                          className="cookie-domain-group"
                          data-testid={`cookie-domain-group-${domain}`}
                        >
                          <button
                            type="button"
                            className="domain-group-header"
                            onClick={() => toggleDomainExpansion(domain)}
                            aria-expanded={expandedDomains.has(domain)}
                          >
                            <div className="domain-header-info">
                              <span className="domain-name">{domain}</span>
                              <div className="domain-tags">
                                <span className="domain-count-tag">
                                  {domainCookies.length} {t("cookieList.cookies")}
                                </span>
                                {isCurrentDomain && (
                                  <span className="domain-tag tag-current">
                                    {t("cookieList.currentSite")}
                                  </span>
                                )}
                                {isThirdParty && (
                                  <span className="domain-tag tag-third-party">
                                    {t("cookieList.thirdParty")}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span
                              className={`expand-icon ${expandedDomains.has(domain) ? "expanded" : ""}`}
                            >
                              ▼
                            </span>
                          </button>

                          {expandedDomains.has(domain) && (
                            <div className="domain-cookies">
                              {domainCookies.map((cookie) => {
                                const key = getCookieKey(
                                  cookie.name,
                                  cookie.domain,
                                  cookie.path,
                                  cookie.storeId
                                );
                                const isVisible = visibleValues.has(key);
                                const isCookieExpanded = expandedCookies.has(key);
                                const displayValue = isVisible
                                  ? cookie.value
                                  : maskCookieValue(cookie.value, COOKIE_VALUE_MASK);
                                const risk =
                                  (showCookieRisk ?? true) ? cookieRiskMap.get(key) : null;
                                const isSelected = selectedCookies.has(key);
                                const sensitive = isSensitiveCookie(cookie);

                                return (
                                  <div
                                    key={key}
                                    className={`cookie-card ${isSelected ? "selected" : ""}`}
                                    data-testid={`cookie-row-${key}`}
                                  >
                                    <div className="cookie-summary-row">
                                      <label className="checkbox-label cookie-checkbox">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => toggleCookieSelection(key)}
                                          aria-label={t("cookieList.selectCookie", {
                                            name: cookie.name,
                                          })}
                                        />
                                      </label>
                                      <div className="cookie-summary-info">
                                        <span className="cookie-name-text">{cookie.name}</span>
                                        <div className="cookie-tags">
                                          {sensitive && (
                                            <span
                                              className="cookie-tag tag-sensitive"
                                              title={t("cookieList.sensitiveCookie")}
                                            >
                                              {t("cookieList.sensitive")}
                                            </span>
                                          )}
                                          {risk && (
                                            <span className={`cookie-tag tag-risk-${risk.level}`}>
                                              {getRiskLevelText(risk.level, t)}
                                            </span>
                                          )}
                                          {!cookie.expirationDate && (
                                            <span className="cookie-tag tag-session">
                                              {t("cookieList.sessionCookie")}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="cookie-actions">
                                        <button
                                          type="button"
                                          className="action-btn"
                                          onClick={() => toggleCookieExpansion(key)}
                                          aria-label={
                                            isCookieExpanded
                                              ? t("cookieList.collapse")
                                              : t("cookieList.expand")
                                          }
                                        >
                                          {isCookieExpanded ? "▲" : "▼"}
                                        </button>
                                        <button
                                          type="button"
                                          className="action-btn"
                                          onClick={() => handleEditCookie(cookie)}
                                          aria-label={t("cookieList.edit")}
                                        >
                                          ✏️
                                        </button>
                                        <button
                                          type="button"
                                          className="action-btn action-btn-danger"
                                          onClick={() => handleDeleteCookie(cookie)}
                                          aria-label={t("common.delete")}
                                        >
                                          🗑️
                                        </button>
                                      </div>
                                    </div>

                                    {isCookieExpanded && (
                                      <div className="cookie-details-expanded">
                                        <div className="cookie-detail-row">
                                          <span className="detail-label">
                                            {t("cookieList.value")}
                                          </span>
                                          <span className="detail-value">
                                            {displayValue}
                                            <button
                                              type="button"
                                              className="value-toggle-btn"
                                              onClick={() => toggleValueVisibility(key)}
                                              aria-label={
                                                isVisible
                                                  ? t("cookieList.hide")
                                                  : t("cookieList.show")
                                              }
                                            >
                                              {isVisible ? "👁" : "👁‍🗨"}
                                            </button>
                                          </span>
                                        </div>
                                        <div className="cookie-detail-row">
                                          <span className="detail-label">
                                            {t("cookieList.domain")}
                                          </span>
                                          <span className="detail-value">{cookie.domain}</span>
                                        </div>
                                        <div className="cookie-detail-row">
                                          <span className="detail-label">
                                            {t("cookieList.path")}
                                          </span>
                                          <span className="detail-value">{cookie.path}</span>
                                        </div>
                                        <div className="cookie-detail-row">
                                          <span className="detail-label">
                                            {t("cookieList.secure")}
                                          </span>
                                          <span className="detail-value">
                                            {cookie.secure ? t("common.yes") : t("common.no")}
                                          </span>
                                        </div>
                                        <div className="cookie-detail-row">
                                          <span className="detail-label">
                                            {t("cookieList.httpOnly")}
                                          </span>
                                          <span className="detail-value">
                                            {cookie.httpOnly ? t("common.yes") : t("common.no")}
                                          </span>
                                        </div>
                                        <div className="cookie-detail-row">
                                          <span className="detail-label">
                                            {t("cookieList.sameSite")}
                                          </span>
                                          <span className="detail-value">
                                            {formatCookieSameSite(cookie.sameSite, t)}
                                          </span>
                                        </div>
                                        {cookie.expirationDate && (
                                          <div className="cookie-detail-row">
                                            <span className="detail-label">
                                              {t("cookieList.expirationTime")}
                                            </span>
                                            <span className="detail-value">
                                              {new Date(
                                                cookie.expirationDate * 1000
                                              ).toLocaleString()}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
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
        />
      </div>
    );
  }
);

CookieListContent.displayName = "CookieListContent";

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
    return (
      <ConfirmDialogWrapper>
        {(showConfirm) => (
          <CookieListContent
            cookies={cookies}
            currentDomain={currentDomain}
            onUpdate={onUpdate}
            onMessage={onMessage}
            whitelist={whitelist}
            blacklist={blacklist}
            onAddToWhitelist={onAddToWhitelist}
            onAddToBlacklist={onAddToBlacklist}
            showConfirm={showConfirm}
            showCookieRisk={showCookieRisk}
          />
        )}
      </ConfirmDialogWrapper>
    );
  }
);

CookieList.displayName = "CookieList";
