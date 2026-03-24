import type { CleanupExecutionResult, CleanupTrigger, Settings } from "@/types";
import { CookieClearType, CleanupError, CleanupStage, ErrorCode } from "@/types";
import { runCleanup, runCleanupWithFilter } from "@/utils/cleanup/cleanup-runner";
import { isCookieDomainMatch } from "@/utils/domain";
import { metricsService } from "@/entrypoints/background/services/metrics";
import { logService } from "@/entrypoints/background/services/log-service";
import { classifyError } from "@/entrypoints/background/services/error-reporting";

export interface CleanupOptions {
  clearType?: CookieClearType;
  clearCache?: boolean;
  clearLocalStorage?: boolean;
  clearIndexedDB?: boolean;
}

export interface CleanupResult {
  success: boolean;
  data?: CleanupExecutionResult;
  error?: { code: ErrorCode; message: string };
  durationMs: number;
}

const getCleanupOperation = (error: unknown, baseOperation: string): string => {
  if (error instanceof CleanupError) {
    if (error.stage === CleanupStage.COOKIES) {
      return `${baseOperation} cookie remove`;
    }
    if (
      error.stage === CleanupStage.CACHE ||
      error.stage === CleanupStage.LOCAL_STORAGE ||
      error.stage === CleanupStage.INDEXED_DB ||
      error.stage === CleanupStage.STORAGE
    ) {
      return `${baseOperation} browsingData`;
    }
  }
  return baseOperation;
};

class CleanupExecutorImpl {
  private safeRecordCleanup(...args: Parameters<typeof metricsService.recordCleanup>): void {
    try {
      metricsService.recordCleanup(...args);
    } catch {
      // best-effort: do not fail cleanup flow
    }
  }

  private async safeLogCleanup(...args: Parameters<typeof logService.logCleanup>): Promise<void> {
    try {
      await logService.logCleanup(...args);
    } catch {
      // best-effort: do not fail cleanup flow
    }
  }

  async executeByDomain(
    domain: string,
    trigger: CleanupTrigger,
    settings: Settings,
    options: CleanupOptions = {}
  ): Promise<CleanupResult> {
    const startTime = Date.now();
    try {
      const result = await runCleanup({
        domain,
        trigger,
        settings,
        ...options,
      });

      this.safeRecordCleanup("cleanupByDomain", result.success, result.durationMs, {
        domain,
        trigger,
        metadata: {
          cookiesRemoved: result.cookiesRemoved,
          matchedDomains: result.matchedDomains.length,
        },
      });

      if (result.success && result.cookiesRemoved > 0) {
        await this.safeLogCleanup(
          domain,
          options.clearType || CookieClearType.ALL,
          result.cookiesRemoved,
          trigger
        );
      }

      return { success: true, data: result, durationMs: result.durationMs };
    } catch (e) {
      const durationMs = Date.now() - startTime;
      const operation = getCleanupOperation(e, "cleanupByDomain");
      const errorReport = classifyError(e, operation, { domain, trigger });
      this.safeRecordCleanup("cleanupByDomain", false, durationMs, {
        domain,
        trigger,
        metadata: {
          error: e instanceof Error ? e.message : "Unknown error",
        },
      });
      return {
        success: false,
        error: { code: errorReport.code as ErrorCode, message: errorReport.message },
        durationMs,
      };
    }
  }

  async executeWithFilter(
    filterType: "all" | "domain" | "domain-list",
    filterValue: string | undefined,
    domainList: string[] | undefined,
    trigger: CleanupTrigger,
    settings: Settings,
    options: CleanupOptions = {}
  ): Promise<CleanupResult> {
    const startTime = Date.now();

    let filterFn: (domain: string) => boolean;

    switch (filterType) {
      case "all":
        filterFn = () => true;
        break;
      case "domain":
        if (!filterValue?.trim()) {
          return {
            success: false,
            error: {
              code: ErrorCode.INVALID_PARAMETERS,
              message: "filterValue is required when filterType is 'domain'",
            },
            durationMs: 0,
          };
        }
        filterFn = (domain) => isCookieDomainMatch(domain, filterValue);
        break;
      case "domain-list":
        if (!domainList?.length) {
          return {
            success: false,
            error: {
              code: ErrorCode.INVALID_PARAMETERS,
              message: "domainList is required when filterType is 'domain-list'",
            },
            durationMs: 0,
          };
        }
        filterFn = (domain) =>
          domainList.some((listDomain) => isCookieDomainMatch(domain, listDomain));
        break;
      default:
        return {
          success: false,
          error: {
            code: ErrorCode.INVALID_PARAMETERS,
            message: `Invalid filterType: ${filterType}`,
          },
          durationMs: 0,
        };
    }

    try {
      let targetDomains: string[] | undefined;
      if (filterType === "domain" && filterValue) {
        targetDomains = [filterValue];
      } else if (filterType === "domain-list" && domainList) {
        targetDomains = domainList;
      }

      const result = await runCleanupWithFilter(
        filterFn,
        {
          trigger,
          settings,
          ...options,
        },
        targetDomains
      );

      this.safeRecordCleanup("cleanupWithFilter", result.success, result.durationMs, {
        trigger,
        metadata: {
          filterType,
          cookiesRemoved: result.cookiesRemoved,
          matchedDomains: result.matchedDomains.length,
        },
      });

      if (result.success && result.cookiesRemoved > 0) {
        await this.safeLogCleanup(
          result.matchedDomains,
          options.clearType || CookieClearType.ALL,
          result.cookiesRemoved,
          trigger
        );
      }

      return { success: true, data: result, durationMs: result.durationMs };
    } catch (e) {
      const durationMs = Date.now() - startTime;
      const operation = getCleanupOperation(e, "cleanupWithFilter");
      const errorReport = classifyError(e, operation, { trigger });
      this.safeRecordCleanup("cleanupWithFilter", false, durationMs, {
        trigger,
        metadata: {
          filterType,
          error: e instanceof Error ? e.message : "Unknown error",
        },
      });
      return {
        success: false,
        error: { code: errorReport.code as ErrorCode, message: errorReport.message },
        durationMs,
      };
    }
  }
}

export const cleanupExecutor = new CleanupExecutorImpl();
