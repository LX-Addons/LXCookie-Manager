import { useRef, useEffect, useCallback } from "react";

export interface UseDialogOptions {
  isOpen: boolean;
  onClose: () => void;
  triggerElement?: HTMLElement | null;
  onOpenFocus?: () => void;
}

export function useDialog({ isOpen, onClose, triggerElement, onOpenFocus }: UseDialogOptions) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isClosingRef = useRef(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    onClose();
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      isClosingRef.current = false;
      previousFocusRef.current = triggerElement || (document.activeElement as HTMLElement);
      dialog.showModal();
      requestAnimationFrame(() => {
        onOpenFocus?.();
      });
    } else if (!isOpen && dialog.open) {
      const focusTarget = previousFocusRef.current;
      isClosingRef.current = true;
      dialog.close();
      requestAnimationFrame(() => {
        focusTarget?.focus();
      });
    }
  }, [isOpen, triggerElement, onOpenFocus]);

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
      isClosingRef.current = true;
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

  return {
    dialogRef,
    handleClose,
  };
}
