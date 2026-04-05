import { useState, useCallback } from "react";
import { Icon } from "@/components/Icon";
import { useStorage, useTranslation } from "@/hooks";
import { useConfirmDialogContext } from "@/contexts/ConfirmDialogContext";
import { WHITELIST_KEY, BLACKLIST_KEY } from "@/lib/store";
import type { DomainList } from "@/types";
import { validateDomain, normalizeDomain, isInList } from "@/utils/domain";
import { addDomainsToList } from "@/utils/domain-rules";

const EMPTY_DOMAIN_LIST: DomainList = [];

interface Props {
  type: "whitelist" | "blacklist";
  currentDomain: string;
  onMessage: (text: string, isError?: boolean) => void;
  onClearBlacklist?: () => void;
}

export const DomainManager = ({ type, currentDomain, onMessage, onClearBlacklist }: Props) => {
  const [inputValue, setInputValue] = useState("");
  const [list, setList] = useStorage<DomainList>(
    type === "whitelist" ? WHITELIST_KEY : BLACKLIST_KEY,
    EMPTY_DOMAIN_LIST
  );
  const { t } = useTranslation();
  const showConfirm = useConfirmDialogContext();

  const handleClearBlacklist = useCallback(
    (triggerElement?: HTMLElement | null) => {
      if (!onClearBlacklist) return;

      showConfirm(
        t("domainManager.clearBlacklistCookies"),
        t("domainManager.clearBlacklistWarning"),
        "danger",
        onClearBlacklist,
        { triggerElement }
      );
    },
    [showConfirm, onClearBlacklist, t]
  );

  const isCurrentDomainInList = currentDomain && isInList(currentDomain, list);

  const addDomain = (domain: string) => {
    const trimmed = domain.trim();
    const validation = validateDomain(trimmed, t);
    if (!validation.valid) {
      onMessage(validation.message || t("domainManager.invalidDomain"));
      return;
    }
    const result = addDomainsToList([trimmed], list);
    if (!result.changed) {
      onMessage(
        t("domainManager.alreadyInList", {
          domain: trimmed,
          listType: type === "whitelist" ? t("tabs.whitelist") : t("tabs.blacklist"),
        })
      );
      return;
    }
    setList(result.nextList);
    setInputValue("");
    onMessage(
      t("domainManager.addedToList", {
        listType: type === "whitelist" ? t("tabs.whitelist") : t("tabs.blacklist"),
      })
    );
  };

  const removeDomain = (domain: string) => {
    const normalizedDomain = normalizeDomain(domain);
    setList(list.filter((d) => normalizeDomain(d) !== normalizedDomain));
    onMessage(t("domainManager.deleted"));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      addDomain(inputValue);
    }
  };

  const handleAddCurrentDomain = () => {
    if (currentDomain) {
      addDomain(currentDomain);
    }
  };

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
            <span className="status-icon">
              {isCurrentDomainInList ? (
                <Icon name="checkCircle" size={16} />
              ) : (
                <Icon name="info" size={16} />
              )}
            </span>
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
            onClick={(e) => handleClearBlacklist(e.currentTarget)}
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
            <span className="empty-icon">
              {type === "whitelist" ? (
                <Icon name="shield" size={24} />
              ) : (
                <Icon name="shieldAlert" size={24} />
              )}
            </span>
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
