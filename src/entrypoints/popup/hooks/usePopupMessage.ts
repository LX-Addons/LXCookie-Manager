import { useState, useCallback, useRef, useEffect } from "react";
import { MESSAGE_DURATION } from "@/lib/constants";

interface PopupMessageState {
  text: string;
  isError: boolean;
  visible: boolean;
}

interface UsePopupMessageReturn {
  message: PopupMessageState;
  showMessage: (text: string, isError?: boolean) => void;
}

export const usePopupMessage = (): UsePopupMessageReturn => {
  const [message, setMessage] = useState<PopupMessageState>({
    text: "",
    isError: false,
    visible: false,
  });
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMessage = useCallback((text: string, isError = false) => {
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current);
    }
    setMessage({ text, isError, visible: true });
    messageTimerRef.current = setTimeout(
      () => setMessage((prev) => ({ ...prev, visible: false })),
      MESSAGE_DURATION
    );
  }, []);

  useEffect(() => {
    return () => {
      if (messageTimerRef.current) {
        clearTimeout(messageTimerRef.current);
      }
    };
  }, []);

  return { message, showMessage };
};
