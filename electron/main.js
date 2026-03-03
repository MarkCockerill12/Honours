const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { exec } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs');

const execAsync = promisify(exec);

// AdGuard DNS servers for ad blocking
const ADGUARD_DNS = {
  ipv4: ['94.140.14.14', '94.140.15.15'],
  ipv6: ['2a10:50c0::ad1:ff', '2a10:50c0::ad2:ff']
};

// Dynamic blocklist from StevenBlack (populated at runtime)
let DYNAMIC_HOSTS_BLOCKLIST = [];

const HOSTS_PATH = process.platform === 'win32' 
  ? String.raw`C:\Windows\System32\drivers\etc\hosts` 
  : '/etc/hosts';

const HOSTS_MARKER_START = '# --- Honours AdBlock Start ---';
const HOSTS_MARKER_END = '# --- Honours AdBlock End ---';

// Path to persist original DNS settings across app restarts
const DNS_BACKUP_PATH = path.join(app.getPath('userData'), 'dns-backup.json');
const HOSTS_CACHE_PATH = path.join(app.getPath('userData'), 'hosts-cache.txt');

let originalAdapters = [];

// Helper to get public IP
async function getPublicIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    if (!response.ok) return 'Unknown (Status Error)';
    const data = await response.json();
    return data.ip || 'Unknown (Missing IP)';
  } catch (err) {
    console.warn('[!] Failed to fetch public IP:', err.message);
    return 'Unknown (Connection Failed)';
  }
}

// Fetch a real blocklist for system-wide protection
async function refreshBlocklist() {
  try {
    console.log('Fetching StevenBlack hosts list for system protection...');
    const response = await fetch('https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts');
    const text = await response.text();
    
    // Process the hosts file - we only want the 0.0.0.0 entries
    const lines = text.split('\n')
      .filter(line => line.startsWith('0.0.0.0') && !line.includes('0.0.0.0 0.0.0.0'))
      .map(line => line.trim());
    
    DYNAMIC_HOSTS_BLOCKLIST = lines;
    fs.writeFileSync(HOSTS_CACHE_PATH, lines.join('\n'), 'utf8');
    console.log(`System blocklist updated: ${lines.length} domains cached.`);
  } catch (err) {
    console.error('Failed to fetch remote blocklist, using cache or fallback:', err.message);
    if (fs.existsSync(HOSTS_CACHE_PATH)) {
      DYNAMIC_HOSTS_BLOCKLIST = fs.readFileSync(HOSTS_CACHE_PATH, 'utf8').split('\n');
    }
  }
}

// Helper to filter out AdGuard DNS from list by pattern to avoid normalization issues

function cleanDnsList(dnsList) {
  if (!dnsList || !Array.isArray(dnsList)) return [];
  // AdGuard DNS starts with 94.140 or contains :ad1: or :ad2:
  return dnsList.filter(ip => {
    if (!ip) return false;
    const s = String(ip).toLowerCase();
    // IPv4 patterns
    if (s.startsWith('94.140.')) return false;
    // IPv6 patterns (AdGuard uses :ad1:ff and :ad2:ff)
    if (s.includes(':ad1:') || s.includes(':ad2:')) return false;
    return true;
  });
}

// Load persisted DNS backup if it exists
function loadDnsBackup() {
  try {
    if (fs.existsSync(DNS_BACKUP_PATH)) {
      const data = fs.readFileSync(DNS_BACKUP_PATH, 'utf8');
      const loaded = JSON.parse(data);
      // Only trust it if it actually contains adapter info
      if (Array.isArray(loaded) && loaded.length > 0) {
        originalAdapters = loaded;
        console.log('--- RECOVERED DNS BACKUP ---');
        originalAdapters.forEach(a => {
            console.log(`Adapter: ${a.name} | V4: ${a.originalIPv4.join(',')} | V6: ${a.originalIPv6.join(',')}`);
        });
      }
    }
  } catch (err) {
    console.warn('Backup recovery skipped or failed:', err.message);
    originalAdapters = [];
  }
}

// Save DNS backup to disk
function saveDnsBackup(adapters) {
  try {
    fs.writeFileSync(DNS_BACKUP_PATH, JSON.stringify(adapters, null, 2), 'utf8');
    console.log('Saved DNS backup');
  } catch (err) {
    console.error('Failed to save DNS backup:', err);
  }
}

// Clear DNS backup from disk
function clearDnsBackup() {
  try {
    if (fs.existsSync(DNS_BACKUP_PATH)) {
      fs.unlinkSync(DNS_BACKUP_PATH);
      console.log('Cleared DNS backup');
    }
  } catch (err) {
    console.error('Failed to clear DNS backup:', err);
  }
}

// System Ad Block Functions
async function getNetworkAdapters() {
  try {
    // 1. Get unique interface aliases that have DNS addresses assigned (means they are active)
    const getAliasesCmd = 'powershell -Command "Get-DnsClientServerAddress | Select-Object -ExpandProperty InterfaceAlias -Unique"';
    let namesOut;
    try {
      const result = await execAsync(getAliasesCmd, { windowsHide: true });
      namesOut = result.stdout;
    } catch {
      namesOut = "";
    }
    
    if (!namesOut || namesOut.trim() === "") {
      // Fallback: Just get all adapters
      const fallbackCmd = 'powershell -Command "Get-NetAdapter | Select-Object -ExpandProperty Name"';
      const { stdout: fallbackOut } = await execAsync(fallbackCmd, { windowsHide: true }).catch(() => ({ stdout: "" }));
      if (!fallbackOut || fallbackOut.trim() === "") {
          console.warn("No network adapters found via PowerShell.");
          return [];
      }
      namesOut = fallbackOut;
    }
    
    // Split by newline and clean names
    const activeNames = namesOut.trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    
    const results = [];
    for (const name of activeNames) {
      // Fetch DNS settings individually in Node for reliability
      const v4Cmd = `powershell -Command "Get-DnsClientServerAddress -InterfaceAlias '${name}' -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ServerAddresses"`;
      const v6Cmd = `powershell -Command "Get-DnsClientServerAddress -InterfaceAlias '${name}' -AddressFamily IPv6 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ServerAddresses"`;
      
      const { stdout: v4Out } = await execAsync(v4Cmd, { windowsHide: true }).catch(() => ({ stdout: '' }));
      const { stdout: v6Out } = await execAsync(v6Cmd, { windowsHide: true }).catch(() => ({ stdout: '' }));
      
      const v4 = (v4Out || "").trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const v6 = (v6Out || "").trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      
      results.push({
        name: name,
        interfaceName: name,
        originalIPv4: v4.length > 0 ? v4 : ['DHCP'],
        originalIPv6: v6.length > 0 ? v6 : ['DHCP']
      });
    }
    
    return results;
  } catch (err) {
    console.error('Critical Error in getNetworkAdapters:', err.message);
    return [];
  }
}

async function checkAdminPrivileges() {
  try {
    const { stdout } = await execAsync(
      'powershell -Command "([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"'
    );
    return stdout.trim().toLowerCase() === 'true';
  } catch (err) {
    console.warn('Admin check failed:', err.message);
    return false;
  }
}

async function restoreAllAdapterDNS(savedAdapters) {
  try {
    console.log('--- STARTING DNS RESTORATION ---');
    
    // 1. Restore from backup if available (Preferred method)
    if (savedAdapters && savedAdapters.length > 0) {
      console.log(`Restoring ${savedAdapters.length} adapters from backup...`);
      const commands = savedAdapters.map(adapter => {
        let script = '';
        const name = adapter.interfaceName;

        const needsResetV4 = !adapter.originalIPv4 || adapter.originalIPv4.includes('DHCP') || cleanDnsList(adapter.originalIPv4).length === 0;
        const needsResetV6 = !adapter.originalIPv6 || adapter.originalIPv6.includes('DHCP') || cleanDnsList(adapter.originalIPv6).length === 0;

        if (needsResetV4 && needsResetV6) {
          script += `Set-DnsClientServerAddress -InterfaceAlias '${name}' -ResetServerAddresses; `;
        } else {
          const v4 = needsResetV4 ? [] : cleanDnsList(adapter.originalIPv4);
          const v6 = needsResetV6 ? [] : cleanDnsList(adapter.originalIPv6);
          
          if (v4.length === 0 && v6.length === 0) {
            script += `Set-DnsClientServerAddress -InterfaceAlias '${name}' -ResetServerAddresses; `;
          } else {
            // Restore specific static IPs
            const v4 = needsResetV4 ? [] : cleanDnsList(adapter.originalIPv4);
            const v6 = needsResetV6 ? [] : cleanDnsList(adapter.originalIPv6);
            
            // Collect all IP strings to restore
            const allIPs = [...v4, ...v6];
            const ipListString = allIPs.map(ip => `'${ip}'`).join(',');
            
            // Set-DnsClientServerAddress handles mixed v4/v6 addresses in the -ServerAddresses array
            script = `Set-DnsClientServerAddress -InterfaceAlias '${name}' -ServerAddresses @(${ipListString}); `;
          }
        }
        return script;
      }).join(' ');

      if (commands) {
        await execAsync(`powershell -Command "${commands}"`, { windowsHide: true });
        console.log('Restoration commands executed.');
      }
    }

    // 2. SAFETY NET: Aggressively finding ANY adapter still using AdGuard
    console.log('Running safety sweep for stuck adapters...');
    const adGuardPattern = "94.140.|:ad1:|:ad2:";
    const cleanupCmd = `
      $adapters = Get-DnsClientServerAddress;
      foreach ($a in $adapters) {
          $ips = $a.ServerAddresses -join ',';
          if ($ips -match '${adGuardPattern}') {
              Write-Output "Resetting stuck adapter: $($a.InterfaceAlias)";
              Set-DnsClientServerAddress -InterfaceAlias $a.InterfaceAlias -ResetServerAddresses;
          }
      }
    `;
    await execAsync(`powershell -Command "${cleanupCmd}"`, { windowsHide: true });

    await execAsync('ipconfig /flushdns', { windowsHide: true }).catch(() => {});
    console.log('DNS Restoration Complete.');
    
  } catch (err) {
    console.error('Critical Error in restoreAllAdapterDNS:', err);
  }
}

async function updateHostsFile(enable) {
  try {
    let content = fs.readFileSync(HOSTS_PATH, 'utf8');
    const hasMarker = content.includes(HOSTS_MARKER_START);

    if (enable) {
      if (hasMarker) {
        // Remove old and re-add to ensure list is fresh
        const regex = new RegExp(String.raw`${HOSTS_MARKER_START}[\s\S]*?${HOSTS_MARKER_END}\s*`, 'g');
        content = content.replaceAll(regex, '');
      }
      
      const blockList = DYNAMIC_HOSTS_BLOCKLIST.length > 0 
        ? DYNAMIC_HOSTS_BLOCKLIST 
        : ['0.0.0.0 doubleclick.net', '0.0.0.0 googleadservices.com']; // Minimal fallback

      const entries = [
        '\n' + HOSTS_MARKER_START,
        ...blockList,
        HOSTS_MARKER_END + '\n'
      ].join('\n');
      
      fs.writeFileSync(HOSTS_PATH, content.trim() + '\n' + entries);
      console.log(`Hosts file updated with ${blockList.length} domains.`);
    } else {
      if (!hasMarker) return; // already disabled
      const regex = new RegExp(String.raw`${HOSTS_MARKER_START}[\s\S]*?${HOSTS_MARKER_END}\s*`, 'g');
      content = content.replaceAll(regex, '');
      fs.writeFileSync(HOSTS_PATH, content.trim() + '\n');
      console.log('Hosts file restored');
    }
  } catch (err) {
    console.error('Failed to update hosts file:', err.message);
  }
}


// IPC Handlers for system ad blocking
ipcMain.handle('adblock:check-status', async () => {
  try {
    const isAdmin = await checkAdminPrivileges();
    if (!isAdmin) return { active: false, adapters: [], error: 'Not Admin' };

    // Check both DNS and Hosts file (robustly)
    const hostsContent = fs.readFileSync(HOSTS_PATH, 'utf8');
    const hostsActive = hostsContent.includes(HOSTS_MARKER_START);

    const adapters = await getNetworkAdapters();
    const activeAdapters = adapters
      .filter(a => {
          // Flatten all current DNS IPs for this adapter
          const allDns = [...(a.originalIPv4 || []), ...(a.originalIPv6 || [])];
          // Use the pattern check from cleanDnsList (we want the OPPOSITE here: true if matches AdGuard)
          return allDns.some(ip => {
              if (!ip) return false;
              const s = String(ip).toLowerCase();
              return s.startsWith('94.140.') || s.includes(':ad1:') || s.includes(':ad2:');
          });
      })
      .map(a => a.name);

    return {
      active: activeAdapters.length > 0 || hostsActive,
      adapters: activeAdapters,
    };
  } catch (error) {
    console.warn('Status check failed:', error.message);
    return { active: false, adapters: [] };
  }
});

// TEST DNS IPC: Check if ad-blocking is actually working by resolving a known blocked domain
ipcMain.handle('adblock:test-dns', async () => {
    try {
        const testDomain = 'doubleclick.net';
        console.log(`[TEST] Running nslookup for ${testDomain}...`);
        
        // Timeout the nslookup after 5 seconds to prevent hanging
        const { stdout, stderr } = await execAsync(`nslookup ${testDomain}`, { windowsHide: true, timeout: 5000 });
        
        const output = (stdout + stderr).toLowerCase();
        
        // AdGuard blocking indicators:
        // 1. Returns 0.0.0.0
        // 2. Returns :: (IPv6 zero)
        // 3. Returns NXDOMAIN / Non-existent domain
        const isBlockedIP = output.includes('0.0.0.0') || output.includes('::') || output.includes('127.0.0.1');
        const isNX = output.includes('non-existent domain') || output.includes('nxdomain');
        // Check if the server performing the lookup is AdGuard
        const isAdGuardServer = output.includes('94.140.') || output.includes('2a10:50c0:') || output.includes(':ad1:') || output.includes(':ad2:');

        // If it's AdGuard responding (even with error/refusal) OR we see blocked IPs, success.
        const isBlocked = isBlockedIP || isNX || (isAdGuardServer && output.includes('request timed out'));
        
        console.log(`[TEST] Result: ${isBlocked ? 'BLOCKED' : 'RESOLVING'} (Server: ${isAdGuardServer ? 'AdGuard' : 'Other'})`);
        
        return { isBlocked, output: output.trim() };
    } catch (err) {
        const msg = (err.message + (err.stdout || "") + (err.stderr || "")).toLowerCase();
        
        // Check for success indicators in error output
        const isAdGuardRelated = msg.includes('94.140.') || msg.includes('2a10:50c0:') || msg.includes(':ad1:') || msg.includes(':ad2:');
        const isNX = msg.includes('non-existent domain') || msg.includes('nxdomain');
        
        // If it timed out, or is NXDOMAIN, or is explicitly AdGuard refusing
        if (isNX || msg.includes('timed out') || msg.includes('no response') || (isAdGuardRelated && msg.includes('refused'))) {
             return { isBlocked: true, output: "Traffic Blocked (DNS Error/Timeout)" };
        }
        
        return { isBlocked: false, output: err.message }; 
    }
});

// FORCE RESET IPC: Emergency cleanup
ipcMain.handle('adblock:force-reset', async () => {
  console.log('--- EMERGENCY NETWORK RESET TRIGGERED ---');
  try {
      await restoreAllAdapterDNS([]); // Pass empty array to trigger the safety net
      await updateHostsFile(false);
      return { success: true, message: 'Network settings reset successfully.' };
  } catch (err) {
      return { success: false, message: 'Reset failed: ' + err.message };
  }
});

ipcMain.handle('adblock:enable', async () => {
  console.log('\n========================================');
  console.log('--- ENABLING SYSTEM-WIDE PROTECTION ---');
  console.log('========================================');
  try {
    const isAdmin = await checkAdminPrivileges();
    if (!isAdmin) {
      console.warn('[!] Status: ACCESS DENIED (Not Admin)');
      return { success: false, message: 'Administrator privileges required. Restart as Admin.' };
    }

    const initialIP = await getPublicIP();
    console.log(`[+] Step 1: Current Public IP: ${initialIP}`);

    const adapters = await getNetworkAdapters();
    if (adapters.length === 0) {
      console.warn('[!] Status: No active network adapters found.');
      return { success: false, message: 'No active network adapters found.' };
    }
    console.log(`[+] Step 2: Found ${adapters.length} active adapters.`);

    // Backup DNS and apply Hosts block
    if (originalAdapters.length === 0) {
      originalAdapters = adapters.map(a => ({
        ...a,
        originalIPv4: cleanDnsList(a.originalIPv4),
        originalIPv6: cleanDnsList(a.originalIPv6)
      }));
      originalAdapters.forEach(a => {
        if (a.originalIPv4.length === 0) a.originalIPv4 = ['DHCP'];
        if (a.originalIPv6.length === 0) a.originalIPv6 = ['DHCP'];
      });
      saveDnsBackup(originalAdapters);
      
      console.log('[+] Step 3: Original DNS Settings Captured:');
      originalAdapters.forEach(a => {
        console.log(`    - Adapter: ${a.name}`);
        console.log(`      V4: ${a.originalIPv4.join(', ')}`);
        console.log(`      V6: ${a.originalIPv6.join(', ')}`);
      });
    }

    // 1. Update Hosts File
    await updateHostsFile(true);
    console.log('[+] Step 4: System Hosts file updated with blocklist.');

    // 2. Batch DNS Enable Command
    const v4Servers = ADGUARD_DNS.ipv4.map(d => `'${d}'`);
    const v6Servers = ADGUARD_DNS.ipv6.map(d => `'${d}'`);
    const allServers = [...v4Servers, ...v6Servers].join(',');
    
    console.log(`[+] Step 5: Applying AdGuard DNS: ${ADGUARD_DNS.ipv4.join(', ')}`);

    // Set-DnsClientServerAddress will intelligently assign family based on the addresses.
    const enableCommands = adapters.map(a => 
      `Set-DnsClientServerAddress -InterfaceAlias '${a.interfaceName}' -ServerAddresses @(${allServers}) -ErrorAction SilentlyContinue;`
    ).join(' ');

    await execAsync(`powershell -Command "${enableCommands}"`, { windowsHide: true });

    // 3. Flush Cache
    await execAsync('powershell -Command "ipconfig /flushdns; nbtstat -R; nbtstat -RR"', { windowsHide: true }).catch(() => {});
    console.log('[+] Step 6: Network caches flushed.');

    const finalIP = await getPublicIP();
    console.log(`[+] Step 7: Final Public IP: ${finalIP}`);
    console.log('========================================');
    console.log('--- PROTECTION ACTIVE ---');
    console.log('========================================\n');

    return {
      success: true,
      message: `System Active: DNS and Hosts protection enabled across ${adapters.length} adapters.`,
    };
  } catch (error) {
    console.error('[ERROR] Failed to enable ad blocking:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('adblock:disable', async () => {
  console.log('\n========================================');
  console.log('--- DISABLING SYSTEM-WIDE PROTECTION ---');
  console.log('========================================');
  try {
    const initialIP = await getPublicIP();
    console.log(`[+] Step 1: Current Public IP: ${initialIP}`);

    // 1. Restore Hosts File
    await updateHostsFile(false);
    console.log('[+] Step 2: System Hosts file restored.');

    // 2. Restore DNS
    const adaptersToRestore = originalAdapters.length > 0 ? originalAdapters : await getNetworkAdapters();
    
    console.log(`[+] Step 3: Restoring DNS for ${adaptersToRestore.length} adapters...`);
    await restoreAllAdapterDNS(adaptersToRestore);

    adaptersToRestore.forEach(a => {
        console.log(`    - Restored ${a.name} to:`);
        console.log(`      V4: ${a.originalIPv4.join(',')}`);
        console.log(`      V6: ${a.originalIPv6.join(',')}`);
    });

    originalAdapters = [];
    clearDnsBackup();

    await execAsync('powershell -Command "ipconfig /flushdns; nbtstat -R; nbtstat -RR"', { windowsHide: true }).catch(() => {});
    console.log('[+] Step 4: Network caches flushed.');

    const finalIP = await getPublicIP();
    console.log(`[+] Step 5: Final Public IP: ${finalIP}`);
    console.log('========================================');
    console.log('--- PROTECTION DISABLED ---');
    console.log('========================================\n');

    return {
      success: true,
      message: 'System Level AdBlock disabled. Settings restored.',
    };
  } catch (error) {
    console.error('[ERROR] Failed to disable ad blocking:', error);
    return {
      success: false,
      message: error.message || 'Failed to disable ad blocking.',
    };
  }
});

ipcMain.handle('adblock:flush-dns', async () => {
  try {
    await execAsync('ipconfig /flushdns', { windowsHide: true });
    await execAsync('nbtstat -R', { windowsHide: true });
    await execAsync('nbtstat -RR', { windowsHide: true });
    return { success: true, message: 'DNS and NetBIOS cache flushed.' };
  } catch (err) {
    console.warn('Flush failed:', err.message);
    return { success: false, message: err.message };
  }
});

ipcMain.handle('system:get-dns-info', async () => {
  try {
    const adapters = await getNetworkAdapters();
    const result = {};
    for (const adapter of adapters) {
      // Get all current DNS addresses regardless of family
      const { stdout: allOut } = await execAsync(`powershell "Get-DnsClientServerAddress -InterfaceAlias '${adapter.interfaceName}' | Select-Object -ExpandProperty ServerAddresses"`, { windowsHide: true });
      result[adapter.name] = (allOut?.trim()?.split(/\r?\n/) || []).map(d => d.trim()).filter(Boolean);
    }
    return result;
  } catch (err) {
    console.error('Failed to get DNS info details:', err);
    return {};
  }
});

let mainWindow;

function createWindow() {
  console.log('--- CREATING BROWSER WINDOW ---');
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true, // Show immediately to help debug
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Blocker - System Protection',
  });

  // HOT RELOAD MAGIC: Load the local Next.js server
  const startUrl = process.env.ELECTRON_START_URL || `http://localhost:3000/desktop`;
  
  console.log(`Loading URL: ${startUrl}`);
  
  mainWindow.loadURL(startUrl).catch(err => {
    console.error('Failed to load initially:', err);
    // If it fails, wait and retry until the dev server is ready
    setTimeout(() => {
        if (mainWindow) mainWindow.loadURL(startUrl);
    }, 2000);
  });

  // Log loading progress
  mainWindow.webContents.on('did-start-loading', () => console.log('--- WEBVIEW START LOADING ---'));
  mainWindow.webContents.on('did-finish-load', () => console.log('--- WEBVIEW FINISH LOAD ---'));
  mainWindow.webContents.on('did-fail-load', (e, code, desc) => console.error('--- WEBVIEW FAIL LOAD ---', code, desc));

  // Open DevTools by default in dev mode to help you see errors!
  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', function () {
    console.log('--- WINDOW CLOSED ---');
    mainWindow = null;
  });
}

async function startApp() {
  // Use whenReady to avoid race conditions with the 'ready' event
  await app.whenReady();
  loadDnsBackup();
  createWindow();
  
  // Background task to fetch latest blocklist
  refreshBlocklist();
  
  const isAdmin = await checkAdminPrivileges();

  if (!isAdmin) {
    console.error('CRITICAL: App started without Administrator privileges.');
  }
}

startApp().catch(err => {
  console.error('Critical boot error:', err);
  process.exit(1);
});

// Quit when all windows are closed, except on macOS. 
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

let isRestoring = false;

// Ensure DNS is restored if app quits while adblock is active
app.on('before-quit', async (event) => {
  if (isRestoring) {
    return;
  }

  if (originalAdapters && originalAdapters.length > 0) {
    event.preventDefault(); // Pause quit while we restore
    isRestoring = true;
    console.log('--- QUIT REQUESTED: RESTORING SETTINGS ---');
    try {
      await updateHostsFile(false);
      await restoreAllAdapterDNS(originalAdapters);
      console.log('DNS/Hosts restored. Safe to exit.');
      originalAdapters = [];
      clearDnsBackup();
    } catch (err) {
      console.error('Failed to restore DNS on quit:', err);
    } finally {
      process.nextTick(() => {
        app.quit(); // Finally exit properly
      });
    }
  } else {
      console.log('No modifications to restore. Exiting.');
  }
});

app.on('will-quit', () => {
    console.log('--- APP TERMINATING ---');
});
