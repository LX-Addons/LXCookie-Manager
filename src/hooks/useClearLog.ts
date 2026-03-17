import { useRef, useCallback } from "react";
import { useStorage } from "@/hooks/useStorage";
import { CLEAR_LOG_KEY, LOG_RETENTION_MAP } from "@/lib/store";
import { LogRetention } from "@/types";
import type { ClearLogEntry, CookieClearType } from "@/types";

export function useClearLog() {
  const [, setLogs] = useStorage<ClearLogEntry[]>(CLEAR_LOG_KEY, []);
  const logIdCounterRef = useRef<number>(0);

  const addLog = useCallback(
    (
      domain: string,
      cookieType: CookieClearType,
      count: number,
      logRetention: LogRetention,
      action: "clear" | "edit" | "delete" | "import" | "export" = "clear",
      details?: string
    ) => {
      logIdCounterRef.current += 1;
      const timestamp = Date.now();
      const newLog: ClearLogEntry = {
        id: `${timestamp}-${logIdCounterRef.current}`,
        domain,
        cookieType,
        count,
        timestamp,
        action,
        details,
      };

      if (logRetention === LogRetention.FOREVER) {
        setLogs((prev) => [newLog, ...(prev ?? [])]);
        return;
      }

      const now = Date.now();
      const retentionMs = LOG_RETENTION_MAP[logRetention] || 7 * 24 * 60 * 60 * 1000;
      setLogs((prev) => {
        const currentPrev = prev ?? [];
        const filteredLogs = currentPrev.filter((log) => now - log.timestamp <= retentionMs);
        return [newLog, ...filteredLogs];
      });
    },
    [setLogs]
  );

  return { addLog };
}
