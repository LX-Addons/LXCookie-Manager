import { useStorage } from "@/hooks/useStorage";
import { CLEAR_LOG_KEY, SETTINGS_KEY, DEFAULT_SETTINGS, LOG_RETENTION_MAP } from "@/lib/store";
import type { ClearLogEntry, Settings } from "@/types";
import { LogRetention } from "@/types";
import { getCookieTypeName, getActionText, formatLogTime } from "@/utils/format";
import { useMemo, useState } from "react";
import { ConfirmDialogWrapper, type ShowConfirmFn } from "@/components/ConfirmDialogWrapper";
import { useTranslation } from "@/hooks/useTranslation";
import { BackgroundService } from "@/lib/background-service";

type ActionFilter = "all" | "clear" | "edit" | "delete" | "import" | "export";

interface Props {
  onMessage: (msg: string, isError?: boolean) => void;
}

interface ClearLogContentProps extends Props {
  showConfirm: ShowConfirmFn;
}

const ClearLogContent = ({ onMessage, showConfirm }: ClearLogContentProps) => {
  const [logs, setLogs] = useStorage<ClearLogEntry[]>(CLEAR_LOG_KEY, []);
  const [settings] = useStorage<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS);
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const { t } = useTranslation();

  const filterLabelKeyMap: Record<ActionFilter, string> = {
    all: "clearLog.filterAll",
    clear: "clearLog.filterClear",
    edit: "clearLog.filterEdit",
    delete: "clearLog.filterDelete",
    import: "clearLog.filterImport",
    export: "clearLog.filterExport",
  };

  const clearAllLogs = () => {
    showConfirm(t("clearLog.clearLogs"), t("clearLog.confirmClearLogs"), "danger", () => {
      setLogs([]);
      onMessage(t("clearLog.logsCleared"));
    });
  };

  const clearOldLogs = () => {
    if (settings.logRetention === LogRetention.FOREVER) {
      onMessage(t("clearLog.logRetentionForever"));
      return;
    }

    const now = Date.now();
    const retentionMs = LOG_RETENTION_MAP[settings.logRetention] || 7 * 24 * 60 * 60 * 1000;
    setLogs((prev) => {
      const currentPrev = prev ?? [];
      const filteredLogs = currentPrev.filter((log) => now - log.timestamp <= retentionMs);
      if (filteredLogs.length < currentPrev.length) {
        onMessage(
          t("clearLog.expiredLogsCleared", { count: currentPrev.length - filteredLogs.length })
        );
      } else {
        onMessage(t("clearLog.noExpiredLogs"));
      }
      return filteredLogs;
    });
  };

  const exportLogs = async () => {
    try {
      const response = await BackgroundService.exportLogs({
        sanitize: false,
        includeMetadata: true,
      });

      if (response.success && response.data) {
        const dataStr = response.data;
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `cookie-manager-logs-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
        onMessage(t("clearLog.logsExported"));
      } else {
        onMessage(response.error?.message || t("common.unknownError"), true);
      }
    } catch (e) {
      console.error("Failed to export logs:", e);
      onMessage(t("common.unknownError"), true);
    }
  };

  const sortedLogs = useMemo(() => [...logs].sort((a, b) => b.timestamp - a.timestamp), [logs]);

  const getDomainDisplay = (domains: string[] | undefined, domain: string | undefined): string => {
    if (!domains || domains.length === 0) {
      return domain ?? "";
    }
    if (domains.length > 2) {
      return `${domains.slice(0, 2).join(", ")} ${t("clearLog.andMoreDomains", { count: domains.length })}`;
    }
    return domains.join(", ");
  };

  const filteredLogs = useMemo(() => {
    if (actionFilter === "all") return sortedLogs;
    return sortedLogs.filter((log) => log.action === actionFilter);
  }, [sortedLogs, actionFilter]);

  return (
    <div className="log-container">
      <section className="log-summary-card panel">
        <div className="log-summary-header">
          <h3 className="log-summary-title">{t("clearLog.logOverview")}</h3>
          <span className="log-summary-count">
            {t("clearLog.totalEntries", { count: logs.length })}
          </span>
        </div>
      </section>

      <section className="log-toolbar panel" data-testid="log-toolbar">
        <div className="log-filter-tabs" data-testid="log-filter">
          {(["all", "clear", "edit", "delete", "import", "export"] as ActionFilter[]).map(
            (filter) => (
              <button
                key={filter}
                className={`log-filter-tab ${actionFilter === filter ? "active" : ""}`}
                onClick={() => setActionFilter(filter)}
                aria-label={t(filterLabelKeyMap[filter])}
              >
                {t(filterLabelKeyMap[filter])}
              </button>
            )
          )}
        </div>
        <div className="log-actions">
          <button onClick={clearOldLogs} className="btn btn-secondary btn-sm">
            {t("clearLog.clearExpired")}
          </button>
          <button onClick={exportLogs} className="btn btn-primary btn-sm">
            {t("clearLog.exportLogs")}
          </button>
          <button onClick={clearAllLogs} className="btn btn-danger btn-sm">
            {t("clearLog.clearAllLogs")}
          </button>
        </div>
      </section>

      {filteredLogs.length === 0 ? (
        <section className="log-empty panel">
          <div className="log-empty-icon">≡</div>
          <h4 className="log-empty-title">{t("clearLog.emptyLogs")}</h4>
          <p className="log-empty-hint">{t("clearLog.emptyLogsHint")}</p>
        </section>
      ) : (
        <section className="log-timeline">
          {filteredLogs.map((log) => (
            <div key={log.id} className="log-entry panel" data-testid="log-entry">
              <div className="log-entry-timeline">
                <div className={`log-entry-dot log-action-${log.action}`}></div>
                <div className="log-entry-line"></div>
              </div>
              <div className="log-entry-content">
                <div className="log-entry-header">
                  <span className={`log-action-badge log-action-${log.action}`}>
                    {getActionText(log.action, t)}
                  </span>
                  <span className="log-entry-time">
                    {formatLogTime(log.timestamp, settings.locale)}
                  </span>
                </div>
                <div className="log-entry-domain">{getDomainDisplay(log.domains, log.domain)}</div>
                <div className="log-entry-meta">
                  <span className="log-entry-meta-item">
                    <span className="log-entry-meta-label">{t("clearLog.count")}:</span>
                    <span className="log-entry-meta-value">{log.count}</span>
                  </span>
                  {log.cookieType && (
                    <span className="log-entry-meta-item">
                      <span className="log-entry-meta-label">{t("clearLog.cookieType")}:</span>
                      <span className="log-entry-meta-value">
                        {getCookieTypeName(log.cookieType, t)}
                      </span>
                    </span>
                  )}
                </div>
                {log.details && <div className="log-entry-details">{log.details}</div>}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};

export const ClearLog = ({ onMessage }: Props) => {
  return (
    <ConfirmDialogWrapper>
      {(showConfirm) => <ClearLogContent onMessage={onMessage} showConfirm={showConfirm} />}
    </ConfirmDialogWrapper>
  );
};
