import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ScrollView, StatusBar } from 'react-native';
import { Shield, Lock, Activity, Palette } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import WireGuardVPN from 'react-native-wireguard-vpn';
import { ProtectionToggles } from './components/ProtectionToggles';
import { VPN_SERVERS } from '../lib/vpn';
import type { ServerLocation } from '../components/types';

interface ProtectionState {
  isActive: boolean;
  vpnEnabled: boolean;
  adblockEnabled: boolean;
  filteringEnabled: boolean;
}

export default function App() {
  const [protection, setProtection] = useState<ProtectionState>({
    isActive: false,
    vpnEnabled: false,
    adblockEnabled: false,
    filteringEnabled: false,
  });

  const [activeTab, setActiveTab] = useState<'shield' | 'vpn' | 'stats'>('shield');
  const [selectedServer, setSelectedServer] = useState<ServerLocation>(VPN_SERVERS[0]);
  const [isStarting, setIsStarting] = useState(false);

  const toggleProtection = useCallback(() => {
    setProtection(prev => ({
      ...prev,
      isActive: !prev.isActive
    }));
  }, []);

  const toggleVpn = useCallback(async () => {
    try {
      if (protection.vpnEnabled) {
        console.log("[VPN] Disconnecting...");
        await WireGuardVPN.disconnect();
        setProtection(prev => ({ ...prev, vpnEnabled: false }));
      } else {
        console.log("[VPN] Requesting dynamic config...");
        setIsStarting(true);
        // Use the backend URL (replace with your production API URL)
        const API_URL = "http://localhost:8080"; 
        
        const response = await fetch(`${API_URL}/api/vpn/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serverId: selectedServer.id }),
        });

        if (!response.ok) throw new Error("Backend provisioning failed");
        
        const { config } = await response.json();
        
        // v2.0 Native Profile Generation
        const clientPrivateKey = "CLIENT_PRIVATE_KEY_PLACEHOLDER";
        const configString = `
[Interface]
PrivateKey = ${clientPrivateKey}
Address = 10.0.0.2/32
DNS = 1.1.1.1
MTU = ${config.MTU || 1280}

[Peer]
PublicKey = ${config.PublicKey}
Endpoint = ${config.PublicIp}:${config.Port || 51820}
AllowedIPs = 0.0.0.0/0
`.trim();

        console.log("[VPN] Activating native tunnel...");
        // Assuming WireGuardVPN.activate is the correct method for a config string
        if (typeof (WireGuardVPN as any).activate === 'function') {
          await (WireGuardVPN as any).activate(configString, "HonoursVPN");
        } else {
          // Fallback to connect if activate is not available
          await WireGuardVPN.connect(
            config.Id,
            clientPrivateKey,
            config.PublicKey,
            `${config.PublicIp}:${config.Port || 51820}`,
            "10.0.0.2/32",
            "1.1.1.1",
            "0.0.0.0/0",
            1420
          );
        }

        setProtection(prev => ({ ...prev, vpnEnabled: true }));
      }
    } catch (error) {
      console.error("[VPN Error]:", error);
      alert("VPN Connection Failed: " + (error as Error).message);
    } finally {
      setIsStarting(false);
    }
  }, [protection.vpnEnabled, selectedServer]);

  const toggleAdblock = useCallback(() => {
    setProtection(prev => ({
      ...prev,
      adblockEnabled: !prev.adblockEnabled
    }));
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={protection.isActive ? ['#065f46', '#020617'] : ['#450a0a', '#020617']}
        style={StyleSheet.absoluteFill}
      />
      
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Privacy Shield</Text>
            <Text style={styles.headerSubtitle}>MOBILE PROTECTION</Text>
          </View>
          <TouchableOpacity style={styles.themeButton}>
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
                  color={protection.isActive ? "#10b981" : "#ef4444"} 
                  strokeWidth={1.5}
                />
              </TouchableOpacity>
              
              <Text style={[
                styles.statusText,
                { color: protection.isActive ? "#10b981" : "#ef4444" }
              ]}>
                {protection.isActive ? "SYSTEM SECURED" : "PROTECTION OFFLINE"}
              </Text>

              <View style={styles.togglesWrapper}>
                <ProtectionToggles
                  protection={protection}
                  onVpnToggle={toggleVpn}
                  onAdblockToggle={toggleAdblock}
                  onFilteringToggle={toggleProtection}
                />
              </View>
            </View>
          )}

          {activeTab === 'vpn' && (
            <View style={styles.vpnContainer}>
              <Text style={styles.sectionTitle}>VPN SERVERS</Text>
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
                    <Text style={styles.serverCountry}>{server.country}</Text>
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
                    {protection.vpnEnabled ? "DISCONNECT" : "CONNECT NOW"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {activeTab === 'stats' && (
            <View style={styles.tabPlaceholder}>
              <Activity size={48} color="#a1a1aa" />
              <Text style={styles.placeholderText}>Protection Stats Coming Soon</Text>
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
    shadowColor: "#10b981",
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
  tabPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: 20,
  },
  placeholderText: {
    color: '#a1a1aa',
    fontSize: 16,
    fontWeight: '600',
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
});
