import { useState, useMemo, useEffect, useCallback } from "react";
import type { Cookie } from "@/types";
import { getCookieKey } from "@/utils/format";
import { toggleSetValue, filterSetByValidKeys } from "@/utils";

interface UseCookieSelectionProps {
  cookies: Cookie[];
  filteredCookies: Cookie[];
  currentDomain?: string;
}

interface UseCookieSelectionReturn {
  selectedCookies: Set<string>;
  visibleValues: Set<string>;
  expandedDomains: Set<string>;
  expandedCookies: Set<string>;
  selectAll: boolean;
  toggleSelectAll: () => void;
  clearSelectedCookies: () => void;
  toggleCookieSelection: (key: string) => void;
  toggleValueVisibility: (key: string) => void;
  toggleDomainExpansion: (domain: string) => void;
  toggleCookieExpansion: (key: string) => void;
}

export const useCookieSelection = ({
  cookies,
  filteredCookies,
  currentDomain,
}: UseCookieSelectionProps): UseCookieSelectionReturn => {
  const [selectedCookies, setSelectedCookies] = useState<Set<string>>(new Set());
  const [visibleValues, setVisibleValues] = useState<Set<string>>(new Set());
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [expandedCookies, setExpandedCookies] = useState<Set<string>>(new Set());

  useEffect(() => {
    const validKeys = new Set(
      cookies.map((c) => getCookieKey(c.name, c.domain, c.path, c.storeId))
    );
    setSelectedCookies((prev) => filterSetByValidKeys(prev, validKeys));
    setVisibleValues((prev) => filterSetByValidKeys(prev, validKeys));
    setExpandedCookies((prev) => filterSetByValidKeys(prev, validKeys));
  }, [cookies]);

  useEffect(() => {
    setExpandedDomains(new Set());
  }, [currentDomain]);

  const selectAll = useMemo(() => {
    if (filteredCookies.length === 0) return false;
    return filteredCookies.every((cookie) =>
      selectedCookies.has(getCookieKey(cookie.name, cookie.domain, cookie.path, cookie.storeId))
    );
  }, [filteredCookies, selectedCookies]);

  const toggleSelectAll = useCallback(() => {
    setSelectedCookies((prev) => {
      const next = new Set(prev);
      const visibleKeys = filteredCookies.map((cookie) =>
        getCookieKey(cookie.name, cookie.domain, cookie.path, cookie.storeId)
      );
      const allSelected = visibleKeys.length > 0 && visibleKeys.every((key) => prev.has(key));
      if (allSelected) {
        visibleKeys.forEach((key) => next.delete(key));
      } else {
        visibleKeys.forEach((key) => next.add(key));
      }
      return next;
    });
  }, [filteredCookies]);

  const toggleCookieSelection = useCallback((key: string) => {
    setSelectedCookies((prev) => toggleSetValue(prev, key));
  }, []);

  const toggleValueVisibility = useCallback((key: string) => {
    setVisibleValues((prev) => toggleSetValue(prev, key));
  }, []);

  const toggleDomainExpansion = useCallback((domain: string) => {
    setExpandedDomains((prev) => toggleSetValue(prev, domain));
  }, []);

  const toggleCookieExpansion = useCallback((key: string) => {
    setExpandedCookies((prev) => toggleSetValue(prev, key));
  }, []);

  const clearSelectedCookies = useCallback(() => {
    setSelectedCookies(new Set());
  }, []);

  return {
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
  };
};
