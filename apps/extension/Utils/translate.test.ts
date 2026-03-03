import { describe, it, expect, vi, beforeEach } from 'vitest';
import { translateText } from './translate';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('translateText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends correct request to backend', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ translated: 'Bonjour' }),
    });

    await translateText('Hello', 'FR');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/translate'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Hello', targetLang: 'FR' }),
      })
    );
  });

  it('returns translated text on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ translated: 'Hola' }),
    });

    const result = await translateText('Hello', 'ES');
    expect(result).toBe('Hola');
  });

  it('defaults to EN target language', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ translated: 'Hello' }),
    });

    await translateText('Bonjour');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ text: 'Bonjour', targetLang: 'EN' }),
      })
    );
  });

  it('returns original text on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await translateText('Hello', 'FR');
    expect(result).toBe('Hello');
  });

  it('returns original text on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await translateText('Hello', 'FR');
    expect(result).toBe('Hello');
  });
});
