import { memo } from "react";
import { Icon } from "@/components/Icon";
import type { Cookie, CookieRisk } from "@/types";
import { COOKIE_VALUE_MASK } from "@/lib/constants";
import { maskCookieValue, getCookieKey } from "@/utils/format";
import { isSensitiveCookie } from "@/utils/cookie-risk";
import { isDomainMatch } from "@/utils/domain";
import { CookieRow } from "./CookieRow";
import type { TranslationFunction } from "@/hooks";

interface CookieDomainGroupProps {
  domain: string;
  domainCookies: Cookie[];
  currentDomain?: string;
  isExpanded: boolean;
  riskEnabled: boolean;
  cookieRiskMap: Map<string, CookieRisk>;
  selectedCookies: Set<string>;
  visibleValues: Set<string>;
  expandedCookies: Set<string>;
  onToggleDomainExpansion: (domain: string) => void;
  onToggleSelection: (key: string) => void;
  onToggleValueVisibility: (key: string) => void;
  onToggleCookieExpansion: (key: string) => void;
  onEdit: (cookie: Cookie, triggerElement?: HTMLElement | null) => void;
  onDelete: (cookie: Cookie, triggerElement?: HTMLElement | null) => void;
  t: TranslationFunction;
}

export const CookieDomainGroup = memo(function CookieDomainGroup({
  domain,
  domainCookies,
  currentDomain,
  isExpanded,
  riskEnabled,
  cookieRiskMap,
  selectedCookies,
  visibleValues,
  expandedCookies,
  onToggleDomainExpansion,
  onToggleSelection,
  onToggleValueVisibility,
  onToggleCookieExpansion,
  onEdit,
  onDelete,
  t,
}: CookieDomainGroupProps) {
  const isCurrentDomain = currentDomain && isDomainMatch(domain, currentDomain);
  const isThirdParty = currentDomain && !isCurrentDomain;

  return (
    <div className="cookie-domain-group" data-testid={`cookie-domain-group-${domain}`}>
      <button
        type="button"
        className="domain-group-header"
        onClick={() => onToggleDomainExpansion(domain)}
        aria-expanded={isExpanded}
      >
        <div className="domain-header-info">
          <span className="domain-name">{domain}</span>
          <div className="domain-tags">
            <span className="domain-count-tag">
              {domainCookies.length} {t("cookieList.cookies")}
            </span>
            {isCurrentDomain && (
              <span className="domain-tag tag-current">{t("cookieList.currentSite")}</span>
            )}
            {isThirdParty && (
              <span className="domain-tag tag-third-party">{t("cookieList.thirdParty")}</span>
            )}
          </div>
        </div>
        <span className={`expand-icon ${isExpanded ? "expanded" : ""}`}>
          <Icon name="chevronDown" size={16} />
        </span>
      </button>

      {isExpanded && (
        <div className="domain-cookies">
          {domainCookies.map((cookie) => {
            const key = getCookieKey(cookie.name, cookie.domain, cookie.path, cookie.storeId);
            const isVisible = visibleValues.has(key);
            const displayValue = isVisible
              ? cookie.value
              : maskCookieValue(cookie.value, COOKIE_VALUE_MASK);
            const risk = riskEnabled ? (cookieRiskMap.get(key) ?? null) : null;
            const isSelected = selectedCookies.has(key);
            const sensitive = isSensitiveCookie(cookie);

            return (
              <CookieRow
                key={key}
                cookie={cookie}
                keyProp={key}
                isVisible={isVisible}
                displayValue={displayValue}
                isCookieExpanded={expandedCookies.has(key)}
                risk={risk}
                isSelected={isSelected}
                sensitive={sensitive}
                onToggleSelection={onToggleSelection}
                onToggleExpansion={onToggleCookieExpansion}
                onToggleValueVisibility={onToggleValueVisibility}
                onEdit={onEdit}
                onDelete={onDelete}
                riskEnabled={riskEnabled}
                t={t}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});
