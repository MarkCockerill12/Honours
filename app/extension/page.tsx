"use client";
import React, { useState, useEffect, useRef } from "react";
import ExtensionApp from "./ExtensionApp";
import { ThemeProvider } from "@/components/ThemeProvider";
import type { Theme, ProtectionState, SmartFilter } from "@/components/types";
import { DEFAULT_PROTECTION_STATE, DEFAULT_FILTERS } from "@/lib/constants";
import { blurContent, clearBlurContent } from "./Utils/content";
import { chromeBridge } from "./Utils/chromeBridge";

export default function ExtensionPage() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [protection, setProtection] = useState<ProtectionState>(DEFAULT_PROTECTION_STATE);

  const testContentRef = useRef<HTMLDivElement>(null);

  const [filters, setFilters] = useState<SmartFilter[]>(DEFAULT_FILTERS);

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


  const handleVpnToggle = () => {
    console.log("[ExtensionPage] VPN toggled");
    persistProtection({ ...protection, vpnEnabled: !protection.vpnEnabled });
  };

  const handleMasterToggle = () => {
    console.log("[ExtensionPage] Master toggle clicked");
    const newState = !protection.isActive;
    persistProtection({ ...protection, isActive: newState });
    
    // Notify backgrounds/tabs of master state change if needed
    chromeBridge.sendMessage(0, { action: "TOGGLE_MASTER", enabled: newState });

    if (typeof chrome !== "undefined") {
      chrome.tabs?.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          // Send current state to ensure immediate reaction
          chromeBridge.sendMessage(tabs[0].id, {
            action: "APPLY_FILTERS",
            isActive: newState,
            filteringEnabled: protection.filteringEnabled,
            filters,
            blurMethod: "blur"
          });
        }
      });
    }
  };

  const handleFilteringToggle = () => {
    console.log("[ExtensionPage] Filtering toggled");
    const newState = !protection.filteringEnabled;
    const newProt = { ...protection, filteringEnabled: newState };
    persistProtection(newProt);
    
    chromeBridge.sendMessage(0, { action: "TOGGLE_FILTERING", enabled: newState });
    
    if (typeof chrome !== "undefined") {
      chrome.tabs?.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chromeBridge.sendMessage(tabs[0].id, {
            action: "APPLY_FILTERS",
            isActive: protection.isActive,
            filteringEnabled: newState,
            filters,
            blurMethod: "blur"
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
    chromeBridge.sendMessage(0, { action: "TOGGLE_ADBLOCK", enabled: newState });

    if (typeof chrome !== "undefined") {
      chrome.tabs?.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chromeBridge.sendMessage(tabs[0].id, {
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
          onProtectionToggle={handleMasterToggle}
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

