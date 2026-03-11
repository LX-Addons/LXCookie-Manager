import { useState, useEffect } from "react";
import type { Cookie, SameSite } from "@/types";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  isOpen: boolean;
  cookie: Cookie | null;
  onClose: () => void;
  onSave: (cookie: Cookie) => void;
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

const CookieEditorContent = ({ cookie, onClose, onSave }: Omit<Props, "isOpen">) => {
  const [formData, setFormData] = useState<Cookie>(() =>
    cookie ? { ...cookie } : { ...DEFAULT_COOKIE }
  );
  const { t } = useTranslation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleDialogKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="confirm-overlay" onClick={onClose} data-testid="cookie-editor">
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
              required
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
            >
              {t("common.cancel")}
            </button>
            <button type="submit" className="btn btn-primary" data-testid="save-editor">
              {t("common.save")}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
};

export const CookieEditor = ({ isOpen, cookie, onClose, onSave }: Props) => {
  if (!isOpen) return null;

  return (
    <CookieEditorContent
      key={cookie ? `edit-${cookie.domain}-${cookie.name}` : "new"}
      cookie={cookie}
      onClose={onClose}
      onSave={onSave}
    />
  );
};
