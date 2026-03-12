import { ReactNode } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

interface ConfirmDialogWrapperProps {
  children: (showConfirm: ShowConfirmFn) => ReactNode;
}

export type ShowConfirmFn = (
  title: string,
  message: string,
  variant: "danger" | "warning",
  onConfirm: () => void
) => void;

export const ConfirmDialogWrapper = ({ children }: ConfirmDialogWrapperProps) => {
  const { confirmState, showConfirm, closeConfirm, handleConfirm } = useConfirmDialog();

  return (
    <>
      {children(showConfirm)}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        variant={confirmState.variant}
        onConfirm={handleConfirm}
        onCancel={closeConfirm}
      />
    </>
  );
};
