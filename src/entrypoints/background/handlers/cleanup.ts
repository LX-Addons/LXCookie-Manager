import type { CleanupExecutionResult, CleanupTrigger, ApiResponse, Settings } from "@/types";
import { CookieClearType, ErrorCode } from "@/types";
import { cleanupExecutor, type CleanupOverrides } from "../services/cleanup-executor";
import { SettingsMigrator } from "../services/settings-migrator";
import {
  getGlobalCleanupQueue,
  CleanupQueueError,
  type CleanupQueueErrorCode,
} from "@/lib/distributed-lock";

const QUEUE_ERROR_MAP: Record<CleanupQueueErrorCode, { code: ErrorCode; message: string }> = {
  QUEUE_FULL: {
    code: ErrorCode.QUEUE_FULL,
    message: "Cleanup queue is full, please try again later",
  },
  GLOBAL_HARD_CAP_REACHED: {
    code: ErrorCode.QUEUE_FULL,
    message: "Global queue limit reached, please try again later",
  },
  TASK_EXPIRED: {
    code: ErrorCode.TASK_EXPIRED,
    message: "Cleanup task expired, please try again",
  },
  LOCK_RETRY_FAILED: {
    code: ErrorCode.LOCK_RETRY_FAILED,
    message: "Failed to acquire cleanup lock after retries",
  },
  TASK_EVICTED: {
    code: ErrorCode.QUEUE_FULL,
    message: "Task was evicted by higher priority task",
  },
  QUEUE_CLEARED: {
    code: ErrorCode.QUEUE_CLEARED,
    message: "Queue was cleared, please try again",
  },
};

function mapQueueError(error: unknown): { code: ErrorCode; message: string } {
  if (error instanceof CleanupQueueError) {
    const mapped = QUEUE_ERROR_MAP[error.code];
    if (mapped) return mapped;
  }
  return { code: ErrorCode.INTERNAL_ERROR, message: "Cleanup queue error" };
}

export class CleanupHandler {
  private readonly settingsMigrator: SettingsMigrator;

  constructor(settingsMigrator: SettingsMigrator) {
    this.settingsMigrator = settingsMigrator;
  }

  async cleanupByDomain(
    domain: string,
    trigger: CleanupTrigger,
    settings: Settings,
    options?: {
      clearType?: CookieClearType;
      clearCache?: boolean;
      clearLocalStorage?: boolean;
      clearIndexedDB?: boolean;
    }
  ): Promise<ApiResponse<CleanupExecutionResult>> {
    try {
      const queue = getGlobalCleanupQueue();
      const result = await queue.enqueue(async () => {
        return await cleanupExecutor.executeByDomain(
          domain,
          trigger,
          settings,
          options as CleanupOverrides
        );
      }, "manual");

      if (result.success) {
        return { success: true, data: result.data };
      }
      return {
        success: false,
        error: {
          code: result.error?.code || ErrorCode.INTERNAL_ERROR,
          message: result.error?.message || "Unknown error",
        },
      };
    } catch (error) {
      const { code, message } = mapQueueError(error);

      return {
        success: false,
        error: {
          code,
          message,
        },
      };
    }
  }

  async cleanupWithFilter(
    filterType: "all" | "domain" | "domain-list",
    filterValue: string | undefined,
    domainList: string[] | undefined,
    trigger: CleanupTrigger,
    settings: Settings,
    options?: {
      clearType?: CookieClearType;
      clearCache?: boolean;
      clearLocalStorage?: boolean;
      clearIndexedDB?: boolean;
    }
  ): Promise<ApiResponse<CleanupExecutionResult>> {
    try {
      const queue = getGlobalCleanupQueue();
      const result = await queue.enqueue(async () => {
        return await cleanupExecutor.executeWithFilter(
          filterType,
          filterValue,
          domainList,
          trigger,
          settings,
          options as CleanupOverrides
        );
      }, "manual");

      if (result.success) {
        return { success: true, data: result.data };
      }
      return {
        success: false,
        error: {
          code: result.error?.code || ErrorCode.INTERNAL_ERROR,
          message: result.error?.message || "Unknown error",
        },
      };
    } catch (error) {
      const { code, message } = mapQueueError(error);

      return {
        success: false,
        error: {
          code,
          message,
        },
      };
    }
  }
}
