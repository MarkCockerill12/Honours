"use client";

import React, { useEffect, useState, useRef } from "react";
import anime from "animejs";
import { useTheme } from "@/components/ThemeProvider";
import type { ServerLocation } from "@/components/types";

// Real SVG world map paths (simplified continents)
const CONTINENT_PATHS = {
  northAmerica:
    "M10,18 L12,12 L18,10 L25,12 L30,15 L32,20 L28,28 L22,32 L18,30 L14,25 L10,22 Z",
  southAmerica:
    "M22,38 L25,35 L30,36 L32,42 L30,50 L28,56 L24,58 L22,54 L20,48 L21,42 Z",
  europe: "M46,14 L48,11 L52,10 L56,12 L54,16 L52,18 L48,20 L46,18 Z",
  africa:
    "M44,24 L48,22 L54,24 L56,28 L55,36 L52,42 L48,44 L44,40 L42,34 L43,28 Z",
  asia: "M56,10 L62,8 L72,10 L80,14 L82,20 L78,28 L72,30 L66,28 L60,24 L56,18 L55,14 Z",
  oceania: "M76,44 L82,40 L88,42 L90,48 L86,52 L80,50 L76,48 Z",
  middleEast: "M54,20 L60,18 L64,22 L62,26 L56,28 L54,24 Z",
};

// Grid lines for the map
const GRID_LINES = Array.from({ length: 12 }, (_, i) => i * (100 / 12));

interface ServerMapProps {
  servers: ServerLocation[];
  selectedServer: ServerLocation | null;
  onServerSelect: (server: ServerLocation) => void;
  isConnected: boolean;
  userLocation: { x: number; y: number };
}

export function ServerMap({
  servers,
  selectedServer,
  onServerSelect,
  isConnected,
  userLocation,
}: ServerMapProps) {
  const { colors, theme } = useTheme();
  const mapRef = useRef<HTMLDivElement>(null);
  const serversRef = useRef<HTMLDivElement>(null);
  const connectionRef = useRef<SVGLineElement>(null);

  const getAccentColor = () => {
    if (theme === "vaporwave") return "#f472b6";
    if (theme === "frutiger-aero") return "#38bdf8";
    return "#34d399";
  };

  const getMapColor = () => {
    if (theme === "vaporwave") return "rgba(168, 85, 247, 0.15)";
    if (theme === "frutiger-aero") return "rgba(56, 189, 248, 0.12)";
    if (theme === "light") return "rgba(100, 116, 139, 0.15)";
    return "rgba(161, 161, 170, 0.1)";
  };

  const getGridColor = () => {
    if (theme === "vaporwave") return "rgba(168, 85, 247, 0.06)";
    if (theme === "frutiger-aero") return "rgba(56, 189, 248, 0.06)";
    return "rgba(161, 161, 170, 0.04)";
  };

  // Server dots entrance animation
  useEffect(() => {
    if (!serversRef.current) return;
    const dots = serversRef.current.querySelectorAll(".server-dot");
    anime({
      targets: dots,
      scale: [0, 1],
      opacity: [0, 1],
      delay: anime.stagger(60, { start: 300 }),
      duration: 500,
      easing: "easeOutBack",
    });
  }, []);

  // Connection line animation
  useEffect(() => {
    if (!connectionRef.current) return;
    if (isConnected && selectedServer) {
      anime({
        targets: connectionRef.current,
        strokeDashoffset: [anime.setDashoffset, 0],
        opacity: [0, 1],
        duration: 1000,
        easing: "easeInOutSine",
      });
    } else {
      anime({
        targets: connectionRef.current,
        opacity: 0,
        duration: 300,
      });
    }
  }, [isConnected, selectedServer]);

  // Pulse animation for selected server
  useEffect(() => {
    if (!serversRef.current || !selectedServer) return;
    const selected = serversRef.current.querySelector(
      `[data-server-id="${selectedServer.id}"]`,
    );
    if (selected) {
      anime({
        targets: selected,
        scale: [1, 1.3, 1],
        duration: 400,
        easing: "easeOutElastic(1, .5)",
      });
    }
  }, [selectedServer]);

  return (
    <div
      ref={mapRef}
      className={`relative w-full aspect-[2/1] rounded-2xl overflow-hidden ${colors.bgSecondary} border ${colors.border}`}
    >
      {/* SVG Map */}
      <svg
        viewBox="0 0 100 60"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Grid lines */}
        {GRID_LINES.map((pos) => (
          <React.Fragment key={pos}>
            <line
              x1={pos}
              y1="0"
              x2={pos}
              y2="60"
              stroke={getGridColor()}
              strokeWidth="0.3"
            />
            <line
              x1="0"
              y1={pos * 0.6}
              x2="100"
              y2={pos * 0.6}
              stroke={getGridColor()}
              strokeWidth="0.3"
            />
          </React.Fragment>
        ))}

        {/* Continents */}
        {Object.values(CONTINENT_PATHS).map((path, i) => (
          <path
            key={i}
            d={path}
            fill={getMapColor()}
            stroke={getMapColor().replace(/[\d.]+\)$/, "0.3)")}
            strokeWidth="0.3"
          />
        ))}

        {/* Connection line */}
        {selectedServer && (
          <line
            ref={connectionRef}
            x1={userLocation.x}
            y1={userLocation.y}
            x2={selectedServer.x}
            y2={selectedServer.y}
            stroke={getAccentColor()}
            strokeWidth="0.5"
            strokeDasharray="2,2"
            opacity="0"
          />
        )}
      </svg>

      {/* Server dots (HTML for better interactivity) */}
      <div ref={serversRef} className="absolute inset-0">
        {/* User location */}
        <div
          className="server-dot absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${userLocation.x}%`, top: `${userLocation.y}%` }}
        >
          <div className="w-full h-full bg-blue-500 rounded-full animate-ping opacity-40" />
          <div className="absolute inset-0 w-full h-full bg-blue-500 rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(59,130,246,0.5)]">
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>
        </div>

        {/* Server locations */}
        {servers.map((server) => {
          const isSelected = selectedServer?.id === server.id;
          return (
            <button
              key={server.id}
              data-server-id={server.id}
              onClick={() => onServerSelect(server)}
              className="server-dot absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-200 hover:scale-[1.8] active:scale-125 cursor-pointer"
              style={{
                left: `${server.x}%`,
                top: `${server.y}%`,
                background: isSelected ? getAccentColor() : "#6b7280",
                boxShadow: isSelected
                  ? `0 0 12px ${getAccentColor()}`
                  : "0 0 4px rgba(0,0,0,0.3)",
              }}
              title={`${server.flag} ${server.name} — ${server.ping}ms`}
            >
              {isSelected && (
                <div
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{ background: getAccentColor(), opacity: 0.25 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div
        className={`absolute bottom-2 left-2 flex items-center gap-3 text-[10px] ${colors.textSecondary}`}
      >
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_4px_rgba(59,130,246,0.5)]" />
          <span>You</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: getAccentColor() }}
          />
          <span>Server</span>
        </div>
        {isConnected && (
          <div className="flex items-center gap-1">
            <div
              className="w-4 h-px"
              style={{ background: getAccentColor() }}
            />
            <span>Connected</span>
          </div>
        )}
      </div>
    </div>
  );
}

