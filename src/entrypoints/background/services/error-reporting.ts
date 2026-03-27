import { ErrorCode, ExtensionErrorReport } from "@/types";
import { metricsService } from "./metrics";

const errorHistory: ExtensionErrorReport[] = [];
const MAX_ERROR_HISTORY = 100;

export const reportBackgroundError = (
  code: ErrorCode | string,
  operation: string,
  message: string,
  options?: {
    trigger?: string;
    domain?: string;
    recoverable?: boolean;
    originalError?: unknown;
  }
): ExtensionErrorReport => {
  const report: ExtensionErrorReport = {
    code,
    operation,
    message,
    trigger: options?.trigger,
    domain: options?.domain,
    recoverable: options?.recoverable ?? true,
    timestamp: Date.now(),
    originalError: options?.originalError,
  };

  console.error(`[${report.code}] ${report.operation}: ${report.message}`, {
    trigger: report.trigger,
    domain: report.domain,
    recoverable: report.recoverable,
    originalError: report.originalError,
  });

  errorHistory.push(report);
  if (errorHistory.length > MAX_ERROR_HISTORY) {
    errorHistory.shift();
  }

  metricsService.recordError(operation, String(code), 0, {
    domain: options?.domain,
    trigger: options?.trigger,
    metadata: { message },
  });

  return report;
};

export const getErrorHistory = (): ExtensionErrorReport[] => {
  return [...errorHistory];
};

export const clearErrorHistory = (): void => {
  errorHistory.length = 0;
};

export const isPermissionDeniedError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const lowerMessage = error.message.toLowerCase();
    return (
      lowerMessage.includes("permission") ||
      lowerMessage.includes("access denied") ||
      lowerMessage.includes("not allowed")
    );
  }
  return false;
};

const classifyOperationError = (operation: string): ErrorCode => {
  if (operation.includes("cookie") && operation.includes("remove")) {
    return ErrorCode.COOKIE_REMOVE_FAILED;
  }
  if (operation.includes("cookie") && operation.includes("create")) {
    return ErrorCode.COOKIE_CREATE_FAILED;
  }
  if (operation.includes("cookie") && operation.includes("update")) {
    return ErrorCode.COOKIE_UPDATE_FAILED;
  }
  if (operation.includes("browsingData")) {
    return ErrorCode.BROWSING_DATA_FAILED;
  }
  if (operation.includes("storage") && operation.includes("read")) {
    return ErrorCode.STORAGE_READ_FAILED;
  }
  if (operation.includes("storage") && operation.includes("write")) {
    return ErrorCode.STORAGE_WRITE_FAILED;
  }
  if (operation.includes("tab")) {
    return ErrorCode.TAB_QUERY_FAILED;
  }
  return ErrorCode.INTERNAL_ERROR;
};

export const classifyError = (
  error: unknown,
  operation: string,
  options?: { trigger?: string; domain?: string }
): ExtensionErrorReport => {
  let code: ErrorCode;
  let message: string;
  let recoverable = true;

  if (error instanceof Error) {
    message = error.message;
    if (isPermissionDeniedError(error)) {
      code = ErrorCode.INSUFFICIENT_PERMISSIONS;
      recoverable = false;
    } else {
      code = classifyOperationError(operation);
    }
  } else {
    message = String(error);
    code = ErrorCode.INTERNAL_ERROR;
  }

  return reportBackgroundError(code, operation, message, {
    ...options,
    recoverable,
    originalError: error,
  });
};
