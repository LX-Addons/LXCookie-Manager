import { useState, useCallback, useRef, useMemo } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  ConfirmDialogContext,
  type ConfirmVariant,
  type ConfirmOptions,
} from "./ConfirmDialogContext";

interface ConfirmState {
  readonly isOpen: boolean;
  readonly title: string;
  readonly description?: string;
  readonly message: string;
  readonly confirmText?: string;
  readonly cancelText?: string;
  readonly variant: ConfirmVariant;
  readonly onConfirm: () => void | Promise<void>;
  readonly triggerElement?: HTMLElement | null;
}

interface ConfirmDialogProviderProps {
  children: React.ReactNode;
}

export const ConfirmDialogProvider = ({ children }: ConfirmDialogProviderProps) => {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    title: "",
    message: "",
    variant: "warning",
    onConfirm: () => {},
  });

  const executedRef = useRef(false);
  const dialogSessionRef = useRef(0);

  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      variant: ConfirmVariant,
      onConfirm: () => void | Promise<void>,
      options?: ConfirmOptions
    ) => {
      executedRef.current = false;
      dialogSessionRef.current += 1;
      setState({
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
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleConfirm = useCallback(() => {
    if (executedRef.current) {
      return;
    }
    executedRef.current = true;
    const sessionId = dialogSessionRef.current;
    void Promise.resolve()
      .then(() => state.onConfirm())
      .catch((err) => {
        console.error("ConfirmDialog onConfirm error:", err);
      })
      .finally(() => {
        if (dialogSessionRef.current === sessionId) {
          closeConfirm();
        }
      });
  }, [state, closeConfirm]);

  const contextValue = useMemo(() => ({ showConfirm }), [showConfirm]);

  return (
    <ConfirmDialogContext.Provider value={contextValue}>
      {children}
      <ConfirmDialog
        isOpen={state.isOpen}
        title={state.title}
        description={state.description}
        message={state.message}
        confirmText={state.confirmText}
        cancelText={state.cancelText}
        variant={state.variant}
        onConfirm={handleConfirm}
        onCancel={closeConfirm}
        triggerElement={state.triggerElement}
      />
    </ConfirmDialogContext.Provider>
  );
};
