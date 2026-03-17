import { useState, useEffect } from "react";
import type { Cookie, SameSite } from "@/types";
import { useTranslation } from "@/hooks/useTranslation";
import { fromChromeSameSite } from "@/utils";

interface Props {
  isOpen: boolean;
  cookie: Cookie | null;
  currentDomain?: string;
  onClose: () => void;
  onSave: (cookie: Cookie) => Promise<boolean>;
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

const CookieEditorContent = ({ cookie, currentDomain, onClose, onSave }: Omit<Props, "isOpen">) => {
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isSaving]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    try {
      const success = await onSave(formData);
      if (success) {
        onClose();
      }
    } catch (error) {
      console.error("Failed to save cookie:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDialogKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSaving) {
      onClose();
    }
  };

  return (
    <div
      className="confirm-overlay"
      onClick={handleOverlayClick}
      onKeyDown={(e) => e.key === "Escape" && !isSaving && onClose()}
      role="presentation"
      data-testid="cookie-editor"
    >
      <dialog
        className="confirm-dialog cookie-editor-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
        open
      >
        <h3 className="confirm-title">
          {cookie ? t("cookieEditor.editCookie") : t("cookieEditor.createCookie")}
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="cookie-name">
              {t("cookieEditor.name")}
            </label>
            <input
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
              {t("cookieEditor.value")}
            </label>
            <textarea
              id="cookie-value"
              className="form-textarea"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cookie-domain">
              {t("cookieEditor.domain")}
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
              {t("cookieEditor.path")}
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
              {t("cookieEditor.expiration")}
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
              {t("cookieEditor.sameSite")}
            </label>
            <select
              id="cookie-samesite"
              className="select-input"
              value={formData.sameSite}
              onChange={(e) => setFormData({ ...formData, sameSite: e.target.value as SameSite })}
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
              />
              <span>{t("cookieEditor.secureOnly")}</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.httpOnly}
                onChange={(e) => setFormData({ ...formData, httpOnly: e.target.checked })}
              />
              <span>{t("cookieEditor.httpOnlyOnly")}</span>
            </label>
          </div>
          <div className="confirm-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              data-testid="cancel-editor"
              disabled={isSaving}
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              data-testid="save-editor"
              disabled={isSaving}
            >
              {isSaving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
};

export const CookieEditor = ({ isOpen, cookie, currentDomain, onClose, onSave }: Props) => {
  if (!isOpen) return null;

  return (
    <CookieEditorContent
      key={
        cookie
          ? `edit-${cookie.domain}-${cookie.name}-${cookie.path}-${cookie.storeId || "0"}`
          : "new"
      }
      cookie={cookie}
      currentDomain={currentDomain}
      onClose={onClose}
      onSave={onSave}
    />
  );
};
