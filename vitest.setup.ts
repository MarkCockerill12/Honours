import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock chrome APIs
const storageStore: Record<string, any> = {};
global.chrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    lastError: undefined,
  },
  storage: {
    local: {
      get: vi.fn((keys, cb) => {
        const result: Record<string, any> = {};
        if (Array.isArray(keys)) {
          keys.forEach(k => result[k] = storageStore[k]);
        } else if (typeof keys === 'string') {
          result[keys] = storageStore[keys];
        } else {
          Object.assign(result, storageStore);
        }
        cb(result);
      }),
      set: vi.fn((data, cb) => {
        Object.assign(storageStore, data);
        cb?.();
      }),
      clear: vi.fn((cb) => {
        Object.keys(storageStore).forEach(k => delete storageStore[k]);
        cb?.();
      })
    },
  },
  tabs: {
    query: vi.fn((query, cb) => cb([])),
    sendMessage: vi.fn((id, msg, cb) => cb({ success: true })),
  },
} as any;

// Mock window.parent.postMessage
window.parent.postMessage = vi.fn();
