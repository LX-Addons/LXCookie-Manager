import { useState, memo, useMemo } from "react";
import type { Cookie } from "@/types";
import { COOKIE_VALUE_MASK } from "@/lib/constants";
import {
  assessCookieRisk,
  getRiskLevelColor,
  getRiskLevelText,
  clearSingleCookie,
  editCookie,
  normalizeDomain,
  maskCookieValue,
  getCookieKey,
  toggleSetValue,
  isSensitiveCookie,
  isInList,
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
}

interface CookieListContentProps extends Props {
  showConfirm: ShowConfirmFn;
}

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
  }: CookieListContentProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [visibleValues, setVisibleValues] = useState<Set<string>>(new Set());
    const [selectedCookies, setSelectedCookies] = useState<Set<string>>(new Set());
    const [showEditor, setShowEditor] = useState(false);
    const [editingCookie, setEditingCookie] = useState<Cookie | null>(null);
    const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
    const [selectAll, setSelectAll] = useState(false);
    const { t } = useTranslation();

    const groupedCookies = useMemo(() => {
      const grouped = new Map<string, Cookie[]>();
      for (const cookie of cookies) {
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
    }, [cookies]);

    const toggleValueVisibility = (key: string) => {
      setVisibleValues((prev) => toggleSetValue(prev, key));
    };

    const toggleCookieSelection = (key: string) => {
      setSelectedCookies((prev) => toggleSetValue(prev, key));
    };

    const toggleDomainExpansion = (domain: string) => {
      setExpandedDomains((prev) => toggleSetValue(prev, domain));
    };

    const toggleSelectAll = () => {
      if (selectAll) {
        setSelectedCookies(new Set());
      } else {
        const allKeys = new Set<string>();
        for (const cookie of cookies) {
          allKeys.add(getCookieKey(cookie.name, cookie.domain));
        }
        setSelectedCookies(allKeys);
      }
      setSelectAll(!selectAll);
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

    const handleSaveCookie = async (updatedCookie: Cookie) => {
      try {
        if (editingCookie) {
          const success = await editCookie(
            editingCookie as unknown as chrome.cookies.Cookie,
            updatedCookie as Partial<chrome.cookies.Cookie>
          );
          if (success) {
            onMessage?.(t("cookieList.cookieUpdated"));
            onUpdate?.();
          } else {
            onMessage?.(t("cookieList.updateCookieFailed"), true);
          }
        }
      } catch (e) {
        console.error("Failed to save cookie:", e);
        onMessage?.(t("cookieList.updateCookieFailed"), true);
      }
    };

    const performDeleteSelected = async () => {
      let deleted = 0;
      for (const cookie of cookies) {
        const key = getCookieKey(cookie.name, cookie.domain);
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
        setSelectAll(false);
        onUpdate?.();
      }
    };

    const handleDeleteSelected = () => {
      const sensitiveCount = cookies
        .filter((c) => selectedCookies.has(getCookieKey(c.name, c.domain)))
        .filter((c) => isSensitiveCookie(c)).length;

      const title =
        sensitiveCount > 0
          ? t("cookieList.deleteSelectedSensitive")
          : t("cookieList.deleteSelectedConfirm");
      const message =
        sensitiveCount > 0
          ? t("cookieList.deleteSelectedSensitiveMessage", {
              sensitiveCount,
              count: selectedCookies.size,
            })
          : t("cookieList.deleteSelectedMessage", { count: selectedCookies.size });
      const variant = sensitiveCount > 0 ? "danger" : "warning";

      showConfirm(title, message, variant, performDeleteSelected);
    };

    const getSelectedDomains = (): Set<string> => {
      const domains = new Set<string>();
      for (const cookie of cookies) {
        const key = getCookieKey(cookie.name, cookie.domain);
        if (selectedCookies.has(key)) {
          domains.add(normalizeDomain(cookie.domain));
        }
      }
      return domains;
    };

    const handleAddToWhitelist = () => {
      if (!onAddToWhitelist) {
        onMessage?.(t("cookieList.functionUnavailable"), true);
        return;
      }
      const domains = getSelectedDomains();
      const domainArray = Array.from(domains);
      const newDomains = domainArray.filter(
        (domain) => !_whitelist || !isInList(domain, _whitelist)
      );
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
      const newDomains = domainArray.filter(
        (domain) => !_blacklist || !isInList(domain, _blacklist)
      );
      if (newDomains.length > 0) {
        onAddToBlacklist(newDomains);
        onMessage?.(t("cookieList.addedDomainsToBlacklist", { count: newDomains.length }));
      } else if (domainArray.length > 0) {
        onMessage?.(t("cookieList.domainsAlreadyInBlacklist"), true);
      } else {
        onMessage?.(t("cookieList.selectDomainsFirst"), true);
      }
    };

    if (cookies.length === 0) {
      return (
        <div className="cookie-list-empty">
          <p>{t("cookieList.noCookies")}</p>
        </div>
      );
    }

    return (
      <div className="cookie-list-container">
        <button
          type="button"
          className="cookie-list-header"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          <h3>
            <span aria-hidden="true">🍪</span>{" "}
            {t("cookieList.cookieDetails", { count: cookies.length })}
          </h3>
          <span className={`expand-icon ${isExpanded ? "expanded" : ""}`} aria-hidden="true">
            ▼
          </span>
        </button>

        {isExpanded && (
          <>
            {selectedCookies.size > 0 && (
              <div className="batch-actions">
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
              </div>
            )}

            <div className="select-all-row">
              <label className="checkbox-label">
                <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} />
                <span>{t("cookieList.selectAll")}</span>
              </label>
            </div>

            <div className="cookie-list">
              {Array.from(groupedCookies.entries()).map(([domain, domainCookies]) => (
                <div key={domain} className="cookie-domain-group">
                  <button
                    type="button"
                    className="domain-group-header"
                    onClick={() => toggleDomainExpansion(domain)}
                    aria-expanded={expandedDomains.has(domain)}
                  >
                    <span className="domain-name">🌐 {domain}</span>
                    <span className="domain-count">({domainCookies.length})</span>
                    <span
                      className={`expand-icon ${expandedDomains.has(domain) ? "expanded" : ""}`}
                    >
                      ▼
                    </span>
                  </button>

                  {expandedDomains.has(domain) && (
                    <div className="domain-cookies">
                      {domainCookies.map((cookie) => {
                        const key = getCookieKey(cookie.name, cookie.domain);
                        const isVisible = visibleValues.has(key);
                        const displayValue = isVisible
                          ? cookie.value
                          : maskCookieValue(cookie.value, COOKIE_VALUE_MASK);
                        const risk = assessCookieRisk(cookie, currentDomain, t);
                        const isSelected = selectedCookies.has(key);
                        const sensitive = isSensitiveCookie(cookie);

                        return (
                          <div key={key} className={`cookie-item ${isSelected ? "selected" : ""}`}>
                            <div className="cookie-header">
                              <label className="checkbox-label cookie-checkbox">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleCookieSelection(key)}
                                  aria-label={`选择 ${cookie.name}`}
                                />
                              </label>
                              <div className="cookie-name">
                                <strong>
                                  {cookie.name}
                                  {sensitive && (
                                    <span className="sensitive-badge" title="敏感 Cookie">
                                      🔐
                                    </span>
                                  )}
                                </strong>
                                <span className="cookie-domain">{cookie.domain}</span>
                              </div>
                              <div className="cookie-actions">
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

                            <div
                              className="risk-badge"
                              style={{ borderLeftColor: getRiskLevelColor(risk.level) }}
                            >
                              <span
                                className="risk-level"
                                style={{ color: getRiskLevelColor(risk.level) }}
                              >
                                {getRiskLevelText(risk.level, t)}
                              </span>
                              <span className="risk-reason">{risk.reason}</span>
                            </div>

                            <div className="cookie-details">
                              <div className="cookie-detail-row">
                                <span className="detail-label">{t("cookieList.value")}</span>
                                <span className="detail-value">
                                  {displayValue}
                                  <button
                                    type="button"
                                    className="value-toggle-btn"
                                    onClick={() => toggleValueVisibility(key)}
                                    aria-label={
                                      isVisible ? t("cookieList.hide") : t("cookieList.show")
                                    }
                                  >
                                    {isVisible ? "👁️" : "👁️‍🗨️"}
                                  </button>
                                </span>
                              </div>
                              <div className="cookie-detail-row">
                                <span className="detail-label">{t("cookieList.path")}</span>
                                <span className="detail-value">{cookie.path}</span>
                              </div>
                              <div className="cookie-detail-row">
                                <span className="detail-label">{t("cookieList.secure")}</span>
                                <span className="detail-value">
                                  {cookie.secure ? t("common.yes") : t("common.no")}
                                </span>
                              </div>
                              <div className="cookie-detail-row">
                                <span className="detail-label">{t("cookieList.httpOnly")}</span>
                                <span className="detail-value">
                                  {cookie.httpOnly ? t("common.yes") : t("common.no")}
                                </span>
                              </div>
                              <div className="cookie-detail-row">
                                <span className="detail-label">{t("cookieList.sameSite")}</span>
                                <span className="detail-value">
                                  {cookie.sameSite || t("cookieList.notSet")}
                                </span>
                              </div>
                              {cookie.expirationDate && (
                                <div className="cookie-detail-row">
                                  <span className="detail-label">
                                    {t("cookieList.expirationTime")}
                                  </span>
                                  <span className="detail-value">
                                    {new Date(cookie.expirationDate * 1000).toLocaleString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <CookieEditor
          isOpen={showEditor}
          cookie={editingCookie}
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
          />
        )}
      </ConfirmDialogWrapper>
    );
  }
);

CookieList.displayName = "CookieList";
