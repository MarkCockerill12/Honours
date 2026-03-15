import { describe, it, expect } from 'vitest';
import { isPdfUrl, hasBypassParam } from './urlUtils';

describe('urlUtils', () => {
  describe('isPdfUrl', () => {
    it('should identify direct PDF links', () => {
      expect(isPdfUrl('https://example.com/file.pdf')).toBe(true);
      expect(isPdfUrl('https://example.com/FILE.PDF')).toBe(true);
    });

    it('should identify PDF links with query parameters', () => {
      expect(isPdfUrl('https://example.com/download.php?id=123&file=test.pdf')).toBe(true);
    });

    it('should reject non-PDF URLs', () => {
      expect(isPdfUrl('https://example.com/index.html')).toBe(false);
      expect(isPdfUrl('https://example.com/pdf-reader')).toBe(false);
    });
  });

  describe('hasBypassParam', () => {
    it('should detect bypass parameter', () => {
      expect(hasBypassParam('https://example.com/test.pdf?bypass=true')).toBe(true);
      expect(hasBypassParam('https://example.com/test.pdf?other=1&bypass=true')).toBe(true);
    });

    it('should return false if bypass is missing', () => {
      expect(hasBypassParam('https://example.com/test.pdf')).toBe(false);
      expect(hasBypassParam('https://example.com/test.pdf?bypass=false')).toBe(false);
    });
  });
});
