import type { Cookie } from "@/types";
import { normalizeDomain } from "@/utils/domain";
import { getCookieKey } from "@/utils/format";
import { addDomainsToList } from "@/utils/domain-rules";

export const groupCookiesByDomain = (cookies: Cookie[]): Map<string, Cookie[]> => {
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
};

export const getSelectedDomains = (
  cookies: Cookie[],
  selectedCookies: Set<string>
): Set<string> => {
  const domains = new Set<string>();
  for (const cookie of cookies) {
    const key = getCookieKey(cookie.name, cookie.domain, cookie.path, cookie.storeId);
    if (selectedCookies.has(key)) {
      domains.add(normalizeDomain(cookie.domain));
    }
  }
  return domains;
};

export const filterRedundantDomains = (domains: string[], existingList?: string[]): string[] => {
  const result = addDomainsToList(domains, existingList || []);

  if (!existingList || existingList.length === 0) {
    return result.nextList;
  }

  const normalizedExisting = new Set(existingList.map((d) => normalizeDomain(d)));
  return result.nextList.filter((domain) => !normalizedExisting.has(domain));
};
