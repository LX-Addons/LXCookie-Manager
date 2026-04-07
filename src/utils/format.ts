import type { RiskLevel } from "@/types";

export const getCookieTypeName = (type: string, t: (key: string) => string): string => {
  switch (type) {
    case "session":
      return t("cookieTypes.session");
    case "persistent":
      return t("cookieTypes.persistent");
    default:
      return t("cookieTypes.all");
  }
};

export const getRiskLevelColor = (level: RiskLevel): string => {
  switch (level) {
    case "critical":
      return "#7c2d12";
    case "high":
      return "#ef4444";
    case "medium":
      return "#f59e0b";
    default:
      return "#22c55e";
  }
};

export const getRiskLevelText = (level: RiskLevel, t: (key: string) => string): string => {
  switch (level) {
    case "critical":
      return t("cookieList.criticalRisk");
    case "high":
      return t("cookieList.highRisk");
    case "medium":
      return t("cookieList.mediumRisk");
    default:
      return t("cookieList.lowRisk");
  }
};

export const getActionText = (action: string, t: (key: string) => string): string => {
  switch (action) {
    case "clear":
      return t("actions.clear");
    case "edit":
      return t("actions.edit");
    case "delete":
      return t("actions.delete");
    case "import":
      return t("actions.import");
    case "export":
      return t("actions.export");
    default:
      return t("actions.action");
  }
};

export const getActionColor = (action: string): string => {
  switch (action) {
    case "clear":
      return "#3b82f6";
    case "edit":
      return "#f59e0b";
    case "delete":
      return "#ef4444";
    case "import":
      return "#22c55e";
    case "export":
      return "#8b5cf6";
    default:
      return "#64748b";
  }
};

export const formatLogTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString(navigator.language, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const maskCookieValue = (value: string, mask: string): string => {
  if (!value || value.length === 0) return mask;
  if (value.length <= 8) return mask;
  if (mask.length < 4) return mask.repeat(4);
  return value.slice(0, 4) + mask.substring(4);
};

export const getCookieKey = (
  name: string,
  domain: string,
  path?: string,
  storeId?: string
): string => {
  return `${name}|${domain}|${path ?? "/"}|${storeId ?? "0"}`;
};

export const fromChromeSameSite = (sameSite?: string): string => {
  if (sameSite === "no_restriction") {
    return "none";
  }
  return sameSite || "unspecified";
};

export const toChromeSameSite = (
  sameSite?: string
): "no_restriction" | "lax" | "strict" | undefined => {
  if (sameSite === "none" || sameSite === "no_restriction") {
    return "no_restriction";
  }
  if (sameSite === "unspecified" || !sameSite) {
    return undefined;
  }
  if (sameSite === "lax" || sameSite === "strict") {
    return sameSite;
  }
  return undefined;
};

export const formatCookieSameSite = (
  sameSite: string | undefined,
  t: (key: string) => string
): string => {
  const normalized = fromChromeSameSite(sameSite);
  if (normalized === "unspecified" || !normalized) {
    return t("cookieList.notSet");
  }
  if (normalized === "strict") {
    return t("cookieEditor.strict");
  }
  if (normalized === "lax") {
    return t("cookieEditor.lax");
  }
  if (normalized === "none") {
    return t("cookieEditor.none");
  }
  return normalized;
};
