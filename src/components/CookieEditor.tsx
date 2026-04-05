import { useState, useEffect, useRef, useId, useCallback } from "react";
import { Icon } from "@/components/Icon";
import { Select } from "@/components/Select";
import type { Cookie, SameSite } from "@/types";
import { useTranslation, useDialog } from "@/hooks";
import { fromChromeSameSite } from "@/utils/format";

interface Props {
  isOpen: boolean;
  cookie: Cookie | null;
  currentDomain?: string;
  onClose: () => void;
  onSave: (cookie: Cookie) => Promise<boolean>;
  triggerElement?: HTMLElement | null;
}

const DEFAULT_COOKIE: Cookie = {
  name: "",
  value: "",
  domain: "",
  path: "/",
  secure: false,
  httpOnly: false,
  sameSite: "unspecified",
};

const CookieEditorContent = ({
  isOpen,
  cookie,
  currentDomain,
  onClose,
  onSave,
  triggerElement,
}: Props) => {
  const [formData, setFormData] = useState<Cookie>(() => {
    if (cookie) {
      return {
        ...cookie,
        sameSite: fromChromeSameSite(cookie.sameSite) as SameSite,
      };
    }
    return {
      ...DEFAULT_COOKIE,
      domain: currentDomain || "",
    };
  });
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useTranslation();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const valueInputRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();

  const wasOpenRef = useRef(false);
  const savedRef = useRef(false);
  const allowCloseRef = useRef(false);

  // isSaving: 请求中防重复提交
  // savedRef: 成功后关闭完成前防重复点击
  // allowCloseRef: 只有保存成功后才允许关闭

  const handleOpenFocus = useCallback(() => {
    if (cookie) {
      valueInputRef.current?.focus();
    } else {
      nameInputRef.current?.focus();
    }
  }, [cookie]);

  const { dialogRef, handleClose } = useDialog({
    isOpen,
    onClose: () => {
      if (savedRef.current && !allowCloseRef.current) return;
      onClose();
    },
    triggerElement,
    onOpenFocus: handleOpenFocus,
  });

  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (justOpened) {
      savedRef.current = false;
      allowCloseRef.current = false;
      if (cookie) {
        setFormData({
          ...cookie,
          sameSite: fromChromeSameSite(cookie.sameSite) as SameSite,
        });
      } else {
        setFormData({
          ...DEFAULT_COOKIE,
          domain: currentDomain || "",
        });
      }
    }
  }, [isOpen, cookie, currentDomain]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || savedRef.current) return;

    savedRef.current = true;
    setIsSaving(true);
    try {
      const success = await onSave(formData);
      if (success) {
        allowCloseRef.current = true;
        handleClose();
      } else {
        savedRef.current = false;
      }
    } catch (error) {
      console.error("Failed to save cookie:", error);
      savedRef.current = false;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="confirm-modal cookie-editor-dialog"
      aria-labelledby={titleId}
      data-testid="cookie-editor"
    >
      <div className="modal-header">
        <div className="modal-icon info">
          <Icon name="cookie" size={20} />
        </div>
        <div className="modal-title-section">
          <h3 id={titleId} className="modal-title">
            {cookie ? t("cookieEditor.editCookie") : t("cookieEditor.createCookie")}
          </h3>
        </div>
        <button
          type="button"
          className="btn btn-icon btn-ghost modal-close-btn"
          onClick={handleClose}
          disabled={isSaving}
          aria-label={t("common.close")}
        >
          <Icon name="x" size={16} />
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="modal-body cookie-editor-body">
          <div className="form-group">
            <label className="form-label" htmlFor="cookie-name">
              <Icon name="type" size={14} className="form-label-icon" />
              <span className="form-label-text">{t("cookieEditor.name")}</span>
            </label>
            <input
              ref={nameInputRef}
              id="cookie-name"
              type="text"
              className="form-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={!!cookie}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cookie-value">
              <Icon name="fileText" size={14} className="form-label-icon" />
              <span className="form-label-text">{t("cookieEditor.value")}</span>
            </label>
            <textarea
              ref={valueInputRef}
              id="cookie-value"
              className="form-textarea"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cookie-domain">
              <Icon name="globe" size={14} className="form-label-icon" />
              <span className="form-label-text">{t("cookieEditor.domain")}</span>
            </label>
            <input
              id="cookie-domain"
              type="text"
              className="form-input"
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              disabled={!!cookie}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cookie-path">
              <Icon name="fileText" size={14} className="form-label-icon" />
              <span className="form-label-text">{t("cookieEditor.path")}</span>
            </label>
            <input
              id="cookie-path"
              type="text"
              className="form-input"
              value={formData.path}
              onChange={(e) => setFormData({ ...formData, path: e.target.value })}
              disabled={!!cookie}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cookie-expiration">
              <Icon name="clock" size={14} className="form-label-icon" />
              <span className="form-label-text">{t("cookieEditor.expiration")}</span>
            </label>
            <input
              id="cookie-expiration"
              type="number"
              className="form-input"
              value={formData.expirationDate || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  expirationDate: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder={t("cookieEditor.expirationPlaceholder")}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cookie-samesite-select">
              <Icon name="shield" size={14} className="form-label-icon" />
              <span className="form-label-text">{t("cookieEditor.sameSite")}</span>
            </label>
            <Select
              name="cookie-samesite"
              value={formData.sameSite}
              onChange={(value) => {
                const newSameSite = value as SameSite;
                setFormData({
                  ...formData,
                  sameSite: newSameSite,
                  secure: newSameSite === "none" ? true : formData.secure,
                });
              }}
              options={[
                { value: "unspecified", label: t("cookieEditor.unspecified") },
                { value: "strict", label: t("cookieEditor.strict") },
                { value: "lax", label: t("cookieEditor.lax") },
                { value: "none", label: t("cookieEditor.none") },
              ]}
            />
          </div>
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.secure}
                onChange={(e) => setFormData({ ...formData, secure: e.target.checked })}
                disabled={formData.sameSite === "none"}
              />
              <Icon name="lock" size={14} className="checkbox-icon" />
              <span>{t("cookieEditor.secureOnly")}</span>
              {formData.sameSite === "none" && (
                <span className="checkbox-hint">({t("cookieEditor.secureRequiredForNone")})</span>
              )}
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.httpOnly}
                onChange={(e) => setFormData({ ...formData, httpOnly: e.target.checked })}
              />
              <Icon name="shield" size={14} className="checkbox-icon" />
              <span>{t("cookieEditor.httpOnlyOnly")}</span>
            </label>
          </div>
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleClose}
            data-testid="cancel-editor"
            disabled={isSaving}
          >
            <Icon name="x" size={14} />
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            data-testid="save-editor"
            disabled={isSaving}
          >
            <Icon name="save" size={14} />
            {isSaving ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </form>
    </dialog>
  );
};

export const CookieEditor = ({
  isOpen,
  cookie,
  currentDomain,
  onClose,
  onSave,
  triggerElement,
}: Props) => {
  return (
    <CookieEditorContent
      key={
        cookie
          ? `edit-${cookie.domain}-${cookie.name}-${cookie.path}-${cookie.storeId || "0"}`
          : "new"
      }
      isOpen={isOpen}
      cookie={cookie}
      currentDomain={currentDomain}
      onClose={onClose}
      onSave={onSave}
      triggerElement={triggerElement}
    />
  );
};
