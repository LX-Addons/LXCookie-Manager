export const normalizeDomain = (domain: string): string => {
  return domain.replace(/^\./, "").toLowerCase();
};

export const isDomainMatch = (cookieDomain: string, targetDomain: string): boolean => {
  const normalizedCookie = normalizeDomain(cookieDomain);
  const normalizedTarget = normalizeDomain(targetDomain);

  if (normalizedCookie === normalizedTarget) return true;
  if (normalizedCookie.endsWith("." + normalizedTarget)) return true;
  if (normalizedTarget.endsWith("." + normalizedCookie)) return true;

  return false;
};

export const isInList = (domain: string, list: string[]): boolean => {
  const normalizedDomain = normalizeDomain(domain);
  return list.some((item) => {
    const normalizedItem = normalizeDomain(item);
    return normalizedDomain === normalizedItem || normalizedDomain.endsWith("." + normalizedItem);
  });
};

export const isInSet = (domain: string, domainSet: Set<string>): boolean => {
  const normalizedDomain = normalizeDomain(domain);

  if (domainSet.has(normalizedDomain)) {
    return true;
  }

  const parts = normalizedDomain.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const parentDomain = parts.slice(i).join(".");
    if (domainSet.has(parentDomain)) {
      return true;
    }
  }

  return false;
};

export const validateDomain = (
  domain: string,
  t?: (key: string) => string
): { valid: boolean; message?: string } => {
  const trimmed = domain.trim();
  if (!trimmed) {
    return { valid: false, message: t ? t("domainManager.domainEmpty") : "域名不能为空" };
  }
  const normalized = normalizeDomain(trimmed);
  if (
    !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(
      normalized
    )
  ) {
    return { valid: false, message: t ? t("domainManager.invalidDomain") : "域名格式不正确" };
  }
  return { valid: true };
};

export const isValidHttpUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && !!parsed.hostname;
  } catch {
    return false;
  }
};
