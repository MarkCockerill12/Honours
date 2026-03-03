import { describe, it, expect } from 'vitest';
import { VPN_SERVERS, getVpnConfig } from './vpn';
import type { VpnServer } from './vpn';

describe('VPN_SERVERS', () => {
  it('is a non-empty array', () => {
    expect(VPN_SERVERS).toBeInstanceOf(Array);
    expect(VPN_SERVERS.length).toBeGreaterThan(0);
  });

  it('each server has required VpnServer fields', () => {
    for (const server of VPN_SERVERS) {
      expect(server).toHaveProperty('id');
      expect(server).toHaveProperty('country');
      expect(server).toHaveProperty('ip');
      expect(server).toHaveProperty('publicKey');
      expect(server).toHaveProperty('proxyPort');
      expect(typeof server.id).toBe('string');
      expect(typeof server.country).toBe('string');
      expect(typeof server.ip).toBe('string');
      expect(typeof server.proxyPort).toBe('number');
    }
  });

  it('first server is the AWS EU server', () => {
    expect(VPN_SERVERS[0].id).toBe('aws-eu-1');
    expect(VPN_SERVERS[0].country).toBe('Germany');
  });
});

describe('getVpnConfig', () => {
  it('returns config for a valid server ID', () => {
    const config = getVpnConfig('aws-eu-1');
    expect(config).toBeDefined();
    expect(config?.id).toBe('aws-eu-1');
  });

  it('falls back to first server for an invalid server ID', () => {
    // getVpnConfig falls back to VPN_SERVERS[0] when not found
    const config = getVpnConfig('nonexistent-server-id');
    expect(config).toBeDefined();
    expect(config?.id).toBe(VPN_SERVERS[0].id);
  });
});
