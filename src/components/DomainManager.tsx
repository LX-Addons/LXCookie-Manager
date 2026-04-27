import { useState, useCallback } from "react";
import { Icon } from "@/components/Icon";
import { useStorage, useTranslation } from "@/hooks";
import { useConfirmDialogContext } from "@/contexts/ConfirmDialogContext";
import { WHITELIST_KEY, BLACKLIST_KEY } from "@/lib/store";
import type { DomainList } from "@/types";
import { validateDomain, normalizeDomain, isInList } from "@/utils/domain";
import { addDomainsToList } from "@/utils/domain-rules";

/*
 * ⚠️ 架构决策说明：直接写存储的可接受性分析
 *
 * 当前实现：DomainManager 通过 setList() 直接写入 chrome.storage.local
 * - WHITELIST_KEY: 白名单域名列表
 * - BLACKLIST_KEY: 黑名单域名列表
 *
 * 为什么此处直接写存储是可接受的：
 *
 * 1. 触发频率极低
 *    - 列表修改由用户主动触发（点击"添加"/"删除"按钮）
 *    - 不存在自动化高频写入场景
 *    - 用户操作间隔通常 > 1秒
 *
 * 2. 写入时机可控
 *    - 仅在用户明确交互时写入（非响应式/非批量）
 *    - 写入前通常有确认对话框
 *    - 单次操作只涉及一个列表（白名单或黑名单）
 *
 * 3. 与 cleanup 并发概率可忽略
 *    - Cleanup 操作读取列表用于判断是否跳过某域名
 *    - Cleanup 执行时间通常 < 100ms
 *    - 用户在同一毫秒内修改列表并触发 cleanup 的概率 ≈ 0
 *
 * 4. 数据一致性要求相对宽松
 *    - 白/黑名单是策略配置，非实时交易数据
 *    - 即使出现短暂不一致，下次 cleanup 会使用最新值
 *    - 用户预期：修改后"很快生效"，而非"立即强一致"
 *
 * 5. 实现复杂度考量
 *    - 改为 background 消息路由需要：新增消息类型、handler、错误处理
 *    - 收益有限（消除理论上的竞态风险）
 *    - 成本较高（增加代码复杂度和维护负担）
 *
 * 未来改进路径（如需彻底解决）：
 * 方案 A：将列表写入路由至 background 消息
 *   - 新增消息类型：updateWhitelist / updateBlacklist
 *   - Handler 中使用 distributed-lock 或队列序列化写入
 *   - 优点：完全消除前端竞争
 *   - 缺点：增加复杂度，需要异步等待
 *
 * 方案 B：使用 storage.watch 监听变更
 *   - Background 监听列表 key 变更，自动刷新缓存
 *   - 优点：无需修改前端写入逻辑
 *   - 缺点：仍有极小时间窗口的不一致
 *
 * 方案 C：保持现状 + 监控
 *   - 添加 metrics 记录列表读写频率
 *   - 如发现频率升高再优化
 *   - 优点：零成本，按需优化
 *   - 缺点：被动响应
 *
 * 决策时间：2026-04-06
 * 决策者：架构评审（P0-P2 修复计划）
 * 下次评估触发条件：用户反馈列表丢失或 cleanup 行为异常
 */

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
