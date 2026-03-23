"use client";

import React, { useState, useRef, useEffect } from "react";
import { Monitor, Smartphone, Globe } from "lucide-react";
import anime from "animejs";
import { Button } from "@/components/ui/button";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useStats } from "@/components/StatsProvider";
import type {
  Theme,
  Platform,
  ProtectionState,
  ServerLocation,
} from "@/components/types";
import ExtensionApp from "./extension/ExtensionApp";
import { MobileApp } from "./mobile/MobileApp";
import { DesktopApp } from "./desktop/DesktopApp";
import { getVpnConfig, VPN_SERVERS } from "@/lib/vpn";

export default function Home() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [platform, setPlatform] = useState<Platform>("extension");
  const [protection, setProtection] = useState<ProtectionState>({
    isActive: false,
    vpnEnabled: false,
    adblockEnabled: false,
    filteringEnabled: false,
  });
  const [servers] = useState<ServerLocation[]>(VPN_SERVERS);
  const [selectedServer, setSelectedServer] = useState<ServerLocation>(VPN_SERVERS[0]);
  const { stats } = useStats();

  // Load initial state from Chrome storage if available
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(["protectionState"], (result) => {
        if (result.protectionState) {
          setProtection(result.protectionState as ProtectionState);
        }
      });
    }
  }, []);

  // Persist helper
  const persistProtection = (newState: ProtectionState) => {
    setProtection(newState);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ protectionState: newState });
    }
  };

  const contentRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Content switch animation
  useEffect(() => {
    if (!contentRef.current) return;
    anime({
      targets: contentRef.current,
      opacity: [0, 1],
      translateY: [15, 0],
      duration: 500,
      easing: "easeOutExpo",
    });
  }, [platform]);

  // Tab buttons entrance
  useEffect(() => {
    if (!tabsRef.current) return;
    const buttons = tabsRef.current.querySelectorAll("button");
    anime({
      targets: buttons,
      scale: [0.8, 1],
      opacity: [0, 1],
      delay: anime.stagger(80),
      duration: 500,
      easing: "easeOutBack",
    });
  }, []);

  const handleProtectionToggle = () => {
    persistProtection({ ...protection, isActive: !protection.isActive });
  };

  const handleVpnToggle = async (selectedServerId?: string) => {
    const nextVpnEnabled = !protection.vpnEnabled;

    if (
      nextVpnEnabled &&
      platform === "extension" &&
      typeof chrome !== "undefined" &&
      chrome.storage?.local
    ) {
      try {
        const targetId = selectedServerId || selectedServer.id;
        const config = await getVpnConfig(targetId);
        await chrome.storage.local.set({
          vpnConfig: { publicIp: config.PublicIp },
        });
      } catch (err: any) {
        console.error("VPN Provisioning failed for extension:", err.message);
        return;
      }
    }

    persistProtection({ ...protection, vpnEnabled: nextVpnEnabled });
  };

  const handleAdblockToggle = () => {
    persistProtection({
      ...protection,
      adblockEnabled: !protection.adblockEnabled,
    });
  };

  const platforms: {
    id: Platform;
    label: string;
    icon: React.ComponentType<any>;
  }[] = [
    { id: "extension", label: "Extension", icon: Globe },
    { id: "mobile", label: "Mobile", icon: Smartphone },
    { id: "desktop", label: "Desktop", icon: Monitor },
  ];

  return (
    <ThemeProvider theme={theme} setTheme={setTheme}>
      <div className="h-screen overflow-hidden bg-zinc-950 flex flex-col">
        {/* Platform Selector */}
        <div className="flex justify-center p-4 shrink-0">
          <div
            ref={tabsRef}
            className="flex gap-2 p-1 bg-zinc-900 rounded-xl border border-zinc-800"
          >
            {platforms.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant={platform === id ? "default" : "ghost"}
                size="sm"
                onClick={() => setPlatform(id)}
                className={`flex items-center gap-2 text-sm transition-all duration-200 ${
                  platform === id
                    ? "bg-zinc-700 text-white shadow-md"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Icon size={16} />
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          className="flex-1 min-h-0 flex justify-center overflow-hidden"
        >
          {platform === "extension" && (
            <div className="h-full overflow-y-auto w-full max-w-[420px]">
              <ExtensionApp
                protection={protection}
                onProtectionToggle={handleProtectionToggle}
                onVpnToggle={handleVpnToggle}
                onAdblockToggle={handleAdblockToggle}
                onFilteringToggle={handleProtectionToggle}
              />
            </div>
          )}
          {platform === "mobile" && (
            <div className="h-full overflow-y-auto w-full max-w-[420px]">
              <MobileApp
                protection={protection}
                onProtectionToggle={handleProtectionToggle}
                onVpnToggle={handleVpnToggle}
                onAdblockToggle={handleAdblockToggle}
                onFilteringToggle={handleProtectionToggle}
                stats={{ ...stats, moneySaved: stats.moneySaved || 0, totalBlocked: stats.totalBlocked || 0 }}
              />
            </div>
          )}
          {platform === "desktop" && (
            <div className="h-full overflow-y-auto w-full">
              <DesktopApp
                protection={protection}
                onProtectionToggle={handleProtectionToggle}
                onVpnToggle={() => handleVpnToggle(selectedServer.id)}
                onAdblockToggle={handleAdblockToggle}
                onFilteringToggle={handleProtectionToggle}
                stats={{ ...stats, moneySaved: stats.moneySaved || 0, totalBlocked: stats.totalBlocked || 0 }}
                onTest={async () => ({ isBlocked: false, output: "Real Test" })}
                onReset={async () => console.log("Reset clicked")}
                servers={servers}
                selectedServer={selectedServer}
                onServerSelect={setSelectedServer}
              />
            </div>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
}

