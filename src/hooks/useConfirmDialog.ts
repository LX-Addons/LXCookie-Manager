import { useState, useCallback } from "react";

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  variant: "danger" | "warning";
  onConfirm: () => void;
}

interface UseConfirmDialogReturn {
  confirmState: ConfirmState;
  showConfirm: (
    title: string,
    message: string,
    variant: "danger" | "warning",
    onConfirm: () => void
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
    (title: string, message: string, variant: "danger" | "warning", onConfirm: () => void) => {
      setConfirmState({ isOpen: true, title, message, variant, onConfirm });
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
