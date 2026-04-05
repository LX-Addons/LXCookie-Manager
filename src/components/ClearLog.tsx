import { useStorage, useTranslation } from "@/hooks";
import { CLEAR_LOG_KEY, SETTINGS_KEY, DEFAULT_SETTINGS, LOG_RETENTION_MAP } from "@/lib/store";
import type { ClearLogEntry, Settings } from "@/types";
import { LogRetention } from "@/types";
import { getCookieTypeName, getActionText, formatLogTime } from "@/utils/format";
import { useMemo, useState } from "react";
import { useConfirmDialogContext } from "@/contexts/ConfirmDialogContext";
import { BackgroundService } from "@/lib/background-service";
import { Icon } from "@/components/Icon";

const EMPTY_LOGS: ClearLogEntry[] = [];

type ActionFilter = "all" | "clear" | "edit" | "delete" | "import" | "export";

interface Props {
  onMessage: (text: string, isError?: boolean) => void;
}

export const ClearLog = ({ onMessage }: Props) => {
  const showConfirm = useConfirmDialogContext();
  const [logs, setLogs] = useStorage<ClearLogEntry[]>(CLEAR_LOG_KEY, EMPTY_LOGS);
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

  const clearAllLogs = (triggerElement?: HTMLElement | null) => {
    showConfirm(
      t("clearLog.clearLogs"),
      t("clearLog.confirmClearLogs"),
      "danger",
      () => {
        setLogs([]);
        onMessage(t("clearLog.logsCleared"));
      },
      { triggerElement }
    );
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
        link.download = `lxcookie-manager-logs-${Date.now()}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 100);
        onMessage(t("clearLog.logsExported"));
      } else {
        console.error("Failed to export logs:", response.error);
        onMessage(t("common.unknownError"), true);
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
    const separator = t("common.listSeparator");
    if (domains.length > 2) {
      return t("clearLog.domainListWithMore", {
        domains: domains.slice(0, 2).join(separator),
        count: domains.length - 2,
      });
    }
    return domains.join(separator);
  };

  const filteredLogs = useMemo(() => {
    if (actionFilter === "all") return sortedLogs;
    return sortedLogs.filter((log) => log.action === actionFilter);
  }, [sortedLogs, actionFilter]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case "clear":
        return <Icon name="eraser" size={14} aria-hidden="true" />;
      case "edit":
        return <Icon name="edit" size={14} aria-hidden="true" />;
      case "delete":
        return <Icon name="trash" size={14} aria-hidden="true" />;
      case "import":
        return <Icon name="fileUp" size={14} aria-hidden="true" />;
      case "export":
        return <Icon name="fileDown" size={14} aria-hidden="true" />;
      default:
        return <Icon name="info" size={14} aria-hidden="true" />;
    }
  };

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
          <button onClick={(e) => clearAllLogs(e.currentTarget)} className="btn btn-danger btn-sm">
            {t("clearLog.clearAllLogs")}
          </button>
        </div>
      </section>

      {filteredLogs.length === 0 ? (
        <section className="log-empty panel">
          <div className="log-empty-icon">
            <Icon name="fileText" size={32} aria-hidden="true" />
          </div>
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
                    {getActionIcon(log.action)}
                    <span>{getActionText(log.action, t)}</span>
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
