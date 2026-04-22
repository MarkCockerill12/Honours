const { contextBridge, ipcRenderer } = require("electron");

// Expose system ad block functions to renderer process
contextBridge.exposeInMainWorld("electron", {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  systemAdBlock: {
    checkStatus: () => ipcRenderer.invoke("adblock:check-status"),
    enable: () => ipcRenderer.invoke("adblock:enable"),
    disable: () => ipcRenderer.invoke("adblock:disable"),
    flushDns: () => ipcRenderer.invoke("adblock:flush-dns"),
    testDns: () => ipcRenderer.invoke("adblock:test-dns"),
    forceReset: () => ipcRenderer.invoke("adblock:force-reset"),
    getStats: () => ipcRenderer.invoke("adblock:get-stats"),
    setIntent: (enabled) => ipcRenderer.invoke("adblock:set-intent", enabled),
    recordBlock: (data) => ipcRenderer.invoke("adblock:record-block", data),
  },
  system: {
    getDnsInfo: () => ipcRenderer.invoke("system:get-dns-info"),
  },
  vpn: {
    toggle: (config) => ipcRenderer.invoke("vpn:toggle", config),
    provision: (serverId) => ipcRenderer.invoke("vpn:provision", serverId),
    deprovision: (serverId) => ipcRenderer.invoke("vpn:deprovision", serverId),
    getStatus: () => ipcRenderer.invoke("vpn:get-status"),
    onStatus: (callback) => {
      const listener = (_event, message) => callback(message);
      ipcRenderer.on("vpn:status", listener);
      return () => ipcRenderer.removeListener("vpn:status", listener);
    },
  },
});
