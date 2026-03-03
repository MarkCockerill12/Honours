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
  },
  system: {
    getDnsInfo: () => ipcRenderer.invoke("system:get-dns-info"),
  },
});
