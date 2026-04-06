let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let hasPendingChanges = false;
const DEBOUNCE_MS = 100;
let isListenerSetup = false;

export function setupCookieChangeListener(): void {
  if (isListenerSetup) {
    console.debug("[CookieListener] Listener already setup, skipping");
    return;
  }
  isListenerSetup = true;

  browser.cookies.onChanged.addListener(() => {
    try {
      hasPendingChanges = true;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        if (hasPendingChanges) {
          hasPendingChanges = false;
          browser.runtime
            .sendMessage({
              type: "cookieChanged",
            })
            .catch((error) => {
              console.debug("Failed to send cookie change message:", error);
            });
        }
        debounceTimer = null;
      }, DEBOUNCE_MS);
    } catch (error) {
      console.debug("Failed to send cookie change notification:", error);
    }
  });
}
