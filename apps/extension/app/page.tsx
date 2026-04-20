"use client";
import React, { useState, useEffect } from "react";
import ExtensionApp from "../ExtensionApp";
import { ThemeProvider } from "@privacy-shield/core";
import type { Theme, ProtectionState, SmartFilter } from "@privacy-shield/core";
import { DEFAULT_PROTECTION_STATE, DEFAULT_FILTERS } from "@privacy-shield/core";
import { chromeBridge } from "../utils/chromeBridge";

export default function ExtensionPage() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [protection, setProtection] = useState<ProtectionState>(DEFAULT_PROTECTION_STATE);

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

  const handleVpnToggle = () => {
    console.log("[ExtensionPage] VPN toggled");
    persistProtection({ ...protection, vpnEnabled: !protection.vpnEnabled });
  };

  const handleMasterToggle = () => {
    console.log("[ExtensionPage] Master toggle clicked");
    const newState = !protection.isActive;
    persistProtection({ ...protection, isActive: newState });
    
    // Notify backgrounds/tabs of master state change if needed
    chromeBridge.sendMessage(undefined, { action: "TOGGLE_MASTER", enabled: newState });

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
    
    chromeBridge.sendMessage(undefined, { action: "TOGGLE_FILTERING", enabled: newState });
    
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

    // 2. FOR CHROME: Send message to background
    chromeBridge.sendMessage(undefined, { action: "TOGGLE_ADBLOCK", enabled: newState });

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

  return (
    <ThemeProvider theme={theme} setTheme={setTheme}>
      <ExtensionApp
        protection={protection}
        onProtectionToggle={handleMasterToggle}
        onVpnToggle={handleVpnToggle}
        onAdblockToggle={handleAdblockToggle}
        onFilteringToggle={handleFilteringToggle}
        filters={filters}
        onFiltersChange={persistFilters}
      />
    </ThemeProvider>
  );
}

