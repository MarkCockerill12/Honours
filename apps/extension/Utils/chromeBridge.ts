// Chrome API Bridge for dev and extension contexts
// This allows the UI to communicate with Chrome APIs whether in an iframe, 
// a dedicated extension popup, or a dev tab on localhost.

let _bridgeReady = false;
let _extensionId: string | null = null;
let _isInExtensionIframe = typeof window !== 'undefined' && window.self !== window.top;

export const env = {
  requestIdCounter: 0,
  pendingRequests: new Map<number, (response: any) => void>(),
  get bridgeReady() { 
    return _bridgeReady || (typeof window !== 'undefined' && !!_extensionId); 
  },
  set bridgeReady(v) { _bridgeReady = v; },
  get isInExtensionIframe() { return _isInExtensionIframe; },
  set isInExtensionIframe(v) { _isInExtensionIframe = v; },
  get extensionId() { return _extensionId; }
};

export const setIsInExtensionIframe = (inIframe: boolean) => {
  _isInExtensionIframe = inIframe;
};

// Listen for messages from parent or from content script discovery
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (!event.data || typeof event.data !== 'object') return;
    
    // 1. Discovery of Extension ID (Dev Mode)
    if (event.data.type === 'SET_EXTENSION_ID') {
      console.log('[Chrome Bridge] Extension ID discovered:', event.data.id);
      _extensionId = event.data.id;
      return;
    }

    const { action, requestId, tabs, response, error, available } = event.data;
    
    // 2. Iframe Bridge Ready
    if (action === 'CHROME_BRIDGE_READY') {
      console.log('[Chrome Bridge] Iframe bridge is ready');
      _bridgeReady = true;
    }

    // 3. Response Handling
    if (requestId !== undefined) {
      const callback = env.pendingRequests.get(requestId);
      if (callback) {
        if (action === 'QUERY_TABS_RESPONSE') callback({ tabs, error });
        else if (action === 'SEND_MESSAGE_RESPONSE') callback({ response, error });
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
    
    return new Promise(async (resolve, reject) => {
        // Track callback
        env.pendingRequests.set(requestId, resolve);

        // a) If direct external sendMessage is available (Dev Mode on localhost)
        if (_extensionId && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            try {
                const response = await chrome.runtime.sendMessage(_extensionId, { action, ...data });
                env.pendingRequests.delete(requestId);
                resolve(response);
                return;
            } catch (e) {
                console.warn('[Chrome Bridge] External sendMessage failed, falling back...');
            }
        }

        // b) If in Iframe, use postMessage to parent
        if (env.isInExtensionIframe && window.parent) {
            window.parent.postMessage({ action, requestId, data }, '*');
        } else {
            // No bridge available
            env.pendingRequests.delete(requestId);
            resolve({ success: false, error: 'No bridge available', mock: true });
        }
    });
}

export const chromeBridge = {
  isAvailable(): boolean {
    if (env.isInExtensionIframe || _extensionId) return true;
    if (typeof chrome !== 'undefined' && chrome?.tabs) return true;
    return false;
  },
  
  async queryTabs(query: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
    console.log('[Chrome Bridge] queryTabs called');
    
    // 1. Direct Extension Context
    if (typeof chrome !== 'undefined' && chrome?.tabs?.query && !env.isInExtensionIframe) {
      return new Promise((r) => chrome.tabs.query(query, r));
    }
    
    // 2. Bridge/External Mode
    await waitForBridge();
    const result = await callBackground('QUERY_TABS', { query });
    return result.tabs || (result.success ? [] : [{ id: 1, url: 'http://localhost', active: true } as any]);
  },
  
  async sendMessage(tabId: number, message: any): Promise<any> {
    console.log('[Chrome Bridge] sendMessage to tab:', tabId);

    // 1. Direct Extension Context
    if (typeof chrome !== 'undefined' && chrome?.tabs?.sendMessage && !env.isInExtensionIframe) {
      return new Promise((r) => chrome.tabs.sendMessage(tabId, message, r));
    }

    // 2. Bridge/External Mode
    await waitForBridge();
    const result = await callBackground('SEND_MESSAGE', { tabId, message });
    return result?.response || result;
  }
};
