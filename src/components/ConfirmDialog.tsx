import { useEffect, useRef, useId, useCallback } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Icon } from "./Icon";

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
  readonly triggerElement?: HTMLElement | null;
}

const iconNameMap: Record<string, "alertCircle" | "alertTriangle" | "info" | "checkCircle"> = {
  danger: "alertCircle",
  warning: "alertTriangle",
  info: "info",
  success: "checkCircle",
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
  triggerElement,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const bodyId = useId();
  const isClosingRef = useRef(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const iconName = iconNameMap[variant];
  let confirmButtonClass: string;
  if (variant === "danger") {
    confirmButtonClass = "btn-danger";
  } else if (variant === "warning") {
    confirmButtonClass = "btn-warning";
  } else if (variant === "success") {
    confirmButtonClass = "btn-success";
  } else {
    confirmButtonClass = "btn-primary";
  }

  const handleClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    onCancel();
  }, [onCancel]);

  const handleConfirm = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    onConfirm();
  }, [onConfirm]);

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
        if (variant === "danger") {
          cancelButtonRef.current?.focus();
        } else {
          confirmButtonRef.current?.focus();
        }
      });
    } else if (!isOpen && dialog.open) {
      const focusTarget = previousFocusRef.current;
      dialog.close();
      requestAnimationFrame(() => {
        focusTarget?.focus();
      });
    }
  }, [isOpen, triggerElement, variant]);

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

  const describedByIds = description ? `${descriptionId} ${bodyId}` : bodyId;

  return (
    <dialog
      ref={dialogRef}
      className="confirm-modal"
      aria-labelledby={titleId}
      aria-describedby={describedByIds}
    >
      <div className="modal-header">
        <div className={`modal-icon ${variant}`}>
          <Icon name={iconName} size={20} />
        </div>
        <div className="modal-title-section">
          <h3 id={titleId} className="modal-title">
            {title}
          </h3>
          {description && (
            <p id={descriptionId} className="modal-description">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="modal-body">
        <p id={bodyId} className="modal-body-text">
          {message}
        </p>
      </div>
      <div className="modal-actions">
        <button ref={cancelButtonRef} className="btn btn-secondary" onClick={handleClose}>
          {cancelText ?? t("common.cancel")}
        </button>
        <button
          ref={confirmButtonRef}
          className={`btn ${confirmButtonClass}`}
          onClick={handleConfirm}
        >
          {confirmText ?? t("common.confirm")}
        </button>
      </div>
    </dialog>
  );
}
