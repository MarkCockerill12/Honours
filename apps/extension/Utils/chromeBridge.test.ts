import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as bridgeModule from './chromeBridge';
const { chromeBridge, setIsInExtensionIframe, env } = bridgeModule;

describe('chromeBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset bridge state for tests
    bridgeModule.env.bridgeReady = true;
    bridgeModule.env.isInExtensionIframe = true;
    
    // Simulate being in an iframe for bridge tests (self !== top)
    const mockWindow = {
      self: { name: 'iframe' },
      top: { name: 'top' },
      parent: { postMessage: vi.fn() },
      addEventListener: vi.fn(),
      location: { 
        href: 'http://localhost:3000',
        hostname: 'localhost'
      }
    };
    vi.stubGlobal('window', mockWindow);
  });

  it('detects API availability correctly', () => {
    // Clear global chrome manually if it exists to avoid mock interference
    const oldChrome = (global as any).chrome;
    delete (global as any).chrome;
    
    setIsInExtensionIframe(false);
    expect(chromeBridge.isAvailable()).toBe(false);
    
    setIsInExtensionIframe(true);
    expect(chromeBridge.isAvailable()).toBe(true);
    
    // Restore
    (global as any).chrome = oldChrome;
  });

  describe('queryTabs', () => {
    it('returns mock data when parent bridge is not responding (Dev Mode)', async () => {
      setIsInExtensionIframe(true);
      const result = await chromeBridge.queryTabs({});
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(1);
      expect(result[0].url).toBe('http://localhost');
    });

    it('uses direct chrome.tabs.query when available', async () => {
      setIsInExtensionIframe(false);

      const mockTabs = [{ id: 123, url: 'https://test.com' }];
      global.chrome = {
        tabs: {
          query: vi.fn((q, cb) => cb(mockTabs)),
          sendMessage: vi.fn()
        },
        runtime: { lastError: null }
      } as any;

      const result = await chromeBridge.queryTabs({});
      expect(chrome.tabs.query).toHaveBeenCalled();
      expect(result).toEqual(mockTabs);
      
      delete (global as any).chrome;
    });
  });

  describe('sendMessage', () => {
    it('uses mock failure when bridge is missing', async () => {
      setIsInExtensionIframe(true);
      const result = await chromeBridge.sendMessage(1, { action: 'TEST' });
      expect(result.success).toBe(false);
      expect(result.mock).toBe(true);
    });

    it('uses direct chrome.tabs.sendMessage when available', async () => {
      setIsInExtensionIframe(false);

      const mockResponse = { success: true };
      global.chrome = {
        tabs: {
          query: vi.fn(),
          sendMessage: vi.fn((id, msg, cb) => cb(mockResponse))
        },
        runtime: { lastError: null }
      } as any;

      const result = await chromeBridge.sendMessage(1, { action: 'HELLO' });
      expect(chrome.tabs.sendMessage).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);

      delete (global as any).chrome;
    });
  });
});
