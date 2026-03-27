import { useState, useCallback } from "react";

export type ConfirmVariant = "danger" | "warning" | "info" | "success";

export interface ConfirmOptions {
  description?: string;
  confirmText?: string;
  cancelText?: string;
  triggerElement?: HTMLElement | null;
}

interface ConfirmState {
  isOpen: boolean;
  title: string;
  description?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant: ConfirmVariant;
  onConfirm: () => void;
  triggerElement?: HTMLElement | null;
}

interface UseConfirmDialogReturn {
  confirmState: ConfirmState;
  showConfirm: (
    title: string,
    message: string,
    variant: ConfirmVariant,
    onConfirm: () => void,
    options?: ConfirmOptions
  ) => void;
  closeConfirm: () => void;
  handleConfirm: () => void;
}

export const useConfirmDialog = (): UseConfirmDialogReturn => {
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    title: "",
    message: "",
    variant: "warning",
    onConfirm: () => {},
  });

  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      variant: ConfirmVariant,
      onConfirm: () => void,
      options?: ConfirmOptions
    ) => {
      setConfirmState({
        isOpen: true,
        title,
        message,
        variant,
        onConfirm,
        description: options?.description,
        confirmText: options?.confirmText,
        cancelText: options?.cancelText,
        triggerElement: options?.triggerElement,
      });
    },
    []
  );

  const closeConfirm = useCallback(() => {
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleConfirm = useCallback(() => {
    confirmState.onConfirm();
    closeConfirm();
  }, [confirmState, closeConfirm]);

  return { confirmState, showConfirm, closeConfirm, handleConfirm };
};
