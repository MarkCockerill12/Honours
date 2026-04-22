/* eslint-disable @typescript-eslint/no-require-imports */
const { withAndroidManifest, withPlugins } = require('@expo/config-plugins');

/**
 * Custom plugin to fix react-native-wireguard-vpn on Expo.
 * It manually adds the required VpnService declarations to AndroidManifest.xml.
 */
function withWireGuardService(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application[0];

    // Ensure permissions are present
    if (!config.modResults.manifest['uses-permission']) {
      config.modResults.manifest['uses-permission'] = [];
    }
    
    const permissions = [
      'android.permission.BIND_VPN_SERVICE',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.INTERNET',
      'android.permission.POST_NOTIFICATIONS',
    ];

    permissions.forEach(permission => {
      if (!config.modResults.manifest['uses-permission'].some(p => p.$['android:name'] === permission)) {
        config.modResults.manifest['uses-permission'].push({
          $: { 'android:name': permission }
        });
      }
    });

    // 1. Add .WireGuardVpnService
    if (!mainApplication.service) mainApplication.service = [];
    
    const hasVpnService = mainApplication.service.some(
      (s) => s.$['android:name'] === 'com.wireguardvpn.WireGuardVpnService'
    );

    if (!hasVpnService) {
      mainApplication.service.push({
        $: {
          'android:name': 'com.wireguardvpn.WireGuardVpnService',
          'android:permission': 'android.permission.BIND_VPN_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: { 'android:name': 'android.net.VpnService' },
              },
            ],
          },
        ],
      });
    }

    // 2. Add WireGuard GoBackend Service with tools:replace to avoid merge conflict
    const hasGoBackend = mainApplication.service.some(
      (s) => s.$['android:name'] === 'com.wireguard.android.backend.GoBackend$VpnService'
    );

    if (!hasGoBackend) {
      // Ensure tools namespace is present
      if (!config.modResults.manifest.$['xmlns:tools']) {
        config.modResults.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
      }

      mainApplication.service.push({
        $: {
          'android:name': 'com.wireguard.android.backend.GoBackend$VpnService',
          'android:permission': 'android.permission.BIND_VPN_SERVICE',
          'android:exported': 'false',
          'tools:replace': 'android:exported',
        },
        'intent-filter': [
          {
            action: [
              {
                $: { 'android:name': 'android.net.VpnService' },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
}

module.exports = (config) => {
  return withPlugins(config, [withWireGuardService]);
};
