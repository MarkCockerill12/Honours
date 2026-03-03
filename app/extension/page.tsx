"use client";
import React, { useState, useEffect } from "react";
import ExtensionApp from "@/apps/extension/ExtensionApp";
import { ThemeProvider } from "@/packages/ui/ThemeProvider";
import type { Theme, ProtectionState } from "@/packages/ui/types";

export default function ExtensionPage() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [protection, setProtection] = useState<ProtectionState>({
    isActive: false,
    vpnEnabled: true,
    adblockEnabled: true,
  });

  // Setup console log interceptor for dev mode
  useEffect(() => {
    console.log("[ExtensionPage] Component mounted - Development mode active");
    console.log(
      "[ExtensionPage] Chrome extension APIs available:",
      typeof chrome !== "undefined" && !!chrome.tabs,
    );

    // Listen for messages from child iframes (for dev mode testing)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.action === "EXECUTE_SCAN") {
        console.log(
          "[ExtensionPage] Received EXECUTE_SCAN message from iframe",
        );
      }
    };

    window.addEventListener("message", handleMessage);

    // Notify child iframes that we are ready (simulating extension bridge)
    const iframes = document.querySelectorAll("iframe");
    iframes.forEach((iframe) => {
      iframe.contentWindow?.postMessage(
        { action: "CHROME_BRIDGE_READY", available: true },
        "*",
      );
    });

    // Also handle immediate readiness for cases like current page hosting the component
    window.postMessage({ action: "CHROME_BRIDGE_READY", available: true }, "*");

    return () => {
      window.removeEventListener("message", handleMessage);
    };
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

    // Send message to background to toggle ad blocking
    try {
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage(
          { action: "TOGGLE_ADBLOCK", enabled: newState },
          (response) => {
            console.log("[ExtensionPage] Adblock toggle response:", response);
          },
        );

        // Also send to content scripts to enable/disable element hiding
        chrome.tabs?.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: newState ? "ENABLE_ADBLOCK" : "DISABLE_ADBLOCK",
            });
          }
        });
      }
    } catch (error) {
      console.error("[ExtensionPage] Error toggling adblock:", error);
    }
  };

  return (
    <ThemeProvider theme={theme} setTheme={setTheme}>
      <div className="min-h-screen p-8 bg-zinc-950 flex flex-col items-center">
        {/* Extension UI */}
        <ExtensionApp
          protection={protection}
          onProtectionToggle={handleProtectionToggle}
          onVpnToggle={handleVpnToggle}
          onAdblockToggle={handleAdblockToggle}
        />

        {/* Test Content for Scanner - Real Links */}
        <div className="mt-8 p-4 bg-zinc-900 rounded-lg max-w-2xl">
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
              Some violence content here for testing filters. Also war topics
              and nsfw material mentioned.
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
