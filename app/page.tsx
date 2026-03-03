"use client";

import React, { useState, useRef, useEffect } from "react";
import { Monitor, Smartphone, Globe } from "lucide-react";
import anime from "animejs";
import { Button } from "@/components/ui/button";
import { ThemeProvider, themeConfigs } from "@/packages/ui/ThemeProvider";
import type {
  Theme,
  Platform,
  ProtectionState,
  TrackerStats,
} from "@/packages/ui/types";
import ExtensionApp from "@/apps/extension/ExtensionApp";
import { MobileApp } from "@/apps/mobile/MobileApp";
import { DesktopApp } from "@/apps/desktop/DesktopApp";

export default function Home() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [platform, setPlatform] = useState<Platform>("extension");
  const [protection, setProtection] = useState<ProtectionState>({
    isActive: false,
    vpnEnabled: false,
    adblockEnabled: true,
  });
  const [stats] = useState<TrackerStats>({
    bandwidthSaved: 847,
    timeSaved: 32,
    dataValueReclaimed: 4.73,
  });

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
    setProtection((prev) => ({ ...prev, isActive: !prev.isActive }));
  };

  const handleVpnToggle = () => {
    setProtection((prev) => ({ ...prev, vpnEnabled: !prev.vpnEnabled }));
  };

  const handleAdblockToggle = () => {
    setProtection((prev) => ({
      ...prev,
      adblockEnabled: !prev.adblockEnabled,
    }));
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
                stats={stats}
              />
            </div>
          )}
          {platform === "desktop" && (
            <div className="h-full overflow-y-auto w-full">
              <DesktopApp
                protection={protection}
                onProtectionToggle={handleProtectionToggle}
                onVpnToggle={handleVpnToggle}
                onAdblockToggle={handleAdblockToggle}
                stats={stats}
              />
            </div>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
}
