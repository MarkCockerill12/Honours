"use client"

import React, { useEffect, useState } from "react"
import { useTheme } from "@/packages/ui/ThemeProvider"
import type { ServerLocation } from "@/packages/ui/types"

interface ServerMapProps {
  servers: ServerLocation[]
  selectedServer: ServerLocation | null
  onServerSelect: (server: ServerLocation) => void
  isConnected: boolean
  userLocation: { x: number; y: number }
}

export function ServerMap({
  servers,
  selectedServer,
  onServerSelect,
  isConnected,
  userLocation,
}: ServerMapProps) {
  const { colors, theme } = useTheme()
  const [connectionAnimated, setConnectionAnimated] = useState(false)

  useEffect(() => {
    if (isConnected && selectedServer) {
      setConnectionAnimated(true)
    } else {
      setConnectionAnimated(false)
    }
  }, [isConnected, selectedServer])

  const getAccentColor = () => {
    if (theme === "vaporwave") return "#f472b6"
    if (theme === "frutiger-aero") return "#38bdf8"
    return "#34d399"
  }

  return (
    <div className={`relative w-full aspect-[2/1] rounded-2xl overflow-hidden ${colors.bgSecondary}`}>
      {/* Simplified world map background */}
      <svg 
        viewBox="0 0 100 50" 
        className="absolute inset-0 w-full h-full opacity-20"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Simplified continents */}
        <ellipse cx="25" cy="20" rx="15" ry="10" fill="currentColor" className={colors.textSecondary} />
        <ellipse cx="50" cy="15" rx="20" ry="12" fill="currentColor" className={colors.textSecondary} />
        <ellipse cx="75" cy="22" rx="12" ry="15" fill="currentColor" className={colors.textSecondary} />
        <ellipse cx="30" cy="38" rx="8" ry="6" fill="currentColor" className={colors.textSecondary} />
        <ellipse cx="85" cy="40" rx="10" ry="8" fill="currentColor" className={colors.textSecondary} />
      </svg>

      {/* Connection line */}
      {isConnected && selectedServer && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={getAccentColor()} stopOpacity="0.2" />
              <stop offset="50%" stopColor={getAccentColor()} stopOpacity="1" />
              <stop offset="100%" stopColor={getAccentColor()} stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <line
            x1={`${userLocation.x}%`}
            y1={`${userLocation.y}%`}
            x2={`${selectedServer.x}%`}
            y2={`${selectedServer.y}%`}
            stroke="url(#lineGradient)"
            strokeWidth="2"
            strokeDasharray="5,5"
            className={connectionAnimated ? "animate-pulse" : ""}
          />
          {/* Animated dot along the line */}
          <circle r="3" fill={getAccentColor()}>
            <animateMotion
              dur="2s"
              repeatCount="indefinite"
              path={`M${userLocation.x * 3.5},${userLocation.y * 2} L${selectedServer.x * 3.5},${selectedServer.y * 2}`}
            />
          </circle>
        </svg>
      )}

      {/* User location */}
      <div
        className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 transition-all duration-200 hover:scale-125"
        style={{ left: `${userLocation.x}%`, top: `${userLocation.y}%` }}
      >
        <div className="w-full h-full bg-blue-500 rounded-full animate-ping opacity-50" />
        <div className="absolute inset-0 w-full h-full bg-blue-500 rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-white rounded-full" />
        </div>
      </div>

      {/* Server locations */}
      {servers.map((server) => (
        <button
          key={server.id}
          onClick={() => onServerSelect(server)}
          className={`
            absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2
            rounded-full transition-all duration-200
            hover:scale-150 active:scale-125
            ${selectedServer?.id === server.id ? "scale-125" : ""}
          `}
          style={{ 
            left: `${server.x}%`, 
            top: `${server.y}%`,
            background: selectedServer?.id === server.id ? getAccentColor() : "#6b7280",
            boxShadow: selectedServer?.id === server.id 
              ? `0 0 10px ${getAccentColor()}`
              : "none",
          }}
          title={`${server.name} - ${server.ping}ms`}
        >
          {selectedServer?.id === server.id && (
            <div 
              className="absolute inset-0 rounded-full animate-ping"
              style={{ background: getAccentColor(), opacity: 0.3 }}
            />
          )}
        </button>
      ))}

      {/* Legend */}
      <div className={`absolute bottom-2 left-2 flex items-center gap-3 text-xs ${colors.textSecondary}`}>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full" />
          <span>You</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ background: getAccentColor() }} />
          <span>Server</span>
        </div>
      </div>
    </div>
  )
}
