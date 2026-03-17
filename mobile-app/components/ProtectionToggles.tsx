import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';

interface ProtectionState {
  isActive: boolean;
  vpnEnabled: boolean;
  adblockEnabled: boolean;
  filteringEnabled: boolean;
}

interface ProtectionTogglesProps {
  protection: ProtectionState;
  onVpnToggle: () => void;
  onAdblockToggle: () => void;
  onFilteringToggle: () => void;
}

export function ProtectionToggles({
  protection,
  onVpnToggle,
  onAdblockToggle,
  onFilteringToggle,
}: ProtectionTogglesProps) {
  return (
    <View style={styles.container}>
      <View style={styles.toggleRow}>
        <View>
          <Text style={styles.label}>VPN PROTECTION</Text>
          <Text style={styles.subLabel}>AES-256 Encryption</Text>
        </View>
        <Switch
          value={protection.vpnEnabled}
          onValueChange={onVpnToggle}
          trackColor={{ false: "#3f3f46", true: "#10b981" }}
        />
      </View>
      
      <View style={styles.toggleRow}>
        <View>
          <Text style={styles.label}>AD GUARD</Text>
          <Text style={styles.subLabel}>System-wide filtering</Text>
        </View>
        <Switch
          value={protection.adblockEnabled}
          onValueChange={onAdblockToggle}
          trackColor={{ false: "#3f3f46", true: "#10b981" }}
        />
      </View>

      <View style={styles.toggleRow}>
        <View>
          <Text style={styles.label}>TRACKER BLOCKING</Text>
          <Text style={styles.subLabel}>Privacy Shield</Text>
        </View>
        <Switch
          value={protection.isActive}
          onValueChange={onFilteringToggle}
          trackColor={{ false: "#3f3f46", true: "#10b981" }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  label: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  subLabel: {
    color: '#a1a1aa',
    fontSize: 10,
    fontWeight: '600',
  },
});
