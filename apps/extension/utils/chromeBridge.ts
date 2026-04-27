// Chrome API Bridge for dev and extension contexts
// This allows the UI to communicate with Chrome APIs whether in an iframe,
// a dedicated extension popup, or a dev tab on localhost.

let _bridgeReady = false;
let _extensionId: string | null = null;
let _isInExtensionIframe = false; // Initialized to false, will be detected later

// Removed unused imports BackgroundMessage, MessageAction as they are not used in this file but exported from types.ts

export const env = {
  requestIdCounter: 0,
  pendingRequests: new Map<number, (response: any) => void>(), // Keep any for bridge responses as they vary wildly
  isLocalhost: false,
  get bridgeReady() {
    return _bridgeReady || (typeof globalThis.window !== "undefined" && !!_extensionId);
  },
  set bridgeReady(v) {
    _bridgeReady = v;
  },
  get isInExtensionIframe() {
    return _isInExtensionIframe;
  },
  set isInExtensionIframe(v) {
    _isInExtensionIframe = v;
  },
  get extensionId() {
    return _extensionId;
  },
};

// Detect environment on load
if (globalThis !== undefined && globalThis.window !== undefined) {
  // Check if we are in an iframe
  try {
    env.isInExtensionIframe = globalThis.window !== globalThis.top;
  } catch (_error) {
    // If accessing globalThis.top throws an error (e.g., cross-origin iframe),
    // we assume it's an iframe.
    env.isInExtensionIframe = true;
  }

  // Check if running on localhost
  const url = globalThis.window.location.href;
  env.isLocalhost = url.includes("localhost") || url.includes("127.0.0.1");
}

export const setIsInExtensionIframe = (inIframe: boolean) => {
  _isInExtensionIframe = inIframe;
};

// Listen for messages from parent or from content script discovery
if (typeof globalThis.window !== "undefined") {
  globalThis.window.addEventListener("message", (event) => {
    if (!event.data || typeof event.data !== "object") return;

    // 0. Security: Origin Validation
    const isExtensionOrigin = event.origin.startsWith("chrome-extension://");
    const isDevOrigin = event.origin === "http://localhost:3000";
    if (!isExtensionOrigin && !isDevOrigin) {
      console.warn("[Chrome Bridge] Untrusted message origin:", event.origin);
      return;
    }

    // 1. Discovery of Extension ID (Dev Mode)
    if (event.data.type === "SET_EXTENSION_ID") {
      console.log("[Chrome Bridge] Extension ID discovered:", event.data.id);
      _extensionId = event.data.id;
      return;
    }

    const { action, requestId, tabs, response, error, available: _available } = event.data;

    // 2. Iframe Bridge Ready
    if (action === "CHROME_BRIDGE_READY") {
      console.log("[Chrome Bridge] Iframe bridge is ready");
      _bridgeReady = true;
    }

    // 3. Response Handling
    if (requestId !== undefined) {
      const callback = env.pendingRequests.get(requestId);
      if (callback) {
        if (action === "QUERY_TABS_RESPONSE") callback({ tabs, error });
        else if (action === "SEND_MESSAGE_RESPONSE")
          callback({ response, error });
        else callback(event.data);
        env.pendingRequests.delete(requestId);
      }
    }
  });
}

const waitForBridge = (): Promise<void> => {
  return new Promise((resolve) => {
    if (env.bridgeReady) {
      resolve();
      return;
    }

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (env.bridgeReady || attempts > 20) {
        clearInterval(interval);
        resolve();
      }
    }, 50);
  });
};

// Internal helper for sending messages to background
async function callBackground(action: string, data: any = {}): Promise<any> {
  const requestId = env.requestIdCounter++;

  return new Promise((resolve) => {
    // P1: Add 10-second timeout to prevent orphaned promises
    const timeoutId = setTimeout(() => {
      if (env.pendingRequests.has(requestId)) {
        console.warn(`[Chrome Bridge] Request ${requestId} (${action}) timed out after 10s.`);
        env.pendingRequests.delete(requestId);
        resolve({ success: false, error: "timeout" });
      }
    }, 10000);

    // Wrapper resolve to clear timeout
    const wrappedResolve = (response: any) => {
      clearTimeout(timeoutId);
      resolve(response);
    };

    // Track callback
    env.pendingRequests.set(requestId, wrappedResolve);

    // a) If direct external sendMessage is available (Dev Mode on localhost)
    if (
      _extensionId &&
      typeof chrome !== "undefined" &&
      chrome.runtime?.sendMessage
    ) {
      chrome.runtime.sendMessage(_extensionId, {
        action,
        ...data,
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.debug("[Chrome Bridge] callBackground caught runtime error:", chrome.runtime.lastError.message);
          env.pendingRequests.delete(requestId);
          wrappedResolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          env.pendingRequests.delete(requestId);
          wrappedResolve(response);
        }
      });
      return;
    }

    // b) If in Iframe, use postMessage to parent
    if (env.isInExtensionIframe && globalThis?.parent) {
      // Security: Use specific target origin if known
      let targetOrigin = "*";
      if (_extensionId) {
        targetOrigin = `chrome-extension://${_extensionId}`;
      } else if (!env.isLocalhost) {
        targetOrigin = globalThis?.location?.origin ?? "*";
      }
      globalThis?.parent?.postMessage({ action, requestId, data }, targetOrigin);
    } else {
      // No bridge available
      env.pendingRequests.delete(requestId);
      wrappedResolve({ success: false, error: "No bridge available" });
    }
  });
}

export const chromeBridge = {
  isAvailable(): boolean {
    // 1. Native extension environment (popup/options)
    if (typeof chrome !== "undefined" && chrome?.runtime?.id) {
      return true;
    }
    // 2. Iframe Dev environment
    if (env.isInExtensionIframe || _extensionId) {
      return true;
    }
    return false;
  },

  async queryTabs(query: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
    console.log("[Chrome Bridge] queryTabs called");

    // 1. Native Extension Context
    if (typeof chrome !== "undefined" && chrome?.tabs?.query && !env.isInExtensionIframe) {
      return new Promise((r) => {
        chrome.tabs.query(query, (tabs) => {
          if (chrome.runtime.lastError) {
            console.warn("[Chrome Bridge] queryTabs error:", chrome.runtime.lastError.message);
            r([]);
          } else {
            r(tabs || []);
          }
        });
      });
    }

    // 2. Dev Bridge/External Mode
    await waitForBridge();
    const result = await callBackground("QUERY_TABS", { query });
    return result.tabs || [];
  },

  async sendMessage(tabId: number | undefined, message: any): Promise<any> {
    console.log("[Chrome Bridge] sendMessage:", message.action);

    // 1. Native Extension Context (Send to background script from popup)
    if (typeof chrome !== "undefined" && chrome.runtime?.id && !env.isInExtensionIframe) {
      const isContentAction = [
        "TRANSLATE_PAGE",
        "CLEAR_TRANSLATIONS",
        "SCAN_PAGE_LINKS",
        "APPLY_FILTERS",
        "CLEAR_FILTERS",
        "GET_PAGE_TEXT"
      ].includes(message.action);

      if (isContentAction && tabId !== undefined) {
        return new Promise((r) => {
          try {
            chrome.tabs.sendMessage(tabId, message, (response) => {
                const err = chrome.runtime.lastError;
                if (err) {
                  const msg = err.message || "";
                  if (msg.includes("Could not establish connection") || msg.includes("Receiving end does not exist")) {
                    console.debug("[Chrome Bridge] Content ready-check (silenced):", msg);
                    r({ success: false, error: "not_ready" });
                  } else if (msg.includes("context invalidated")) {
                    console.warn("[Chrome Bridge] Context invalidated:", msg);
                    r({ success: false, error: "Extension updated. Please refresh the page." });
                  } else {
                    console.warn(`[Chrome Bridge] sendMessage(${message.action}) error:`, msg);
                    r({ success: false, error: msg });
                  }
                } else {
                  r(response);
                }
            });
          } catch (error) {
            console.warn(`[Chrome Bridge] sendMessage(${message.action}) failed:`, error);
            r({ success: false, error: "context_invalidated" });
          }
        });
      } else {
        return new Promise((r) => {
          try {
            chrome.runtime.sendMessage(message, (response) => {
              const err = chrome.runtime.lastError;
              if (err) {
                const msg = err.message || "";
                if (msg.includes("Could not establish connection") || msg.includes("Receiving end does not exist")) {
                  console.debug("[Chrome Bridge] Runtime not ready (silenced):", msg);
                  r({ success: false, error: "not_ready" });
                } else {
                  console.warn("[Chrome Bridge] runtime.sendMessage error:", msg);
                  r({ success: false, error: msg });
                }
              } else {
                r(response);
              }
            });
          } catch (error) {
            console.warn("[Chrome Bridge] runtime.sendMessage failed:", error);
            r({ success: false, error: "context_invalidated" });
          }
        });
      }
    }

    // 2. Dev Bridge/External Mode
    await waitForBridge();
    const result = await callBackground("SEND_MESSAGE", { tabId, message });
    return result?.response || result;
  },
};
