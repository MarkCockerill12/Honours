"use client";

import React from "react";
import { Signal, Activity } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import type { ServerLocation } from "@/components/types";

interface ServerListProps {
  servers: ServerLocation[];
  selectedServer: ServerLocation | null;
  onServerSelect: (server: ServerLocation) => void;
}

export function ServerList({
  servers = [],
  selectedServer,
  onServerSelect,
}: ServerListProps) {
  const { colors, theme } = useTheme();

  const getPingColor = (ping: number) => {
    if (ping < 50) return "text-emerald-400";
    if (ping < 100) return "text-amber-400";
    return "text-red-400";
  };

  const getLoadColor = (load: number) => {
    if (load < 40) return "bg-emerald-400";
    if (load < 70) return "bg-amber-400";
    return "bg-red-400";
  };

  // Get themed scrollbar classes
  const getScrollbarClass = () => {
    switch (theme) {
      case "dark":
        return "scrollbar-dark";
      case "light":
        return "scrollbar-light";
      case "vaporwave":
        return "scrollbar-vaporwave";
      case "frutiger-aero":
        return "scrollbar-frutiger";
      default:
        return "scrollbar-dark";
    }
  };

  return (
    <div className="space-y-2 flex flex-col min-h-0">
      <h3 className={`text-sm font-semibold ${colors.text} mb-3`}>
        Available Servers
      </h3>
      <div
        className={`space-y-2 flex-1 min-h-0 overflow-y-auto pr-2 ${getScrollbarClass()}`}
      >
        {servers.map((server) => {
          const isStarting = server.status === "starting";
          const isDisabled = servers.some(s => s.status === "starting") && !isStarting;
          
          return (
            <button
              key={server.id}
              onClick={() => !isDisabled && onServerSelect(server)}
              disabled={isDisabled}
              className={`
                w-full flex items-center gap-3 p-3 rounded-xl
                ${selectedServer?.id === server.id ? colors.accent : colors.bgSecondary}
                ${colors.border} border
                transition-all duration-200 
                ${isDisabled ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] active:scale-[0.98]"}
                ${selectedServer?.id === server.id ? "text-white" : colors.text}
              `}
            >
              <span className="text-xl">{server.flag}</span>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{server.name}</p>
                  {isStarting && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded animate-pulse">
                      Warming Up...
                    </span>
                  )}
                </div>
                <p
                  className={`text-xs ${selectedServer?.id === server.id ? "text-white/70" : colors.textSecondary}`}
                >
                  {server.country}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {!isStarting && (
                  <>
                    <div className="flex items-center gap-1">
                      <Signal size={14} className={getPingColor(server.ping)} />
                      <span className={`text-xs ${getPingColor(server.ping)}`}>
                        {server.ping}ms
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Activity size={14} className={colors.textSecondary} />
                      <div className="w-12 h-1.5 bg-black/20 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getLoadColor(server.load)} transition-all duration-300`}
                          style={{ width: `${server.load}%` }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

