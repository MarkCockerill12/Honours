// System-level Ad Blocking for Windows
// Uses DNS settings modification to block ads system-wide

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

// AdGuard DNS servers for ad blocking
const ADGUARD_DNS = {
  primary: '94.140.14.14',
  secondary: '94.140.15.15',
};

// Backup original DNS settings
interface NetworkAdapter {
  name: string;
  interfaceName: string;
  originalDNS: string[];
}

let originalAdapters: NetworkAdapter[] = [];

/**
 * Get all active network adapters on Windows
 */
async function getNetworkAdapters(): Promise<NetworkAdapter[]> {
  try {
    const { stdout } = await execAsync(
      'powershell "Get-NetAdapter | Where-Object {$_.Status -eq \'Up\'} | Select-Object -ExpandProperty Name"'
    );
    
    const adapterNames = stdout.trim().split('\n').filter(n => n.trim());
    const adapters: NetworkAdapter[] = [];

    for (const name of adapterNames) {
      try {
        const { stdout: dnsOutput } = await execAsync(
          `powershell "Get-DnsClientServerAddress -InterfaceAlias '${name.trim()}' -AddressFamily IPv4 | Select-Object -ExpandProperty ServerAddresses"`
        );
        
        const originalDNS = dnsOutput.trim().split('\n').filter(d => d.trim());
        
        adapters.push({
          name: name.trim(),
          interfaceName: name.trim(),
          originalDNS: originalDNS.length > 0 ? originalDNS : ['DHCP'],
        });
      } catch (err) {
        console.error(`Failed to get DNS for adapter ${name}:`, err);
      }
    }

    return adapters;
  } catch (error) {
    console.error('Failed to get network adapters:', error);
    throw new Error('Failed to get network adapters. Run as Administrator.');
  }
}

/**
 * Set DNS servers for a specific network adapter
 */
async function setAdapterDNS(interfaceName: string, primaryDNS: string, secondaryDNS?: string): Promise<void> {
  try {
    // Set primary DNS
    await execAsync(
      `powershell -Command "Set-DnsClientServerAddress -InterfaceAlias '${interfaceName}' -ServerAddresses '${primaryDNS}'${secondaryDNS ? `,'${secondaryDNS}'` : ''}"`,
      { windowsHide: true }
    );
    
    console.log(`Set DNS for ${interfaceName}: ${primaryDNS}${secondaryDNS ? `, ${secondaryDNS}` : ''}`);
  } catch (error) {
    console.error(`Failed to set DNS for ${interfaceName}:`, error);
    throw new Error(`Failed to set DNS for ${interfaceName}. Administrator privileges required.`);
  }
}

/**
 * Restore original DNS settings for an adapter
 */
async function restoreAdapterDNS(interfaceName: string, originalDNS: string[]): Promise<void> {
  try {
    if (originalDNS.includes('DHCP') || originalDNS.length === 0) {
      // Restore to DHCP
      await execAsync(
        `powershell -Command "Set-DnsClientServerAddress -InterfaceAlias '${interfaceName}' -ResetServerAddresses"`,
        { windowsHide: true }
      );
      console.log(`Restored DHCP DNS for ${interfaceName}`);
    } else {
      // Restore specific DNS servers
      const dnsServers = originalDNS.map(d => `'${d}'`).join(',');
      await execAsync(
        `powershell -Command "Set-DnsClientServerAddress -InterfaceAlias '${interfaceName}' -ServerAddresses ${dnsServers}"`,
        { windowsHide: true }
      );
      console.log(`Restored DNS for ${interfaceName}: ${originalDNS.join(', ')}`);
    }
  } catch (error) {
    console.error(`Failed to restore DNS for ${interfaceName}:`, error);
    throw new Error(`Failed to restore DNS for ${interfaceName}`);
  }
}

/**
 * Check if AdGuard DNS is currently active
 */
export async function checkAdBlockStatus(): Promise<{ active: boolean; adapters: string[] }> {
  try {
    const adapters = await getNetworkAdapters();
    const activeAdapters: string[] = [];

    for (const adapter of adapters) {
      try {
        const { stdout } = await execAsync(
          `powershell "Get-DnsClientServerAddress -InterfaceAlias '${adapter.interfaceName}' -AddressFamily IPv4 | Select-Object -ExpandProperty ServerAddresses"`
        );
        
        const currentDNS = stdout.trim().split('\n').map(d => d.trim());
        
        // Check if AdGuard DNS is set
        if (currentDNS.includes(ADGUARD_DNS.primary) || currentDNS.includes(ADGUARD_DNS.secondary)) {
          activeAdapters.push(adapter.name);
        }
      } catch (err) {
        console.error(`Failed to check DNS for ${adapter.name}:`, err);
      }
    }

    return {
      active: activeAdapters.length > 0,
      adapters: activeAdapters,
    };
  } catch (error) {
    console.error('Failed to check ad block status:', error);
    return { active: false, adapters: [] };
  }
}

/**
 * Enable system-wide ad blocking using AdGuard DNS
 */
export async function enableSystemAdBlock(): Promise<{ success: boolean; message: string; adapters: string[] }> {
  try {
    // Check if running as administrator
    const isAdmin = await checkAdminPrivileges();
    if (!isAdmin) {
      return {
        success: false,
        message: 'Administrator privileges required. Right-click and "Run as Administrator".',
        adapters: [],
      };
    }

    // Get all network adapters
    const adapters = await getNetworkAdapters();
    
    if (adapters.length === 0) {
      return {
        success: false,
        message: 'No active network adapters found.',
        adapters: [],
      };
    }

    // Save original DNS settings
    originalAdapters = adapters;

    // Set AdGuard DNS on all active adapters
    const changedAdapters: string[] = [];
    for (const adapter of adapters) {
      try {
        await setAdapterDNS(adapter.interfaceName, ADGUARD_DNS.primary, ADGUARD_DNS.secondary);
        changedAdapters.push(adapter.name);
      } catch (err) {
        console.error(`Failed to set DNS for ${adapter.name}:`, err);
      }
    }

    // Flush DNS cache
    try {
      await execAsync('ipconfig /flushdns', { windowsHide: true });
      console.log('DNS cache flushed');
    } catch (err) {
      console.error('Failed to flush DNS cache:', err);
    }

    if (changedAdapters.length === 0) {
      return {
        success: false,
        message: 'Failed to enable ad blocking on any network adapter.',
        adapters: [],
      };
    }

    return {
      success: true,
      message: `Ad blocking enabled on ${changedAdapters.length} adapter(s) using AdGuard DNS.`,
      adapters: changedAdapters,
    };
  } catch (error: any) {
    console.error('Failed to enable ad blocking:', error);
    return {
      success: false,
      message: error.message || 'Failed to enable ad blocking.',
      adapters: [],
    };
  }
}

/**
 * Disable system-wide ad blocking and restore original DNS
 */
export async function disableSystemAdBlock(): Promise<{ success: boolean; message: string }> {
  try {
    if (originalAdapters.length === 0) {
      // Try to get adapters and restore to DHCP
      const adapters = await getNetworkAdapters();
      for (const adapter of adapters) {
        try {
          await restoreAdapterDNS(adapter.interfaceName, ['DHCP']);
        } catch (err) {
          console.error(`Failed to restore ${adapter.name}:`, err);
        }
      }
      
      // Flush DNS cache
      await execAsync('ipconfig /flushdns', { windowsHide: true });
      
      return {
        success: true,
        message: 'Ad blocking disabled. DNS reset to DHCP.',
      };
    }

    // Restore original DNS settings
    for (const adapter of originalAdapters) {
      try {
        await restoreAdapterDNS(adapter.interfaceName, adapter.originalDNS);
      } catch (err) {
        console.error(`Failed to restore DNS for ${adapter.name}:`, err);
      }
    }

    // Flush DNS cache
    await execAsync('ipconfig /flushdns', { windowsHide: true });

    originalAdapters = [];

    return {
      success: true,
      message: 'Ad blocking disabled. Original DNS settings restored.',
    };
  } catch (error: any) {
    console.error('Failed to disable ad blocking:', error);
    return {
      success: false,
      message: error.message || 'Failed to disable ad blocking.',
    };
  }
}

/**
 * Check if running with administrator privileges
 */
async function checkAdminPrivileges(): Promise<boolean> {
  try {
    // Try to write to a system directory to check admin privileges
    const { stdout } = await execAsync(
      'powershell -Command "([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"'
    );
    return stdout.trim().toLowerCase() === 'true';
  } catch (error) {
    return false;
  }
}
