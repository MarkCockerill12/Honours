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
    adblockEnabled: true,
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
      blockTerm: "doubleclick",
      exceptWhen: "",
      enabled: true,
      blockScope: "word",
    },
  ]);

  // Sync stats with Electron if available
  useEffect(() => {
    const api = (globalThis.window as any).electron;
    if (api?.systemAdBlock) {
      console.log("[ExtensionPage] Electron context detected. Syncing stats...");
    }
  }, []);

  const handleProtectionToggle = () => {
    console.log("[ExtensionPage] Protection toggled");
    setProtection((prev) => ({ ...prev, isActive: !prev.isActive }));
  };

  const handleVpnToggle = () => {
    console.log("[ExtensionPage] VPN toggled");
    setProtection((prev) => ({ ...prev, vpnEnabled: !prev.vpnEnabled }));
  };

  const handleAdblockToggle = async () => {
    console.log("[ExtensionPage] Adblock toggled");
    const newState = !protection.adblockEnabled;
    setProtection((prev) => ({ ...prev, adblockEnabled: newState }));

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
      <div className="min-h-screen p-8 bg-zinc-950 flex flex-col items-center">
        {/* Extension UI */}
        <ExtensionApp
          protection={protection}
          onProtectionToggle={handleProtectionToggle}
          onVpnToggle={handleVpnToggle}
          onAdblockToggle={handleAdblockToggle}
          filters={filters}
          onFiltersChange={setFilters}
        />

        {/* Test Content for Scanner - Real Links */}
        <div
          ref={testContentRef}
          className="mt-8 p-4 bg-zinc-900 rounded-lg max-w-2xl"
        >
          <h3 className="text-white text-sm font-bold mb-3">
            Test Content (for scanning)
          </h3>
          <p className="text-zinc-400 text-xs mb-3">
            These are real links for testing the scanner. Some contain nsfw and
            war keywords for filter testing.
          </p>
          <div className="space-y-2 text-xs">
            <p className="text-zinc-300">
              Check out{" "}
              <a
                href="https://www.google.com"
                className="text-blue-400 underline"
              >
                Google
              </a>{" "}
              for search. Visit{" "}
              <a href="https://github.com" className="text-blue-400 underline">
                GitHub
              </a>{" "}
              for code. Read the{" "}
              <a
                href="https://www.wikipedia.org"
                className="text-blue-400 underline"
              >
                Wikipedia
              </a>{" "}
              article.
            </p>
            <p className="text-zinc-300">
              Some violence content here for testing filters. Also war topics and nsfw material mentioned together: violence, nsfw, and war.
            </p>
            <p className="text-zinc-300">
              External links:{" "}
              <a
                href="https://www.reddit.com"
                className="text-blue-400 underline"
              >
                Reddit
              </a>
              ,{" "}
              <a
                href="https://stackoverflow.com"
                className="text-blue-400 underline ml-2"
              >
                Stack Overflow
              </a>
              ,{" "}
              <a
                href="https://developer.mozilla.org"
                className="text-blue-400 underline ml-2"
              >
                MDN
              </a>
            </p>
            <p className="text-zinc-300">
              Test links:{" "}
              <a
                href="https://example.com/file.exe"
                className="text-orange-400 underline"
              >
                Download EXE
              </a>{" "}
              (should be flagged),{" "}
              <a
                href="https://login-apple-id.com"
                className="text-orange-400 underline ml-2"
              >
                Apple Login
              </a>{" "}
              (phishing test)
            </p>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
