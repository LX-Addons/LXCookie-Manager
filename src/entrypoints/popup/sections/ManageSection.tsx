import { Icon } from "@/components/Icon";
import { StatusPanel } from "@/components/StatusPanel";
import { CookieList } from "@/components/CookieList";
import { useTranslation } from "@/hooks";
import type {
  CookieStats,
  Cookie as CookieType,
  DomainList,
  Settings as SettingsType,
} from "@/types";
import { ModeType } from "@/types";
import type { LoadingState } from "../hooks/usePopupData";

interface ManageSectionProps {
  loadingState: LoadingState;
  stats: CookieStats;
  currentCookies: CookieType[];
  currentDomain: string;
  settings: SettingsType;
  whitelist: DomainList;
  blacklist: DomainList;
  updateStats: () => void;
  showMessage: (text: string, isError?: boolean) => void;
  quickClearCurrent: (triggerElement?: HTMLElement | null) => void;
  quickAddToRule: () => void;
  quickClearAll: (triggerElement?: HTMLElement | null) => void;
  handleAddToWhitelist: (domains: string[]) => void;
  handleAddToBlacklist: (domains: string[]) => void;
}

const getRiskLevel = (stats: CookieStats) => {
  if (stats.tracking > 0) return "high";
  if (stats.thirdParty > 0) return "medium";
  return "low";
};

export const ManageSection = ({
  loadingState,
  stats,
  currentCookies,
  currentDomain,
  settings,
  whitelist,
  blacklist,
  updateStats,
  showMessage,
  quickClearCurrent,
  quickAddToRule,
  quickClearAll,
  handleAddToWhitelist,
  handleAddToBlacklist,
}: ManageSectionProps) => {
  const { t } = useTranslation();

  const riskLevel = getRiskLevel(stats);

  return (
    <main className="tab-content" role="tabpanel" id="manage-panel">
      {loadingState === "permission-denied" && (
        <section className="panel permission-denied-panel">
          <StatusPanel
            variant="error"
            title={t("popup.permissionDenied")}
            message={t("popup.permissionDeniedDesc")}
            action={
              <button
                className="btn btn-primary"
                onClick={() => {
                  chrome.runtime.openOptionsPage();
                }}
              >
                <Icon name="settings" size={14} />
                {t("popup.openExtensionSettings")}
              </button>
            }
          />
        </section>
      )}
      {loadingState === "domain-unavailable" && (
        <section className="panel domain-unavailable-panel">
          <StatusPanel
            variant="info"
            title={t("popup.unableToGetDomain")}
            message={t("popup.domainUnavailableDesc")}
          />
        </section>
      )}
      {loadingState === "load-failed" && (
        <section className="panel load-error-panel">
          <StatusPanel
            variant="error"
            title={t("popup.updateStatsFailed")}
            message={t("popup.loadFailedDesc")}
            action={
              <button className="btn btn-primary" onClick={updateStats}>
                <Icon name="refresh" size={14} />
                {t("popup.retry")}
              </button>
            }
          />
        </section>
      )}
      {loadingState === "loading" && (
        <section className="panel loading-panel">
          <StatusPanel variant="loading" title={t("popup.loading")} />
        </section>
      )}
      {loadingState === "idle" && (
        <>
          <section className="insight-strip panel" data-testid="insight-strip">
            <div className="insight-grid">
              <div className="insight-item insight-primary">
                <span className="insight-value">{stats.current}</span>
                <span className="insight-label">{t("popup.currentSiteCookies")}</span>
              </div>
              <div className="insight-item">
                <span className="insight-value">{stats.thirdParty}</span>
                <span className="insight-label">{t("popup.thirdParty")}</span>
              </div>
              <div className="insight-item insight-danger">
                <span className="insight-value">{stats.tracking}</span>
                <span className="insight-label">{t("popup.tracking")}</span>
              </div>
            </div>
            {(stats.thirdParty > 0 || stats.tracking > 0) && (
              <div className={`risk-summary risk-${riskLevel}`}>
                {stats.tracking > 0
                  ? t("popup.trackingDetected", { count: stats.tracking })
                  : t("popup.thirdPartyDetected", { count: stats.thirdParty })}
              </div>
            )}
          </section>

          <section className="mode-summary panel">
            <p className="mode-summary-text">
              {settings.mode === ModeType.WHITELIST
                ? t("popup.modeSummaryWhitelist")
                : t("popup.modeSummaryBlacklist")}
            </p>
          </section>

          <section className="quick-actions-panel panel" data-testid="quick-actions">
            <div className="panel-header">
              <h3>{t("popup.quickManage")}</h3>
            </div>
            <div className="action-cluster">
              <button
                onClick={(e) => quickClearCurrent(e.currentTarget)}
                className="btn btn-primary btn-block"
                disabled={!currentDomain}
                data-testid="clear-current-btn"
              >
                {t("popup.clearCurrent")}
              </button>
              <button
                onClick={quickAddToRule}
                className="btn btn-secondary btn-block"
                disabled={!currentDomain}
                data-testid="add-to-rule-btn"
              >
                {settings.mode === ModeType.WHITELIST
                  ? t("popup.addToWhitelist")
                  : t("popup.addToBlacklist")}
              </button>
            </div>
          </section>

          <section className="cookie-overview-panel panel">
            <div className="panel-header">
              <h3>{t("popup.cookieStats")}</h3>
              <span className="stat-secondary">
                {t("popup.total")}: {stats.total}
              </span>
            </div>
            <div className="stats-secondary">
              <div className="stat-item-small">
                <span className="stat-label">{t("popup.session")}</span>
                <span className="stat-value">{stats.session}</span>
              </div>
              <div className="stat-item-small">
                <span className="stat-label">{t("popup.persistent")}</span>
                <span className="stat-value">{stats.persistent}</span>
              </div>
            </div>
          </section>

          <CookieList
            cookies={currentCookies}
            currentDomain={currentDomain}
            onUpdate={updateStats}
            onMessage={showMessage}
            whitelist={whitelist}
            blacklist={blacklist}
            showCookieRisk={settings.showCookieRisk}
            onAddToWhitelist={handleAddToWhitelist}
            onAddToBlacklist={handleAddToBlacklist}
          />

          <section className="danger-zone-panel panel">
            <div className="panel-header">
              <h3 className="danger-zone-title">{t("popup.dangerZone")}</h3>
            </div>
            <p className="danger-zone-desc">{t("popup.dangerZoneDesc")}</p>
            <button
              onClick={(e) => quickClearAll(e.currentTarget)}
              className="btn btn-danger btn-block"
              data-testid="clear-all-btn"
            >
              {t("popup.clearAllCookies")}
            </button>
          </section>
        </>
      )}
    </main>
  );
};
