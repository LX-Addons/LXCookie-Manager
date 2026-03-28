import { useRef, useId, useCallback, useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Icon } from "./Icon";
import { useDialog } from "@/hooks/useDialog";

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

const iconNameMap: Record<
  NonNullable<ConfirmDialogProps["variant"]>,
  "alertCircle" | "alertTriangle" | "info" | "checkCircle"
> = {
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
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const bodyId = useId();
  const isClosingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      isClosingRef.current = false;
    }
  }, [isOpen]);

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

  const handleConfirm = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    onConfirm();
  }, [onConfirm]);

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
  });

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
