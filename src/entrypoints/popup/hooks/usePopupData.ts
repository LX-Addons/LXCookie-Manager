import { useState, useCallback, useRef, useEffect } from "react";
import { BackgroundService } from "@/lib/background-service";
import type {
  CookieStats,
  Cookie as CookieType,
  GetCurrentTabCookiesData,
  ApiResponse,
} from "@/types";
import { ErrorCode } from "@/types";
import { DEBOUNCE_DELAY_MS } from "@/lib/constants";
import { useTranslation } from "@/hooks";

export type LoadingState =
  | "idle"
  | "loading"
  | "domain-unavailable"
  | "load-failed"
  | "permission-denied";

interface UsePopupDataProps {
  onErrorMessage?: (text: string, isError?: boolean) => void;
}

interface UsePopupDataReturn {
  loadingState: LoadingState;
  stats: CookieStats;
  currentCookies: CookieType[];
  currentDomain: string;
  init: () => Promise<void>;
  updateStats: () => Promise<void>;
}

export function usePopupData({ onErrorMessage }: UsePopupDataProps = {}): UsePopupDataReturn {
  const [currentDomain, setCurrentDomain] = useState("");
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [stats, setStats] = useState<CookieStats>({
    total: 0,
    current: 0,
    session: 0,
    persistent: 0,
    thirdParty: 0,
    tracking: 0,
  });
  const [currentCookies, setCurrentCookies] = useState<CookieType[]>([]);
  const loadRequestIdRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onErrorMessageRef = useRef(onErrorMessage);

  useEffect(() => {
    onErrorMessageRef.current = onErrorMessage;
  }, [onErrorMessage]);

  const { t } = useTranslation();

  const resetPermissionDeniedState = useCallback(() => {
    setLoadingState("permission-denied");
    setCurrentDomain("");
    setStats({
      total: 0,
      current: 0,
      session: 0,
      persistent: 0,
      thirdParty: 0,
      tracking: 0,
    });
    setCurrentCookies([]);
  }, []);

  const handleCookiesResponseSuccess = useCallback(
    async (cookiesData: GetCurrentTabCookiesData, requestId: number, isInit: boolean) => {
      if (!cookiesData.domain) {
        setCurrentDomain("");
        setCurrentCookies([]);
        setStats({
          total: 0,
          current: 0,
          session: 0,
          persistent: 0,
          thirdParty: 0,
          tracking: 0,
        });
        setLoadingState("domain-unavailable");
        return;
      }

      const statsResponse = await BackgroundService.getStats(cookiesData.domain);
      if (requestId !== loadRequestIdRef.current) return;

      if (statsResponse.success && statsResponse.data) {
        setCurrentDomain(cookiesData.domain);
        setCurrentCookies(cookiesData.cookies);
        setStats(statsResponse.data);
        setLoadingState("idle");
      } else if (statsResponse.error?.code === ErrorCode.INSUFFICIENT_PERMISSIONS) {
        resetPermissionDeniedState();
      } else if (isInit) {
        setLoadingState("load-failed");
      } else {
        onErrorMessageRef.current?.(t("popup.updateStatsFailed"), true);
      }
    },
    [resetPermissionDeniedState, t]
  );

  const handleCookiesResponse = useCallback(
    async (
      cookiesResponse: ApiResponse<GetCurrentTabCookiesData>,
      requestId: number,
      isInit: boolean
    ) => {
      if (cookiesResponse.success && cookiesResponse.data) {
        await handleCookiesResponseSuccess(cookiesResponse.data, requestId, isInit);
      } else if (cookiesResponse.error?.code === ErrorCode.INSUFFICIENT_PERMISSIONS) {
        resetPermissionDeniedState();
      } else if (isInit) {
        setLoadingState("domain-unavailable");
        setCurrentDomain("");
        setStats({
          total: 0,
          current: 0,
          session: 0,
          persistent: 0,
          thirdParty: 0,
          tracking: 0,
        });
        setCurrentCookies([]);
      } else {
        onErrorMessageRef.current?.(t("popup.updateStatsFailed"), true);
      }
    },
    [handleCookiesResponseSuccess, resetPermissionDeniedState, t]
  );

  const loadStats = useCallback(
    async (options: { isInit: boolean }) => {
      const { isInit } = options;
      const requestId = ++loadRequestIdRef.current;
      try {
        if (isInit) {
          setLoadingState("loading");
        }
        const cookiesResponse = await BackgroundService.getCurrentTabCookies();
        if (requestId !== loadRequestIdRef.current) return;
        await handleCookiesResponse(cookiesResponse, requestId, isInit);
      } catch (e) {
        if (requestId !== loadRequestIdRef.current) return;
        console.error("Failed to load stats:", {
          error: e,
          isInit,
        });
        if (isInit) {
          setLoadingState("load-failed");
          setCurrentDomain("");
          setStats({
            total: 0,
            current: 0,
            session: 0,
            persistent: 0,
            thirdParty: 0,
            tracking: 0,
          });
          setCurrentCookies([]);
        } else {
          onErrorMessageRef.current?.(t("popup.updateStatsFailed"), true);
        }
      }
    },
    [handleCookiesResponse, t]
  );

  const init = useCallback(async () => {
    await loadStats({ isInit: true });
  }, [loadStats]);

  const updateStats = useCallback(async () => {
    await loadStats({ isInit: false });
  }, [loadStats]);

  useEffect(() => {
    const messageListener = (message: { type: string }) => {
      if (message.type === "cookieChanged") {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          updateStats();
        }, DEBOUNCE_DELAY_MS);
      }
    };

    browser.runtime.onMessage.addListener(messageListener);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      browser.runtime.onMessage.removeListener(messageListener);
    };
  }, [updateStats]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          updateStats();
        }, DEBOUNCE_DELAY_MS);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [updateStats]);

  return {
    loadingState,
    stats,
    currentCookies,
    currentDomain,
    init,
    updateStats,
  };
}
