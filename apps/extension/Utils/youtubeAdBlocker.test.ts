import { describe, it, expect } from 'vitest';
import { shouldBlockYouTubeRequest } from './youtubeAdBlocker';

describe('shouldBlockYouTubeRequest', () => {
  it('blocks YouTube ad API stats requests', () => {
    expect(shouldBlockYouTubeRequest('https://www.youtube.com/api/stats/ads?ver=2')).toBe(true);
  });

  it('blocks pagead requests', () => {
    expect(shouldBlockYouTubeRequest('https://www.youtube.com/pagead/123')).toBe(true);
  });

  it('blocks ptracking requests', () => {
    expect(shouldBlockYouTubeRequest('https://www.youtube.com/ptracking?v=123')).toBe(true);
  });

  it('blocks midroll info requests', () => {
    expect(shouldBlockYouTubeRequest('https://www.youtube.com/get_midroll_info?v=abc')).toBe(true);
  });

  it('blocks doubleclick.net requests', () => {
    expect(shouldBlockYouTubeRequest('https://ad.doubleclick.net/ddm/trackclk/123')).toBe(true);
  });

  it('blocks googleadservices.com requests', () => {
    expect(shouldBlockYouTubeRequest('https://www.googleadservices.com/pagead/aclk')).toBe(true);
  });

  it('blocks googlesyndication.com requests', () => {
    expect(shouldBlockYouTubeRequest('https://pagead2.googlesyndication.com/pcs/view')).toBe(true);
  });

  it('blocks URLs with ad_type parameter', () => {
    expect(shouldBlockYouTubeRequest('https://www.youtube.com/watch?v=123&ad_type=video')).toBe(true);
  });

  it('blocks URLs with adformat parameter', () => {
    expect(shouldBlockYouTubeRequest('https://www.youtube.com/watch?v=123&adformat=preroll')).toBe(true);
  });

  it('allows regular YouTube video requests', () => {
    expect(shouldBlockYouTubeRequest('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false);
  });

  it('allows regular YouTube API requests', () => {
    expect(shouldBlockYouTubeRequest('https://www.youtube.com/api/stats/watchtime')).toBe(false);
  });

  it('allows YouTube channel pages', () => {
    expect(shouldBlockYouTubeRequest('https://www.youtube.com/@channel')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(shouldBlockYouTubeRequest('https://www.youtube.com/PAGEAD/123')).toBe(true);
    expect(shouldBlockYouTubeRequest('https://WWW.DOUBLECLICK.NET/ad')).toBe(true);
  });
});
