import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, Palette, Globe, Lock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import {
  EC2Client,
  StartInstancesCommand,
  DescribeInstancesCommand,
  ModifyInstanceAttributeCommand,
} from '@aws-sdk/client-ec2';
import WireGuardVpnModule from 'react-native-wireguard-vpn';
import { VPN_SERVERS, type ServerLocation } from '@privacy-shield/core';
import { NativeProtectionToggles } from './components/NativeProtectionToggles';

// ─── Configuration (Same as Desktop vpnHandlers.js) ─────────────

const SERVER_REGION_MAP: Record<string, string> = {
  us: 'us-east-1',
  uk: 'eu-west-2',
  de: 'eu-central-1',
  jp: 'ap-northeast-1',
  au: 'ap-southeast-2',
};

const EC2_TAG_NAMES: Record<string, string> = {
  us: 'VPN-US',
  uk: 'VPN-UK',
  de: 'VPN-Germany',
  jp: 'VPN-Japan',
  au: 'VPN-Sydney',
};

// ─── Secure Key Management ─────────────

async function getSecureValue(key: string, buildTimeValue: string): Promise<string> {
  try {
    let val = await SecureStore.getItemAsync(key);
    if (!val && buildTimeValue) {
      await SecureStore.setItemAsync(key, buildTimeValue);
      val = buildTimeValue;
    }
    return val || '';
  } catch (err) {
    console.warn(`[SecureStore] Error reading ${key}:`, err);
    return buildTimeValue || '';
  }
}

// ─── App Component ──────────────────────────────────────────────

interface ProtectionState {
  isActive: boolean;
  vpnEnabled: boolean;
  adblockEnabled: boolean;
}

type ThemeName = 'dark' | 'vaporwave' | 'cyberpunk';

const THEME_GRADIENTS: Record<ThemeName, readonly [string, string, ...string[]]> = {
  dark: ['#065f46', '#020617'],
  vaporwave: ['#7c3aed', '#020617'],
  cyberpunk: ['#eab308', '#020617'],
};

const THEME_GRADIENTS_INACTIVE: Record<ThemeName, readonly [string, string, ...string[]]> = {
  dark: ['#450a0a', '#020617'],
  vaporwave: ['#4c1d95', '#020617'],
  cyberpunk: ['#78350f', '#020617'],
};

export default function App() {
  const [protection, setProtection] = useState<ProtectionState>({
    isActive: false,
    vpnEnabled: false,
    adblockEnabled: false,
  });

  const [activeTab, setActiveTab] = useState<'shield' | 'vpn' | 'stats'>('shield');
  const [selectedServer, setSelectedServer] = useState<ServerLocation>(VPN_SERVERS[0]);
  const [isStarting, setIsStarting] = useState(false);
  const [theme, setTheme] = useState<ThemeName>('dark');

  // Initialize WireGuard on mount
  useEffect(() => {
    WireGuardVpnModule.initialize().catch(err => {
      console.warn('[VPN] Initialization failed:', err);
    });
  }, []);

  const cycleTheme = useCallback(() => {
    const themes: ThemeName[] = ['dark', 'vaporwave', 'cyberpunk'];
    setTheme(prev => {
      const idx = themes.indexOf(prev);
      return themes[(idx + 1) % themes.length];
    });
  }, []);

  const toggleProtection = useCallback(() => {
    setProtection(prev => ({
      ...prev,
      isActive: !prev.isActive
    }));
  }, []);

  const toggleVpn = useCallback(async () => {
    if (protection.vpnEnabled) {
      console.log('[VPN] Disconnecting...');
      try {
        await WireGuardVpnModule.disconnect();
        setProtection(prev => ({ ...prev, vpnEnabled: false }));
      } catch (err) {
        Alert.alert('Disconnect Error', (err as Error).message);
      }
      return;
    }

    setIsStarting(true);
    try {
      // 1. Load credentials
      const accessKey = await getSecureValue('AWS_ACCESS_KEY_ID', Constants.expoConfig?.extra?.awsAccessKeyId);
      const secretKey = await getSecureValue('AWS_SECRET_ACCESS_KEY', Constants.expoConfig?.extra?.awsSecretAccessKey);
      const clientPrivateKey = await getSecureValue('WG_CLIENT_PRIVATE_KEY', Constants.expoConfig?.extra?.wgClientPrivateKey);

      if (!accessKey || !secretKey || !clientPrivateKey) {
        throw new Error('Missing AWS credentials or WireGuard private key. Please check app.json.');
      }

      const serverId = selectedServer.id;
      const region = SERVER_REGION_MAP[serverId];
      const tagName = EC2_TAG_NAMES[serverId];
      
      const configKeyName = `wg${serverId.charAt(0).toUpperCase() + serverId.slice(1)}PublicKey`;
      const spokePublicKey = await getSecureValue(`WG_${serverId.toUpperCase()}_PUBLIC_KEY`, Constants.expoConfig?.extra?.[configKeyName]);

      if (!spokePublicKey) {
        throw new Error(`Spoke public key for ${serverId} not found.`);
      }

      console.log(`[VPN] Connecting to ${selectedServer.name} (${region})...`);

      // 2. Provision EC2
      const client = new EC2Client({
        region,
        credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      });

      // Find instance
      const result = await client.send(new DescribeInstancesCommand({
        Filters: [{ Name: 'tag:Name', Values: [tagName] }],
      }));
      const instance = result.Reservations?.[0]?.Instances?.[0];

      if (!instance) throw new Error(`EC2 instance ${tagName} not found in ${region}.`);

      // Start if needed
      if (instance.State?.Name !== 'running') {
        console.log('[VPN] Starting instance...');
        await client.send(new StartInstancesCommand({ InstanceIds: [instance.InstanceId!] }));
      }

      // Poll for public IP
      let spokeIp = '';
      for (let i = 0; i < 30; i++) {
        const desc = await client.send(new DescribeInstancesCommand({ InstanceIds: [instance.InstanceId!] }));
        const inst = desc.Reservations?.[0]?.Instances?.[0];
        if (inst?.State?.Name === 'running' && inst?.PublicIpAddress) {
          spokeIp = inst.PublicIpAddress;
          break;
        }
        console.log(`[VPN] Waiting for IP (attempt ${i+1}/30)...`);
        await new Promise(r => setTimeout(r, 5000));
      }

      if (!spokeIp) throw new Error('Timeout waiting for public IP. Server may be starting slowly.');

      // Disable SourceDestCheck (required for NAT)
      await client.send(new ModifyInstanceAttributeCommand({
        InstanceId: instance.InstanceId!,
        SourceDestCheck: { Value: false },
      })).catch(e => console.warn('[VPN] SourceDestCheck update failed (non-fatal):', e));

      console.log('[VPN] Activating tunnel...');
      await WireGuardVpnModule.connect({
        privateKey: clientPrivateKey,
        publicKey: spokePublicKey,
        serverAddress: spokeIp,
        serverPort: 51820,
        address: '10.0.0.2/32',
        allowedIPs: ['0.0.0.0/0'],
        dns: protection.adblockEnabled ? ['94.140.14.14', '94.140.15.15'] : ['1.1.1.1'],
        mtu: 1280
      });
      
      setProtection(prev => ({ ...prev, vpnEnabled: true }));
      console.log('[VPN] ✅ Connected');
    } catch (error) {
      console.error('[VPN Error]:', error);
      Alert.alert('VPN Connection Failed', (error as Error).message);
    } finally {
      setIsStarting(false);
    }
  }, [protection.vpnEnabled, protection.adblockEnabled, selectedServer]);

  const toggleAdblock = useCallback(() => {
    setProtection(prev => ({
      ...prev,
      adblockEnabled: !prev.adblockEnabled,
    }));
    // Re-connection with new DNS would happen here if VPN is active
    // But simplified for parity with desktop toggle logic
  }, []);

  const gradientColors = protection.isActive
    ? THEME_GRADIENTS[theme]
    : THEME_GRADIENTS_INACTIVE[theme];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={gradientColors}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Privacy Shield</Text>
            <Text style={styles.headerSubtitle}>MOBILE PROTECTION</Text>
          </View>
          <TouchableOpacity style={styles.themeButton} onPress={cycleTheme}>
            <Palette size={20} color="#a1a1aa" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {activeTab === 'shield' && (
            <View style={styles.shieldContainer}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={toggleProtection}
                style={[
                  styles.activationButton,
                  protection.isActive ? styles.activationButtonActive : styles.activationButtonInactive
                ]}
              >
                <Shield
                  size={80}
                  color={protection.isActive ? '#10b981' : '#ef4444'}
                  strokeWidth={1.5}
                />
              </TouchableOpacity>

              <Text style={[
                styles.statusText,
                { color: protection.isActive ? '#10b981' : '#ef4444' }
              ]}>
                {protection.isActive ? 'SYSTEM SECURED' : 'PROTECTION OFFLINE'}
              </Text>

              <View style={styles.togglesWrapper}>
                <NativeProtectionToggles
                  items={[
                    {
                      id: 'vpn',
                      label: 'Encrypted VPN',
                      description: 'Direct-to-Spoke WireGuard',
                      enabled: protection.vpnEnabled,
                      onToggle: () => { toggleVpn(); },
                    },
                    {
                      id: 'adblock',
                      label: 'Ad Blocker',
                      description: 'DNS-level filtering',
                      enabled: protection.adblockEnabled,
                      onToggle: () => { toggleAdblock(); },
                    },
                  ]}
                />
              </View>
            </View>
          )}

          {activeTab === 'vpn' && (
            <View style={styles.vpnContainer}>
              <Text style={styles.sectionTitle}>AWS SPOKE SERVERS</Text>
              {VPN_SERVERS.map((server) => (
                <TouchableOpacity
                  key={server.id}
                  style={[
                    styles.serverButton,
                    selectedServer.id === server.id && styles.serverButtonSelected
                  ]}
                  onPress={() => setSelectedServer(server)}
                  disabled={isStarting || protection.vpnEnabled}
                >
                  <Text style={styles.serverFlag}>{server.flag}</Text>
                  <View style={styles.serverInfo}>
                    <Text style={styles.serverName}>{server.name}</Text>
                    <Text style={styles.serverCountry}>{regionToLabel(SERVER_REGION_MAP[server.id])}</Text>
                  </View>
                  {selectedServer.id === server.id && (
                    <View style={styles.selectedIndicator} />
                  )}
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                onPress={toggleVpn}
                disabled={isStarting}
                style={[
                  styles.connectButton,
                  protection.vpnEnabled ? styles.disconnectButton : styles.connectButtonPrimary
                ]}
              >
                {isStarting ? (
                  <Text style={styles.buttonText}>PROVISIONING...</Text>
                ) : (
                  <Text style={styles.buttonText}>
                    {protection.vpnEnabled ? 'DISCONNECT' : 'CONNECT NOW'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {activeTab === 'stats' && (
            <View style={styles.statsContainer}>
              <Text style={styles.sectionTitle}>SYSTEM MONITOR</Text>
              <View style={styles.statCard}>
                <Globe size={20} color="#10b981" />
                <View style={styles.statInfo}>
                  <Text style={styles.statValue}>{protection.vpnEnabled ? selectedServer.name : 'Unsecured'}</Text>
                  <Text style={styles.statLabel}>VPN ENDPOINT</Text>
                </View>
              </View>
              <View style={styles.statCard}>
                <Lock size={20} color={protection.adblockEnabled ? '#10b981' : '#71717a'} />
                <View style={styles.statInfo}>
                  <Text style={styles.statValue}>{protection.adblockEnabled ? 'AdGuard DNS' : 'Native DNS'}</Text>
                  <Text style={styles.statLabel}>TRAFFIC FILTER</Text>
                </View>
              </View>
              <View style={styles.statCard}>
                <Shield size={20} color={protection.isActive ? '#10b981' : '#ef4444'} />
                <View style={styles.statInfo}>
                  <Text style={styles.statValue}>{protection.isActive ? 'Protected' : 'Vulnerable'}</Text>
                  <Text style={styles.statLabel}>STANCE</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Navigation */}
        <View style={styles.navContainer}>
          <View style={styles.navBar}>
            {(['shield', 'vpn', 'stats'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={styles.navItem}
              >
                <Text style={[
                  styles.navText,
                  activeTab === tab ? styles.navTextActive : styles.navTextInactive
                ]}>
                  {tab.toUpperCase()}
                </Text>
                {activeTab === tab && <View style={styles.navIndicator} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function regionToLabel(region: string) {
  return region.toUpperCase().replace('-', ' ');
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 20,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: '#a1a1aa',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  themeButton: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  shieldContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  activationButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  activationButtonActive: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  activationButtonInactive: {
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusText: {
    marginTop: 30,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 3,
  },
  togglesWrapper: {
    width: '100%',
    marginTop: 40,
  },
  navContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 40,
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  navItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  navText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  navTextActive: {
    color: '#ffffff',
  },
  navTextInactive: {
    color: '#71717a',
  },
  navIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 20,
    height: 3,
    backgroundColor: '#ffffff',
    borderRadius: 1.5,
  },
  vpnContainer: {
    paddingVertical: 20,
    gap: 15,
  },
  sectionTitle: {
    color: '#a1a1aa',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 5,
  },
  serverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  serverButtonSelected: {
    borderColor: 'rgba(16, 185, 129, 0.5)',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  serverFlag: {
    fontSize: 24,
    marginRight: 15,
  },
  serverInfo: {
    flex: 1,
  },
  serverName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  serverCountry: {
    color: '#a1a1aa',
    fontSize: 10,
    fontWeight: '600',
  },
  selectedIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  connectButton: {
    marginTop: 20,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectButtonPrimary: {
    backgroundColor: '#10b981',
  },
  disconnectButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  statsContainer: {
    paddingVertical: 20,
    gap: 15,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 15,
  },
  statInfo: {
    flex: 1,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  statLabel: {
    color: '#71717a',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 2,
  },
});
