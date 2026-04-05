import { useRef, useId, useCallback } from "react";
import { useTranslation, useDialog } from "@/hooks";
import { Icon } from "./Icon";

interface ConfirmDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly description?: string;
  readonly message: string;
  readonly confirmText?: string;
  readonly cancelText?: string;
  readonly onConfirm: () => void | Promise<void>;
  readonly onCancel: () => void;
  readonly variant?: "danger" | "warning" | "info" | "success";
  readonly triggerElement?: HTMLElement | null;
  readonly isLoading?: boolean;
}

const iconNameMap: Record<
  NonNullable<ConfirmDialogProps["variant"]>,
  "alertCircle" | "alertTriangle" | "info" | "checkCircle"
> = {
  danger: "alertCircle",
  warning: "alertTriangle",
  info: "info",
  success: "checkCircle",
};

const buttonClassMap: Record<NonNullable<ConfirmDialogProps["variant"]>, string> = {
  danger: "btn-danger",
  warning: "btn-warning",
  info: "btn-primary",
  success: "btn-success",
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
  isLoading = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const bodyId = useId();

  const handleOpenFocus = useCallback(() => {
    if (variant === "danger") {
      cancelButtonRef.current?.focus();
    } else {
      confirmButtonRef.current?.focus();
    }
  }, [variant]);

  const { dialogRef, handleClose } = useDialog({
    isOpen,
    onClose: onCancel,
    triggerElement,
    onOpenFocus: handleOpenFocus,
    closeOnOutsideClick: !isLoading,
    closeOnEsc: !isLoading,
  });

  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  const describedByIds = description ? `${descriptionId} ${bodyId}` : bodyId;
  const iconName = iconNameMap[variant];
  const confirmButtonClass = buttonClassMap[variant];

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
        <button
          ref={cancelButtonRef}
          className="btn btn-secondary"
          onClick={handleClose}
          disabled={isLoading}
        >
          {cancelText ?? t("common.cancel")}
        </button>
        <button
          ref={confirmButtonRef}
          className={`btn ${confirmButtonClass}`}
          onClick={handleConfirm}
          disabled={isLoading}
        >
          {confirmText ?? t("common.confirm")}
        </button>
      </div>
    </dialog>
  );
}
