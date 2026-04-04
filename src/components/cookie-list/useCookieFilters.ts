import { useState, useMemo, useEffect, useCallback } from "react";
import type { Cookie, CookieRisk } from "@/types";
import { assessCookieRisk } from "@/utils/cookie-risk";
import { isDomainMatch, normalizeDomain } from "@/utils/domain";
import { getCookieKey } from "@/utils/format";
import { groupCookiesByDomain } from "./utils";
import type { TranslationFunction } from "@/hooks";

export type RiskFilter = "all" | "low" | "medium" | "high" | "critical";
export type TypeFilter = "all" | "session" | "persistent";
export type DomainScopeFilter = "all" | "current" | "third-party";

interface UseCookieFiltersProps {
  cookies: Cookie[];
  currentDomain?: string;
  riskEnabled: boolean;
  t: TranslationFunction;
}

interface UseCookieFiltersReturn {
  searchText: string;
  setSearchText: (value: string) => void;
  riskFilter: RiskFilter;
  setRiskFilter: (value: RiskFilter) => void;
  typeFilter: TypeFilter;
  setTypeFilter: (value: TypeFilter) => void;
  domainScopeFilter: DomainScopeFilter;
  setDomainScopeFilter: (value: DomainScopeFilter) => void;
  cookieRiskMap: Map<string, CookieRisk>;
  filteredCookies: Cookie[];
  filteredGroupedCookies: Map<string, Cookie[]>;
  hasActiveFilters: boolean;
  clearFilters: () => void;
}

export const useCookieFilters = ({
  cookies,
  currentDomain,
  riskEnabled,
  t,
}: UseCookieFiltersProps): UseCookieFiltersReturn => {
  const [searchText, setSearchText] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [domainScopeFilter, setDomainScopeFilter] = useState<DomainScopeFilter>("all");

  useEffect(() => {
    if (!riskEnabled) {
      setRiskFilter("all");
    }
  }, [riskEnabled]);

  const cookieRiskMap = useMemo(() => {
    const map = new Map<string, CookieRisk>();
    if (!riskEnabled) return map;
    for (const cookie of cookies) {
      const key = getCookieKey(cookie.name, cookie.domain, cookie.path, cookie.storeId);
      const risk = assessCookieRisk(cookie, currentDomain, t);
      map.set(key, risk);
    }
    return map;
  }, [cookies, riskEnabled, currentDomain, t]);

  const filteredCookies = useMemo(() => {
    let result = cookies;

    if (searchText) {
      const lowerSearch = searchText.trim().toLowerCase();
      result = result.filter(
        (cookie) =>
          cookie.name.toLowerCase().includes(lowerSearch) ||
          cookie.domain.toLowerCase().includes(lowerSearch) ||
          cookie.value.toLowerCase().includes(lowerSearch)
      );
    }

    if (riskEnabled && riskFilter !== "all") {
      result = result.filter((cookie) => {
        const key = getCookieKey(cookie.name, cookie.domain, cookie.path, cookie.storeId);
        const risk = cookieRiskMap.get(key);
        return risk && risk.level === riskFilter;
      });
    }

    if (typeFilter !== "all") {
      result = result.filter((cookie) => {
        if (typeFilter === "session") {
          return !cookie.expirationDate;
        }
        return !!cookie.expirationDate;
      });
    }

    if (domainScopeFilter !== "all" && currentDomain) {
      result = result.filter((cookie) => {
        const cookieDomain = normalizeDomain(cookie.domain);
        const isCurrent = isDomainMatch(cookieDomain, currentDomain);
        if (domainScopeFilter === "current") {
          return isCurrent;
        }
        return !isCurrent;
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
    riskEnabled,
    cookieRiskMap,
  ]);

  const filteredGroupedCookies = useMemo(
    () => groupCookiesByDomain(filteredCookies),
    [filteredCookies]
  );

  const hasActiveFilters = useMemo(
    () =>
      searchText !== "" ||
      riskFilter !== "all" ||
      typeFilter !== "all" ||
      domainScopeFilter !== "all",
    [searchText, riskFilter, typeFilter, domainScopeFilter]
  );

  const clearFilters = useCallback(() => {
    setSearchText("");
    setRiskFilter("all");
    setTypeFilter("all");
    setDomainScopeFilter("all");
  }, []);

  return {
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
  };
};
