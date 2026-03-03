import { describe, it, expect } from 'vitest';
import { AD_BLOCK_LISTS, parseAdblockRules, getAdblockConfig } from './adblock';

describe('AD_BLOCK_LISTS', () => {
  it('contains EASYLIST and ADGUARD urls', () => {
    expect(AD_BLOCK_LISTS).toHaveProperty('EASYLIST');
    expect(AD_BLOCK_LISTS).toHaveProperty('ADGUARD');
    expect(AD_BLOCK_LISTS.EASYLIST).toContain('easylist');
    expect(AD_BLOCK_LISTS.ADGUARD).toContain('adtidy');
  });
});

describe('parseAdblockRules', () => {
  it('returns empty array when disabled', () => {
    const rules = parseAdblockRules(false);
    expect(rules).toEqual([]);
  });

  it('returns an array of rules when enabled', () => {
    const rules = parseAdblockRules(true);
    expect(rules).toBeInstanceOf(Array);
    expect(rules.length).toBeGreaterThan(0);
  });

  it('each rule has domain and type properties', () => {
    const rules = parseAdblockRules(true);
    for (const rule of rules) {
      expect(rule).toHaveProperty('domain');
      expect(rule).toHaveProperty('type');
      expect(typeof rule.domain).toBe('string');
      expect(rule.type).toBe('block');
    }
  });

  it('includes known ad-serving domains', () => {
    const rules = parseAdblockRules(true);
    const domains = rules.map(r => r.domain);
    const allDomains = domains.join(' ');
    expect(allDomains).toContain('doubleclick');
  });
});

describe('getAdblockConfig', () => {
  it('returns active config when enabled', () => {
    const config = getAdblockConfig(true);
    expect(config.active).toBe(true);
    expect(config.rules.length).toBeGreaterThan(0);
  });

  it('returns inactive config when disabled', () => {
    const config = getAdblockConfig(false);
    expect(config.active).toBe(false);
    expect(config.rules).toEqual([]);
  });
});
