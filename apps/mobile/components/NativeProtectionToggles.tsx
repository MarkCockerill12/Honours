import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';

interface ToggleItem {
  id: string;
  label: string;
  description?: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

interface NativeProtectionTogglesProps {
  items: ToggleItem[];
}

export function NativeProtectionToggles({ items }: Readonly<NativeProtectionTogglesProps>) {
  return (
    <View style={styles.container}>
      {items.map(item => (
        <View key={item.id} style={[styles.toggleRow, item.disabled && styles.disabled]}>
          <View style={styles.textContainer}>
            <Text style={styles.label}>{item.label}</Text>
            {item.description && <Text style={styles.description}>{item.description}</Text>}
          </View>
          <Switch
            value={item.enabled}
            onValueChange={item.onToggle}
            disabled={item.disabled}
            trackColor={{ false: '#3f3f46', true: '#10b981' }}
            thumbColor={item.enabled ? '#ffffff' : '#71717a'}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  disabled: {
    opacity: 0.5,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  description: {
    color: '#a1a1aa',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
