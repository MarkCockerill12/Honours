/* eslint-disable @typescript-eslint/no-require-imports */
const { withAndroidManifest, withPlugins } = require('@expo/config-plugins');

/**
 * Custom plugin to fix react-native-wireguard-vpn on Expo.
 * It manually adds the required VpnService declarations to AndroidManifest.xml.
 */
function withWireGuardService(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application[0];

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

    // 2. Add WireGuard GoBackend Service
    const hasGoBackend = mainApplication.service.some(
      (s) => s.$['android:name'] === 'com.wireguard.android.backend.GoBackend$VpnService'
    );

    if (!hasGoBackend) {
      mainApplication.service.push({
        $: {
          'android:name': 'com.wireguard.android.backend.GoBackend$VpnService',
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

    return config;
  });
}

module.exports = (config) => {
  return withPlugins(config, [withWireGuardService]);
};
