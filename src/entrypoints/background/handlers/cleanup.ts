import type { CleanupExecutionResult, CleanupTrigger, ApiResponse, Settings } from "@/types";
import { CookieClearType, ErrorCode } from "@/types";
import { cleanupExecutor, type CleanupOptions } from "../services/cleanup-executor";
import { SettingsMigrator } from "../services/settings-migrator";

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
    const result = await cleanupExecutor.executeByDomain(
      domain,
      trigger,
      settings,
      options as CleanupOptions
    );

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
    const result = await cleanupExecutor.executeWithFilter(
      filterType,
      filterValue,
      domainList,
      trigger,
      settings,
      options as CleanupOptions
    );

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
  }
}
