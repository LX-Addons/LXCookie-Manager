import { memo } from "react";
import { Icon } from "@/components/Icon";
import type { TranslationFunction } from "@/hooks";

interface CookieBatchActionsProps {
  selectedCount: number;
  selectAll: boolean;
  onDeleteSelected: (triggerElement?: HTMLElement | null) => void;
  onAddToWhitelist: () => void;
  onAddToBlacklist: () => void;
  onCreateCookie: (triggerElement?: HTMLElement | null) => void;
  onSelectAll: () => void;
  t: TranslationFunction;
}

export const CookieBatchActions = memo(function CookieBatchActions({
  selectedCount,
  selectAll,
  onDeleteSelected,
  onAddToWhitelist,
  onAddToBlacklist,
  onCreateCookie,
  onSelectAll,
  t,
}: CookieBatchActionsProps) {
  return (
    <>
      <div
        className={`batch-actions ${selectedCount > 0 ? "has-selection" : ""}`}
        data-testid="batch-actions"
      >
        {selectedCount > 0 ? (
          <>
            <span className="batch-count">
              {t("cookieList.selected", { count: selectedCount })}
            </span>
            <div className="batch-buttons">
              <button
                onClick={(e) => onDeleteSelected(e.currentTarget)}
                className="btn btn-danger btn-sm"
              >
                <Icon name="trash" size={14} />
                <span>{t("cookieList.deleteSelected")}</span>
              </button>
              <button onClick={onAddToWhitelist} className="btn btn-ghost btn-sm">
                <Icon name="shield" size={14} />
                <span>{t("cookieList.addToWhitelist")}</span>
              </button>
              <button onClick={onAddToBlacklist} className="btn btn-ghost btn-sm">
                <Icon name="shieldAlert" size={14} />
                <span>{t("cookieList.addToBlacklist")}</span>
              </button>
            </div>
          </>
        ) : (
          <div className="batch-buttons ml-auto">
            <button
              type="button"
              onClick={(e) => onCreateCookie(e.currentTarget)}
              className="btn btn-primary btn-sm"
            >
              <Icon name="plus" size={14} />
              <span>{t("cookieEditor.createCookie")}</span>
            </button>
          </div>
        )}
      </div>

      <div className="select-all-row">
        <label className="checkbox-label">
          <input type="checkbox" checked={selectAll} onChange={onSelectAll} />
          <span>{t("cookieList.selectAll")}</span>
        </label>
      </div>
    </>
  );
});
