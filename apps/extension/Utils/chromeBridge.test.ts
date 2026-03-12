import { describe, it, expect, vi, beforeEach } from "vitest";
import * as bridgeModule from "./chromeBridge";
const { chromeBridge, setIsInExtensionIframe, env } = bridgeModule;

describe("chromeBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset bridge state for tests
    bridgeModule.env.bridgeReady = true;
    bridgeModule.env.isInExtensionIframe = true;

    // Simulate being in an iframe for bridge tests (self !== top)
    const mockWindow = {
      self: { name: "iframe" },
      top: { name: "top" },
      parent: {
        postMessage: vi.fn((payload) => {
          setTimeout(() => {
            const callback = bridgeModule.env.pendingRequests.get(payload.requestId);
            if (callback) {
              if (payload.action === 'QUERY_TABS') {
                callback({ tabs: [{ id: 1, url: 'http://localhost' }] });
              } else {
                callback({ response: { success: false, mock: true } });
              }
              bridgeModule.env.pendingRequests.delete(payload.requestId);
            }
          }, 10);
        }),
      },
      addEventListener: vi.fn(),
      location: {
        href: "http://localhost:3000",
        hostname: "localhost",
      },
    };
    vi.stubGlobal("window", mockWindow);
  });

  it("detects API availability correctly", () => {
    // Clear global chrome manually if it exists to avoid mock interference
    const oldChrome = (globalThis as any).chrome;
    delete (globalThis as any).chrome;

    setIsInExtensionIframe(false);
    expect(chromeBridge.isAvailable()).toBe(false);

    setIsInExtensionIframe(true);
    expect(chromeBridge.isAvailable()).toBe(true);

    // Restore
    (globalThis as any).chrome = oldChrome;
  });

  describe("queryTabs", () => {
    it("returns mock data when parent bridge is not responding (Dev Mode)", async () => {
      setIsInExtensionIframe(true);
      const result = await chromeBridge.queryTabs({});
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(1);
      expect(result[0].url).toBe("http://localhost");
    });

    it("uses direct chrome.tabs.query when available", async () => {
      setIsInExtensionIframe(false);

      const mockTabs = [{ id: 123, url: "https://test.com" }];
      (globalThis as any).chrome = {
        tabs: {
          query: vi.fn((q, cb) => cb(mockTabs)),
          sendMessage: vi.fn(),
        },
        runtime: { lastError: null },
      } as any;

      const result = await chromeBridge.queryTabs({});
      expect(chrome.tabs.query).toHaveBeenCalled();
      expect(result).toEqual(mockTabs);

      delete (globalThis as any).chrome;
    });
  });

  describe("sendMessage", () => {
    it("uses mock failure when bridge is missing", async () => {
      setIsInExtensionIframe(true);
      const result = await chromeBridge.sendMessage(1, { action: "TEST" });
      expect(result.success).toBe(false);
      expect(result.mock).toBe(true);
    });

    it("uses direct chrome.tabs.sendMessage when available", async () => {
      setIsInExtensionIframe(false);

      const mockResponse = { success: true };
      (globalThis as any).chrome = {
        tabs: {
          query: vi.fn(),
          sendMessage: vi.fn((id, msg, cb) => cb(mockResponse)),
        },
        runtime: { id: "mock-id", lastError: null, sendMessage: vi.fn() },
      } as any;

      const result = await chromeBridge.sendMessage(1, { action: "TRANSLATE_PAGE" });
      expect(chrome.tabs.sendMessage).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);

      delete (globalThis as any).chrome;
    });

    it("uses direct chrome.runtime.sendMessage for non-page actions", async () => {
      setIsInExtensionIframe(false);

      const mockResponse = { success: true };
      (globalThis as any).chrome = {
        tabs: {
          query: vi.fn(),
          sendMessage: vi.fn(),
        },
        runtime: { id: "mock-id", lastError: null, sendMessage: vi.fn((msg, cb) => cb(mockResponse)) },
      } as any;

      const result = await chromeBridge.sendMessage(1, { action: "HELLO" });
      expect(chrome.runtime.sendMessage).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);

      delete (globalThis as any).chrome;
    });
  });
});
