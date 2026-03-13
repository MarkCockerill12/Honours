"use client";
import React, { useState, useEffect, useRef } from "react";
import ExtensionApp from "./ExtensionApp";
import { ThemeProvider } from "@/components/ThemeProvider";
import type { Theme, ProtectionState, SmartFilter } from "@/components/types";
import { blurContent, clearBlurContent } from "./Utils/content";

export default function ExtensionPage() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [protection, setProtection] = useState<ProtectionState>({
    isActive: false,
    vpnEnabled: true,
    adblockEnabled: false,
  });

  const testContentRef = useRef<HTMLDivElement>(null);

  const [filters, setFilters] = useState<SmartFilter[]>([
    {
      id: "1",
      blockTerm: "facebook",
      exceptWhen: "",
      enabled: true,
      blockScope: "word",
    },
    {
      id: "2",
      blockTerm: "advertisement",
      exceptWhen: "",
      enabled: true,
      blockScope: "paragraph",
    },
    {
      id: "3",
      blockTerm: "malware",
      exceptWhen: "",
      enabled: true,
      blockScope: "page-warning",
    },
    {
      id: "4",
      blockTerm: "doubleclick",
      exceptWhen: "",
      enabled: true,
      blockScope: "word",
    },
  ]);

  // Load initial state from Chrome Storage
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(["protectionState", "filters"], (result) => {
        if (result.protectionState) {
          setProtection(result.protectionState as ProtectionState);
        }
        if (result.filters) {
          setFilters(result.filters as SmartFilter[]);
        }
      });
    }
  }, []);

  // Sync state changes back to Chrome Storage
  const persistProtection = (newState: ProtectionState) => {
    setProtection(newState);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ protectionState: newState });
    }
  };

  const persistFilters = (newFilters: SmartFilter[]) => {
    setFilters(newFilters);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ filters: newFilters });
    }
  };

  // Sync stats with Electron if available
  useEffect(() => {
    const api = (globalThis.window as any).electron;
    if (api?.systemAdBlock) {
      console.log("[ExtensionPage] Electron context detected. Syncing stats...");
    }
  }, []);

  const safeSendMessage = async (message: any) => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            console.debug("[Popup] Message error (silenced):", chrome.runtime.lastError.message);
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response);
          }
        });
      });
    }
  };

  const handleVpnToggle = () => {
    console.log("[ExtensionPage] VPN toggled");
    persistProtection({ ...protection, vpnEnabled: !protection.vpnEnabled });
  };

  const handleFilteringToggle = () => {
    console.log("[ExtensionPage] Filtering toggled");
    const newState = !protection.isActive;
    const newProt = { ...protection, isActive: newState };
    persistProtection(newProt);
    
    safeSendMessage({ action: "TOGGLE_FILTERING", enabled: newState });
    
    if (typeof chrome !== "undefined") {
      chrome.tabs?.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: newState ? "ENABLE_FILTERING" : "DISABLE_FILTERING",
          });
        }
      });
    }
  };

  const handleAdblockToggle = async () => {
    console.log("[ExtensionPage] Adblock toggled");
    const newState = !protection.adblockEnabled;
    persistProtection({ ...protection, adblockEnabled: newState });

    // 1. FOR ELECTRON: Toggle system-wide adblocking
    const api = (globalThis.window as any).electron;
    if (api?.systemAdBlock) {
      try {
        if (newState) await api.systemAdBlock.enable();
        else await api.systemAdBlock.disable();
      } catch (err) {
        console.error("[ExtensionPage] System toggle failed:", err);
      }
    }

    // 2. FOR CHROME: Send message to background
    safeSendMessage({ action: "TOGGLE_ADBLOCK", enabled: newState });

    if (typeof chrome !== "undefined") {
      chrome.tabs?.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: newState ? "ENABLE_ADBLOCK" : "DISABLE_ADBLOCK",
          });
        }
      });
    }
  };

  useEffect(() => {
    // Clear existing filters first to avoid duplication/overlapping
    clearBlurContent();

    if (protection.adblockEnabled && testContentRef.current) {
      console.log("[ExtensionPage] Applying blurContent with filters:", filters);
      blurContent(testContentRef.current, filters, "blur");
    }
  }, [protection.adblockEnabled, filters]);

  return (
    <ThemeProvider theme={theme} setTheme={setTheme}>
      <div className="w-[400px] h-[600px] bg-zinc-950 overflow-y-auto">
        <ExtensionApp
          protection={protection}
          onProtectionToggle={handleFilteringToggle}
          onVpnToggle={handleVpnToggle}
          onAdblockToggle={handleAdblockToggle}
          onFilteringToggle={handleFilteringToggle}
          filters={filters}
          onFiltersChange={persistFilters}
        />
      </div>
    </ThemeProvider>
  );
}

