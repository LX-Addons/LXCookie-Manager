import { useState, useCallback, useMemo } from "react";
import { useStorage } from "@/hooks/useStorage";
import { WHITELIST_KEY, BLACKLIST_KEY } from "@/lib/store";
import type { DomainList } from "@/types";
import { validateDomain, normalizeDomain, isInList } from "@/utils";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  type: "whitelist" | "blacklist";
  currentDomain: string;
  onMessage: (msg: string) => void;
  onClearBlacklist?: () => void;
}

export const DomainManager = ({ type, currentDomain, onMessage, onClearBlacklist }: Props) => {
  const [inputValue, setInputValue] = useState("");
  const [list, setList] = useStorage<DomainList>(
    type === "whitelist" ? WHITELIST_KEY : BLACKLIST_KEY,
    []
  );
  const { t } = useTranslation();

  const isCurrentDomainInList = useMemo(
    () => currentDomain && isInList(currentDomain, list),
    [currentDomain, list]
  );

  const addDomain = useCallback(
    (domain: string) => {
      const trimmed = domain.trim();
      const validation = validateDomain(trimmed, t);
      if (!validation.valid) {
        onMessage(validation.message || t("domainManager.invalidDomain"));
        return;
      }
      const normalizedTrimmed = normalizeDomain(trimmed);
      const isAlreadyInList = list.some((item) => normalizeDomain(item) === normalizedTrimmed);
      if (isAlreadyInList) {
        onMessage(
          t("domainManager.alreadyInList", {
            domain: trimmed,
            listType: type === "whitelist" ? t("tabs.whitelist") : t("tabs.blacklist"),
          })
        );
        return;
      }
      setList([...list, normalizedTrimmed]);
      setInputValue("");
      onMessage(
        t("domainManager.addedToList", {
          listType: type === "whitelist" ? t("tabs.whitelist") : t("tabs.blacklist"),
        })
      );
    },
    [list, onMessage, setList, t, type]
  );

  const removeDomain = useCallback(
    (domain: string) => {
      const normalizedDomain = normalizeDomain(domain);
      setList(list.filter((d) => normalizeDomain(d) !== normalizedDomain));
      onMessage(t("domainManager.deleted"));
    },
    [list, setList, onMessage, t]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && inputValue.trim()) {
        e.preventDefault();
        addDomain(inputValue);
      }
    },
    [addDomain, inputValue]
  );

  const handleAddCurrentDomain = useCallback(() => {
    if (currentDomain) {
      addDomain(currentDomain);
    }
  }, [addDomain, currentDomain]);

  return (
    <div className={`rule-manager rule-manager-${type}`}>
      <section className="rule-summary panel" data-testid="rule-summary">
        <div className="panel-header">
          <h3>
            {type === "whitelist"
              ? t("domainManager.whitelistDomains")
              : t("domainManager.blacklistDomains")}
          </h3>
          <span className="rule-count">{t("domainManager.ruleCount", { count: list.length })}</span>
        </div>
        <p className="rule-description">
          {type === "whitelist"
            ? t("domainManager.whitelistHelp")
            : t("domainManager.blacklistHelp")}
        </p>
        {currentDomain && (
          <div
            className={`current-domain-status ${isCurrentDomainInList ? "in-list" : "not-in-list"}`}
          >
            <span className="status-icon">{isCurrentDomainInList ? "\u2713" : "\u25CB"}</span>
            <span className="status-text">
              {isCurrentDomainInList
                ? t("domainManager.currentDomainInList")
                : t("domainManager.currentDomainNotInList")}
            </span>
            <span className="status-domain">{currentDomain}</span>
          </div>
        )}
      </section>

      <section className="rule-input-panel panel">
        <div className="panel-header">
          <h3>{t("domainManager.addDomain")}</h3>
        </div>
        <div className="input-group">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("domainManager.domainPlaceholder")}
            aria-label={t("domainManager.addDomain")}
            className="rule-input"
            data-testid="rule-input"
          />
          <button
            onClick={() => addDomain(inputValue)}
            className="btn btn-primary"
            disabled={!inputValue.trim()}
          >
            {t("common.add")}
          </button>
        </div>
        {currentDomain && (
          <div className="quick-add-section">
            <span className="quick-add-label">{t("domainManager.quickAdd")}:</span>
            <button
              onClick={handleAddCurrentDomain}
              className="btn btn-secondary btn-sm"
              disabled={!!isCurrentDomainInList}
              aria-label={`${t("domainManager.addCurrentWebsite")}: ${currentDomain}`}
            >
              {currentDomain}
            </button>
          </div>
        )}
      </section>

      {type === "blacklist" && onClearBlacklist && (
        <section className="rule-danger-panel panel">
          <div className="panel-header">
            <h3 className="danger-title">{t("domainManager.dangerZone")}</h3>
          </div>
          <p className="danger-description">{t("domainManager.clearBlacklistWarning")}</p>
          <button
            onClick={onClearBlacklist}
            className="btn btn-danger btn-block"
            data-testid="rule-danger-action"
          >
            {t("domainManager.clearBlacklistCookies")}
          </button>
        </section>
      )}

      <section className="rule-list panel">
        <div className="panel-header">
          <h3>{t("domainManager.domainList")}</h3>
        </div>
        {list.length === 0 ? (
          <div className="rule-list-empty">
            <span className="empty-icon">{type === "whitelist" ? "*" : "!"}</span>
            <p className="empty-text">
              {type === "whitelist"
                ? t("domainManager.emptyWhitelist")
                : t("domainManager.emptyBlacklist")}
            </p>
            <p className="empty-hint">
              {type === "whitelist"
                ? t("domainManager.emptyWhitelistHint")
                : t("domainManager.emptyBlacklistHint")}
            </p>
          </div>
        ) : (
          <ul className="rule-items">
            {list.map((domain) => (
              <li key={domain} className="rule-item" data-testid="rule-item">
                <div className="rule-item-content">
                  <span className="rule-domain">{domain}</span>
                  <span className="rule-type-tag">
                    {type === "whitelist"
                      ? t("domainManager.protectedTag")
                      : t("domainManager.cleanupTag")}
                  </span>
                </div>
                <button
                  className="rule-remove-btn"
                  onClick={() => removeDomain(domain)}
                  aria-label={t("domainManager.removeDomain", { domain })}
                >
                  {t("common.delete")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
