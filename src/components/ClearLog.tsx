import { useStorage } from "@/hooks/useStorage";
import { CLEAR_LOG_KEY, SETTINGS_KEY, DEFAULT_SETTINGS, LOG_RETENTION_MAP } from "@/lib/store";
import type { ClearLogEntry, Settings } from "@/types";
import { LogRetention } from "@/types";
import { getCookieTypeName, getActionText, getActionColor, formatLogTime } from "@/utils";
import { useMemo } from "react";
import { ConfirmDialogWrapper, type ShowConfirmFn } from "./ConfirmDialogWrapper";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  onMessage: (msg: string) => void;
}

interface ClearLogContentProps extends Props {
  showConfirm: ShowConfirmFn;
}

const ClearLogContent = ({ onMessage, showConfirm }: ClearLogContentProps) => {
  const [logs, setLogs] = useStorage<ClearLogEntry[]>(CLEAR_LOG_KEY, []);
  const [settings] = useStorage<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS);
  const { t } = useTranslation();

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

  const exportLogs = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cookie-manager-logs-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    onMessage(t("clearLog.logsExported"));
  };

  const sortedLogs = useMemo(() => [...logs].sort((a, b) => b.timestamp - a.timestamp), [logs]);

  return (
    <div className="log-container">
      <div className="section">
        <div className="log-header">
          <h3>{t("clearLog.clearLogs")}</h3>
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
        </div>
      </div>

      {sortedLogs.length === 0 ? (
        <div className="empty-log">
          <p>{t("clearLog.noLogs")}</p>
        </div>
      ) : (
        <ul className="log-list">
          {sortedLogs.map((log) => (
            <li key={log.id} className="log-item">
              <div className="log-info">
                <div className="log-domain">{log.domain}</div>
                <div className="log-details">
                  <span
                    className="log-type"
                    style={{ backgroundColor: getActionColor(log.action) }}
                  >
                    {getActionText(log.action, t)}
                  </span>
                  <span className="log-type">{getCookieTypeName(log.cookieType, t)}</span>
                  <span className="log-count">{t("common.count", { count: log.count })}</span>
                  <span className="log-time">{formatLogTime(log.timestamp, t)}</span>
                </div>
                {log.details && <div className="log-details-text">{log.details}</div>}
              </div>
            </li>
          ))}
        </ul>
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
