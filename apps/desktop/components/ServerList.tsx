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
  const { colors, theme } = useTheme();

  const getGlassCardClass = () => {
    switch (theme) {
      case "dark": return "glass-card";
      case "vaporwave": return "glass-card-vaporwave";
      case "frutiger-aero": return "glass-card-frutiger";
      case "cyberpunk": return "glass-card-cyberpunk";
      default: return "glass-card-light";
    }
  };

  const glassCardClass = getGlassCardClass();

  return (
    <div className={`space-y-4 flex flex-col min-h-0 p-6 rounded-3xl ${glassCardClass} border ${colors.border}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className={`text-xs font-black uppercase tracking-[0.2em] ${colors.textSecondary}`}>
          Available Nodes
        </h3>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Live</span>
        </div>
      </div>
      
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
                w-full flex items-center gap-4 p-4 rounded-2xl
                transition-all duration-300
                ${isSelected 
                  ? "bg-zinc-100/10 border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.05)]" 
                  : "bg-black/20 border-white/5 hover:bg-white/5 hover:border-white/10"}
                border
                ${isDisabled ? "opacity-40 cursor-not-allowed" : "hover:scale-[1.01] active:scale-[0.99]"}
              `}
            >
              <span className="text-2xl">{server.flag}</span>
              
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-black tracking-tight ${isSelected ? "text-white" : colors.text}`}>
                    {server.name}
                  </p>
                  {isStarting && (
                    <div className="flex items-center gap-1 ml-1">
                      <Loader2 size={10} className="animate-spin text-amber-500" />
                      <span className="text-[8px] font-black bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded uppercase tracking-widest">
                        Provisioning
                      </span>
                    </div>
                  )}
                  {isActive && isSelected && (
                    <span className="text-[8px] font-black bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded uppercase tracking-widest">
                      Connected
                    </span>
                  )}
                </div>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${colors.textSecondary} opacity-60`}>
                  {server.country}
                </p>
              </div>

              <div className="flex items-center gap-4">
                {!isStarting && (
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5">
                      <Signal size={12} className={isActive && isSelected ? "text-emerald-400" : "text-zinc-500"} />
                      <span className={`text-[10px] font-mono font-bold ${isActive && isSelected ? "text-emerald-400" : "text-zinc-500"}`}>
                        {isActive && isSelected ? "Active" : "Ready"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
