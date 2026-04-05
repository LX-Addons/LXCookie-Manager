import { createContext, useContext } from "react";

/**
 * - Context: 暴露 showConfirm
 * - Provider: 管理 state + 防重
 * - Dialog: 仅 UI / focus / 透传回调
 * - confirm 触发后等待 onConfirm 异步完成再关闭对话框
 */

export type ConfirmVariant = "danger" | "warning" | "info" | "success";

export interface ConfirmOptions {
  description?: string;
  confirmText?: string;
  cancelText?: string;
  triggerElement?: HTMLElement | null;
}

interface ConfirmDialogContextValue {
  showConfirm: ShowConfirmFn;
}

export type ShowConfirmFn = (
  title: string,
  message: string,
  variant: ConfirmVariant,
  onConfirm: () => void | Promise<void>,
  options?: ConfirmOptions
) => void;

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

export const useConfirmDialogContext = (): ShowConfirmFn => {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    throw new Error("useConfirmDialogContext must be used within ConfirmDialogProvider");
  }
  return ctx.showConfirm;
};

export { ConfirmDialogContext };
