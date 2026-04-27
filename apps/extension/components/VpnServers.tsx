"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { useTheme } from "@privacy-shield/core";
import type { ServerLocation } from "@privacy-shield/core";

interface VpnServersProps {
  servers: ServerLocation[];
  selectedServerId: string | null;
  onServerSelect: (serverId: string) => void;
  isLoading?: boolean;
}

export function VpnServers({
  servers = [],
  selectedServerId,
  onServerSelect,
  isLoading = false,
}: Readonly<VpnServersProps>) {
  const { colors } = useTheme();

  return (
    <div className="space-y-3">
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
        {servers.map((server) => {
          const isSelected = selectedServerId === server.id;
          const isStarting = server.status === "starting";
          
          return (
            <button
              key={server.id}
              onClick={() => onServerSelect(server.id)}
              disabled={isLoading && !isSelected}
              className={`
                w-full flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer border
                ${isSelected 
                  ? "bg-primary/10 border-primary/40 shadow-[0_0_10px_rgba(129,236,255,0.1)]" 
                  : colors.bgSecondary + " " + colors.border + " hover:bg-zinc-500/5"}
                ${isLoading && !isSelected ? "opacity-40 cursor-not-allowed" : "active:scale-[0.98]"}
              `}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className={`w-7 h-5 rounded flex items-center justify-center text-[9px] font-black tracking-wider flex-shrink-0 ${isSelected ? 'bg-primary/20 text-primary' : 'bg-zinc-500/10 ' + colors.textSecondary}`}>
                  {server.id.toUpperCase()}
                </div>
                <div className="flex items-baseline gap-2 overflow-hidden min-w-0">
                  <span className={`text-sm font-bold tracking-tight whitespace-nowrap ${isSelected ? colors.success : colors.text}`}>
                    {server.name.trim()}
                  </span>
                  <span className={`text-[9px] uppercase font-black tracking-widest whitespace-nowrap ${colors.textSecondary} opacity-60`}>
                    {server.country}
                  </span>
                </div>
                {isStarting && isSelected && (
                  <Loader2 size={12} className="animate-spin text-amber-500 ml-1" />
                )}
              </div>

              {isSelected ? (
                <div className="relative w-5 h-5 flex items-center justify-center">
                  <div className="absolute inset-0 bg-primary/20 rounded-full animate-pulse"></div>
                  <div className="w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_8px_rgba(129,236,255,0.5)]"></div>
                </div>
              ) : (
                <div className={`w-5 h-5 border-2 ${colors.border} rounded-full opacity-30`}></div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
