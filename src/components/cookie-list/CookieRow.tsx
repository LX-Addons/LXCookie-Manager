import { memo } from "react";
import { Icon } from "@/components/Icon";
import type { Cookie, CookieRisk } from "@/types";
import { formatCookieSameSite, getRiskLevelText } from "@/utils/format";
import type { TranslationFunction } from "@/hooks";

interface CookieRowProps {
  cookie: Cookie;
  keyProp: string;
  isVisible: boolean;
  displayValue: string;
  isCookieExpanded: boolean;
  risk: CookieRisk | null;
  isSelected: boolean;
  sensitive: boolean;
  onToggleSelection: (key: string) => void;
  onToggleExpansion: (key: string) => void;
  onToggleValueVisibility: (key: string) => void;
  onEdit: (cookie: Cookie, triggerElement?: HTMLElement | null) => void;
  onDelete: (cookie: Cookie, triggerElement?: HTMLElement | null) => void;
  riskEnabled: boolean;
  t: TranslationFunction;
}

export const CookieRow = memo(function CookieRow({
  cookie,
  keyProp,
  isVisible,
  displayValue,
  isCookieExpanded,
  risk,
  isSelected,
  sensitive,
  onToggleSelection,
  onToggleExpansion,
  onToggleValueVisibility,
  onEdit,
  onDelete,
  riskEnabled,
  t,
}: CookieRowProps) {
  const riskFactorsList = risk
    ? [
        risk.factors.isTracking && t("cookieList.trackingCookie"),
        risk.factors.isThirdParty && t("cookieList.thirdPartyCookie"),
        risk.factors.isSensitive && t("cookieList.sensitiveCookie"),
        risk.factors.notHttpOnly && t("cookieList.notHttpOnly"),
        risk.factors.notSecure && t("cookieList.notSecure"),
        risk.factors.sameSiteNone && t("cookieList.sameSiteNone"),
        risk.factors.longLifetime && t("cookieList.longLifetime"),
        risk.factors.sessionCookie && t("cookieList.sessionCookie"),
      ].filter((item): item is string => Boolean(item))
    : [];

  return (
    <div className={`cookie-card ${isSelected ? "selected" : ""}`}>
      <div className="cookie-summary-row">
        <label
          className="checkbox-label cookie-checkbox"
          aria-label={t("cookieList.selectCookie", { name: cookie.name })}
        >
          <input type="checkbox" checked={isSelected} onChange={() => onToggleSelection(keyProp)} />
        </label>
        <div className="cookie-summary-info">
          <span className="cookie-name-text">{cookie.name}</span>
          <div className="cookie-tags">
            {sensitive && (
              <span className="cookie-tag tag-sensitive">{t("cookieList.sensitive")}</span>
            )}
            {riskEnabled && risk && risk.level !== "low" && (
              <span className={`cookie-tag tag-risk-${risk.level}`}>
                {getRiskLevelText(risk.level, t)}
              </span>
            )}
            {!cookie.expirationDate && (
              <span className="cookie-tag tag-session">{t("cookieList.sessionCookie")}</span>
            )}
          </div>
        </div>
        <div className="cookie-actions">
          <button
            type="button"
            onClick={() => onToggleExpansion(keyProp)}
            className="btn btn-ghost btn-sm"
            aria-label={isCookieExpanded ? t("cookieList.collapse") : t("cookieList.expand")}
          >
            <Icon name="chevronDown" size={14} className={isCookieExpanded ? "expanded" : ""} />
          </button>
          <button
            type="button"
            onClick={(e) => onEdit(cookie, e.currentTarget)}
            className="btn btn-ghost btn-sm"
            aria-label={t("cookieList.edit")}
          >
            <Icon name="edit" size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => onDelete(cookie, e.currentTarget)}
            className="btn btn-ghost btn-sm btn-danger"
            aria-label={t("common.delete")}
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
      </div>

      {isCookieExpanded && (
        <div className="cookie-details-expanded">
          <div className="cookie-detail-group">
            <span className="cookie-detail-label">{t("cookieList.value")}</span>
            <div className="cookie-detail-value-container">
              <code className="cookie-detail-value">{displayValue}</code>
              <button
                type="button"
                onClick={() => onToggleValueVisibility(keyProp)}
                className="btn btn-ghost btn-sm"
                aria-label={isVisible ? t("cookieList.hide") : t("cookieList.show")}
              >
                <Icon name={isVisible ? "eyeOff" : "eye"} size={14} />
              </button>
            </div>
          </div>

          <div className="cookie-detail-group">
            <span className="cookie-detail-label">{t("cookieList.domain")}</span>
            <span className="cookie-detail-value">{cookie.domain}</span>
          </div>

          <div className="cookie-detail-group">
            <span className="cookie-detail-label">{t("cookieList.path")}</span>
            <span className="cookie-detail-value">{cookie.path}</span>
          </div>

          <div className="cookie-detail-group">
            <div className="cookie-security-flags">
              {cookie.secure && (
                <span className="security-flag secure">{t("cookieList.secure")}</span>
              )}
              {cookie.httpOnly && (
                <span className="security-flag httpOnly">{t("cookieList.httpOnly")}</span>
              )}
              {cookie.sameSite && (
                <span className="security-flag sameSite">
                  {formatCookieSameSite(cookie.sameSite, t)}
                </span>
              )}
            </div>
          </div>

          {cookie.expirationDate && (
            <div className="cookie-detail-group">
              <span className="cookie-detail-label">{t("cookieList.expirationTime")}</span>
              <span className="cookie-detail-value">
                {new Date(cookie.expirationDate * 1000).toLocaleString()}
              </span>
            </div>
          )}

          {riskEnabled && risk && risk.level !== "low" && riskFactorsList.length > 0 && (
            <div className="cookie-detail-group risk-factors-group">
              <span className="cookie-detail-label">{t("cookieList.riskFactors")}</span>
              <ul className="risk-factors-list">
                {riskFactorsList.map((factor) => (
                  <li key={factor} className="risk-factor-item">
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
