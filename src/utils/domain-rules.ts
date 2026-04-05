import { normalizeDomain } from "@/utils/domain";

export interface AddDomainsResult {
  nextList: string[];
  changed: boolean;
}

export function addDomainsToList(newDomains: string[], existingList: string[]): AddDomainsResult {
  const normalizedNew = newDomains.map((d) => normalizeDomain(d));
  const normalizedExisting = existingList.map((d) => normalizeDomain(d));

  const sortedNew = [...normalizedNew].sort((a, b) => a.length - b.length);

  const filteredNew: string[] = [];
  for (const domain of sortedNew) {
    const isCoveredByExisting = normalizedExisting.some(
      (existing) => domain === existing || domain.endsWith("." + existing)
    );
    if (isCoveredByExisting) continue;

    const isSubdomainOfAnotherNew = filteredNew.some(
      (added) => domain === added || domain.endsWith("." + added)
    );
    if (isSubdomainOfAnotherNew) continue;

    filteredNew.push(domain);
  }

  const finalList: string[] = [...normalizedExisting];
  for (const newDomain of filteredNew) {
    const subdomainsToRemove = new Set(
      finalList.filter((existing) => existing !== newDomain && existing.endsWith("." + newDomain))
    );
    const remainingList = finalList.filter((item) => !subdomainsToRemove.has(item));
    if (!remainingList.includes(newDomain)) {
      remainingList.push(newDomain);
    }
    finalList.length = 0;
    finalList.push(...remainingList);
  }

  const sortedNext = [...finalList].sort((a, b) => a.localeCompare(b));
  const sortedExisting = [...normalizedExisting].sort((a, b) => a.localeCompare(b));
  const changed = JSON.stringify(sortedNext) !== JSON.stringify(sortedExisting);

  return { nextList: finalList, changed };
}
