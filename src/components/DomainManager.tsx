import { useState, useCallback } from "react";
import { useStorage } from "@/hooks/useStorage";
import { WHITELIST_KEY, BLACKLIST_KEY } from "@/lib/store";
import type { DomainList } from "@/types";
import { validateDomain } from "@/utils";
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

  const addDomain = useCallback(
    (domain: string) => {
      const trimmed = domain.trim();
      const validation = validateDomain(domain, t);
      if (!validation.valid) {
        onMessage(validation.message || t("domainManager.invalidDomain"));
        return;
      }
      if (list.includes(trimmed)) {
        onMessage(
          t("domainManager.alreadyInList", {
            domain: trimmed,
            listType: type === "whitelist" ? t("tabs.whitelist") : t("tabs.blacklist"),
          })
        );
        return;
      }
      setList([...list, trimmed]);
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
      setList(list.filter((d) => d !== domain));
      onMessage(t("domainManager.deleted"));
    },
    [list, setList, onMessage, t]
  );

  return (
    <div className="section">
      <h3>
        {type === "whitelist"
          ? t("domainManager.whitelistDomains")
          : t("domainManager.blacklistDomains")}
      </h3>
      <p className="help-text">
        {type === "whitelist" ? t("domainManager.whitelistHelp") : t("domainManager.blacklistHelp")}
      </p>
      <div className="input-group">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={t("domainManager.domainPlaceholder")}
        />
        <button onClick={() => addDomain(inputValue)} className="btn btn-primary">
          {t("common.add")}
        </button>
      </div>
      <button
        onClick={() => addDomain(currentDomain)}
        className="btn btn-secondary"
        disabled={!currentDomain}
      >
        {t("domainManager.addCurrentWebsite")}
      </button>
      {type === "blacklist" && onClearBlacklist && (
        <button onClick={onClearBlacklist} className="btn btn-danger btn-margin-top">
          {t("domainManager.clearBlacklistCookies")}
        </button>
      )}
      <ul className="domain-list">
        {list.map((domain) => (
          <li key={domain}>
            <span>{domain}</span>
            <button className="remove-btn" onClick={() => removeDomain(domain)}>
              {t("common.delete")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
