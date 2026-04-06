let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingChanges: Array<{
  removed: boolean;
  cookie: chrome.cookies.Cookie;
  cause: string;
}> = [];
const DEBOUNCE_MS = 100;

export function setupCookieChangeListener(): void {
  browser.cookies.onChanged.addListener((changeInfo) => {
    try {
      pendingChanges.push({
        removed: changeInfo.removed,
        cookie: changeInfo.cookie as chrome.cookies.Cookie,
        cause: changeInfo.cause,
      });
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        const changes = [...pendingChanges];
        pendingChanges = [];
        browser.runtime
          .sendMessage({
            type: "cookieChanged",
            payload: changes,
          })
          .catch((error) => {
            console.debug("Failed to send cookie change message:", error);
          });
        debounceTimer = null;
      }, DEBOUNCE_MS);
    } catch (error) {
      console.debug("Failed to send cookie change notification:", error);
    }
  });
}
