"use client";

import React from "react";
import { Signal, Loader2 } from "lucide-react";
import { useTheme } from "@privacy-shield/core";
import type { ServerLocation } from "@privacy-shield/core";

interface ServerListProps {
  servers: ServerLocation[];
  selectedServer: ServerLocation | null;
  onServerSelect: (server: ServerLocation) => void;
}

export function ServerList({
  servers = [],
  selectedServer,
  onServerSelect,
}: Readonly<ServerListProps>) {
  const { colors } = useTheme();

  return (
    <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
      {servers.map((server) => {
        const isStarting = server.status === "starting";
        const isActive = server.status === "active";
        const isSelected = selectedServer?.id === server.id;
        const isDisabled = servers.some(s => s.status === "starting") && !isStarting;
        
        return (
          <button
            key={server.id}
            onClick={() => !isDisabled && onServerSelect(server)}
            disabled={isDisabled}
            className={`
              w-full flex items-center gap-3 p-3 rounded-xl
              transition-all duration-300 group
              ${isSelected 
                ? "bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                : "bg-transparent border-transparent hover:bg-white/5 hover:border-white/10"}
              border
              ${isDisabled ? "opacity-40 cursor-not-allowed" : "hover:scale-[1.02] active:scale-[0.98]"}
            `}
          >
            <div className={`
              w-10 h-10 rounded-lg flex items-center justify-center text-xl
              ${isSelected ? "bg-emerald-500/20" : "bg-zinc-800/50 group-hover:bg-zinc-700/50"}
              transition-colors
            `}>
              {server.flag}
            </div>
            
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <p className={`text-[11px] font-black tracking-tight ${isSelected ? "text-emerald-400" : colors.text}`}>
                  {server.name.toUpperCase()}
                </p>
                {isStarting && (
                  <Loader2 size={10} className="animate-spin text-amber-500" />
                )}
              </div>
              <p className={`text-[9px] font-bold uppercase tracking-widest text-zinc-500`}>
                {server.country}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isActive && isSelected ? "bg-emerald-500 animate-pulse" : "bg-zinc-700"}`} />
              <Signal size={10} className={isActive && isSelected ? "text-emerald-400" : "text-zinc-600"} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
