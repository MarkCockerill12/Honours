import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ScrollView, StatusBar } from 'react-native';
import { Shield, Lock, Activity, Palette } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ProtectionToggles } from './components/ProtectionToggles';

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

  const toggleProtection = useCallback(() => {
    setProtection(prev => ({
      ...prev,
      isActive: !prev.isActive
    }));
  }, []);

  const toggleVpn = useCallback(() => {
    setProtection(prev => ({
      ...prev,
      vpnEnabled: !prev.vpnEnabled
    }));
  }, []);

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
            <View style={styles.tabPlaceholder}>
              <Lock size={48} color="#a1a1aa" />
              <Text style={styles.placeholderText}>VPN Settings Coming Soon</Text>
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
});
