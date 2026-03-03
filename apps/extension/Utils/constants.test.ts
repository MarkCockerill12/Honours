import { describe, it, expect } from 'vitest';
import { FILTER_PRESETS } from './constants';

describe('FILTER_PRESETS', () => {
  it('contains all expected preset categories', () => {
    expect(FILTER_PRESETS).toHaveProperty('violence');
    expect(FILTER_PRESETS).toHaveProperty('profanity');
    expect(FILTER_PRESETS).toHaveProperty('politics');
    expect(FILTER_PRESETS).toHaveProperty('spoilers');
    expect(FILTER_PRESETS).toHaveProperty('nsfw');
  });

  it('each preset has a blockTerm', () => {
    for (const [key, preset] of Object.entries(FILTER_PRESETS)) {
      expect(preset.blockTerm).toBeDefined();
      expect(typeof preset.blockTerm).toBe('string');
      expect(preset.blockTerm.length).toBeGreaterThan(0);
    }
  });

  it('each preset has an exceptWhen field', () => {
    for (const [key, preset] of Object.entries(FILTER_PRESETS)) {
      expect(preset).toHaveProperty('exceptWhen');
      expect(typeof preset.exceptWhen).toBe('string');
    }
  });

  it('violence preset has news report exception', () => {
    expect(FILTER_PRESETS.violence.blockTerm).toBe('violence');
    expect(FILTER_PRESETS.violence.exceptWhen).toBe('news report');
  });

  it('politics preset has educational exception', () => {
    expect(FILTER_PRESETS.politics.blockTerm).toBe('political');
    expect(FILTER_PRESETS.politics.exceptWhen).toBe('educational');
  });

  it('profanity preset has no exception', () => {
    expect(FILTER_PRESETS.profanity.exceptWhen).toBe('');
  });
});
