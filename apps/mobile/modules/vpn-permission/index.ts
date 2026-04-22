import { NativeModule, requireNativeModule, EventEmitter } from 'expo-modules-core';

interface VpnPermissionModule extends NativeModule {
  requestVpnPermission(): Promise<boolean>;
  showNotification(serverName: string): void;
  hideNotification(): void;
}

const module = requireNativeModule<VpnPermissionModule>('VpnPermission');

// Export the module and an emitter for the native events
export const VpnEventEmitter = new EventEmitter(module);
export default module;
