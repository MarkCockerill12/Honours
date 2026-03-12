"use client";
import React, { useState, useEffect, useRef } from "react";
import ExtensionApp from "@/apps/extension/ExtensionApp";
import { ThemeProvider } from "@/packages/ui/ThemeProvider";
import type { Theme, ProtectionState, SmartFilter } from "@/packages/ui/types";
import { blurContent, clearBlurContent } from "@/apps/extension/Utils/content";

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

  const handleProtectionToggle = () => {
    console.log("[ExtensionPage] Protection toggled");
    persistProtection({ ...protection, isActive: !protection.isActive });
  };

  const handleVpnToggle = () => {
    console.log("[ExtensionPage] VPN toggled");
    persistProtection({ ...protection, vpnEnabled: !protection.vpnEnabled });
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
    try {
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage(
          { action: "TOGGLE_ADBLOCK", enabled: newState }
        );

        chrome.tabs?.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: newState ? "ENABLE_ADBLOCK" : "DISABLE_ADBLOCK",
            });
          }
        });
      }
    } catch (error) {
       // silence if not in chrome
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
          onProtectionToggle={handleProtectionToggle}
          onVpnToggle={handleVpnToggle}
          onAdblockToggle={handleAdblockToggle}
          filters={filters}
          onFiltersChange={persistFilters}
        />
      </div>
    </ThemeProvider>
  );
}
