import { useState, useEffect, useRef, useId, useCallback } from "react";
import { Icon } from "@/components/Icon";
import type { Cookie, SameSite } from "@/types";
import { useTranslation } from "@/hooks/useTranslation";
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const valueInputRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const isClosingRef = useRef(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    if (isSaving || isClosingRef.current) return;
    isClosingRef.current = true;
    onClose();
  }, [onClose, isSaving]);

  useEffect(() => {
    if (isOpen) {
      isClosingRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      previousFocusRef.current = triggerElement || (document.activeElement as HTMLElement);
      dialog.showModal();
      requestAnimationFrame(() => {
        if (cookie) {
          valueInputRef.current?.focus();
        } else {
          nameInputRef.current?.focus();
        }
      });
    } else if (!isOpen && dialog.open) {
      const focusTarget = previousFocusRef.current;
      dialog.close();
      requestAnimationFrame(() => {
        focusTarget?.focus();
      });
    }
  }, [isOpen, triggerElement, cookie]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      handleClose();
    };

    const handleCloseEvent = () => {
      if (!isClosingRef.current) {
        handleClose();
      }
    };

    const handleClick = (e: MouseEvent) => {
      const rect = dialog.getBoundingClientRect();
      const isInDialog =
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width;
      if (!isInDialog) {
        handleClose();
      }
    };

    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("close", handleCloseEvent);
    dialog.addEventListener("click", handleClick);

    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("close", handleCloseEvent);
      dialog.removeEventListener("click", handleClick);
    };
  }, [handleClose]);

  useEffect(() => {
    if (isOpen) {
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
    if (isSaving || isClosingRef.current) return;

    setIsSaving(true);
    try {
      const success = await onSave(formData);
      if (success && !isClosingRef.current) {
        isClosingRef.current = true;
        onClose();
      }
    } catch (error) {
      console.error("Failed to save cookie:", error);
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
            <label className="form-label" htmlFor="cookie-samesite">
              <Icon name="shield" size={14} className="form-label-icon" />
              <span className="form-label-text">{t("cookieEditor.sameSite")}</span>
            </label>
            <select
              id="cookie-samesite"
              className="select-input"
              value={formData.sameSite}
              onChange={(e) => {
                const newSameSite = e.target.value as SameSite;
                setFormData({
                  ...formData,
                  sameSite: newSameSite,
                  secure: newSameSite === "none" ? true : formData.secure,
                });
              }}
            >
              <option value="unspecified">{t("cookieEditor.unspecified")}</option>
              <option value="strict">{t("cookieEditor.strict")}</option>
              <option value="lax">{t("cookieEditor.lax")}</option>
              <option value="none">{t("cookieEditor.none")}</option>
            </select>
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
