import { useEffect, useRef, useId } from "react";
import { useTranslation } from "@/hooks/useTranslation";

interface ConfirmDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly description?: string;
  readonly message: string;
  readonly confirmText?: string;
  readonly cancelText?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly variant?: "danger" | "warning" | "info" | "success";
}

const getIconForVariant = (variant: string) => {
  switch (variant) {
    case "danger":
      return "!";
    case "warning":
      return "!";
    case "success":
      return "✓";
    case "info":
    default:
      return "i";
  }
};

export function ConfirmDialog({
  isOpen,
  title,
  description,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  variant = "warning",
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
      confirmBtnRef.current?.focus();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      if (isOpen) {
        onCancel();
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (e.target === dialog) {
        onCancel();
      }
    };

    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("click", handleClick);
    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("click", handleClick);
    };
  }, [isOpen, onCancel]);

  const getConfirmButtonClass = () => {
    switch (variant) {
      case "danger":
        return "btn-danger";
      case "success":
        return "btn-success";
      case "info":
        return "btn-primary";
      case "warning":
      default:
        return "btn-warning";
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="confirm-modal"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
    >
      <div className="modal-header">
        <div className={`modal-icon ${variant}`} aria-hidden="true">
          {getIconForVariant(variant)}
        </div>
        <div className="modal-title-section">
          <h3 id={titleId} className="modal-title">
            {title}
          </h3>
          {description && <p className="modal-description">{description}</p>}
        </div>
      </div>
      <div className="modal-body">
        <p id={bodyId} className="modal-body-text">
          {message}
        </p>
      </div>
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onCancel}>
          {cancelText ?? t("common.cancel")}
        </button>
        <button
          ref={confirmBtnRef}
          className={`btn ${getConfirmButtonClass()}`}
          onClick={onConfirm}
        >
          {confirmText ?? t("common.confirm")}
        </button>
      </div>
    </dialog>
  );
}
