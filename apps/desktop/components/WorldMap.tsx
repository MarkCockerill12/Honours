import React from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker
} from "react-simple-maps";
import { ServerLocation, useTheme } from "@privacy-shield/core";

// Standard low-res world TopoJSON
const geoUrl = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

interface WorldMapProps {
  servers: ServerLocation[];
  selectedServer: ServerLocation | null;
  onServerSelect: (server: ServerLocation) => void;
  isMapMode?: boolean;
}

export const WorldMap: React.FC<WorldMapProps> = ({
  servers,
  selectedServer,
  onServerSelect,
  isMapMode = false
}) => {
  const { theme } = useTheme();
  
  // High-contrast map styles per theme - made BOLDER to stand out
  const getMapStyles = () => {
    switch (theme) {
      case "dark":
        return { 
          fill: "#1e293b", // Slate 800 - much lighter than background #060e20
          stroke: "#334155", // Slate 700
          hover: "#334155", 
          marker: "#00e5ff", 
          text: "#ffffff",
          outline: "#060e20"
        };
      case "light":
        return { 
          fill: "#94a3b8", // Slate 400 - dark enough to stand out on #f1f5f9
          stroke: "#64748b", // Slate 500
          hover: "#64748b", 
          marker: "#2563eb", 
          text: "#0f172a",
          outline: "#ffffff"
        };
      case "vaporwave":
        return { 
          fill: "#3c096c", // Vivid purple
          stroke: "#ff00ff", // Neon pink
          hover: "#5a189a", 
          marker: "#00ffff", // Neon cyan
          text: "#ff00ff",
          outline: "#1a0633"
        };
      case "frutiger-aero":
        return { 
          fill: "#7dd3fc", // Brighter sky blue
          stroke: "#ffffff", 
          hover: "#38bdf8", 
          marker: "#22c55e", 
          text: "#ffffff",
          outline: "#0ea5e9"
        };
      default:
        return { fill: "#1e293b", stroke: "#334155", hover: "#334155", marker: "#00e5ff", text: "#ffffff", outline: "#060e20" };
    }
  };

  const styles = getMapStyles();

  return (
    <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
      <ComposableMap
        // Reverted scale to 210 to ensure Sydney (Australia) is fully visible
        // Adjusted center slightly to the east to better balance the global view
        projectionConfig={{ 
          scale: 210,
          center: [20, 0] 
        }}
        className={`w-full h-full transition-all duration-1000 ${isMapMode ? 'opacity-100 scale-105' : 'opacity-60 scale-100'}`}
      >
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={styles.fill}
                stroke={styles.stroke}
                strokeWidth={0.8} // Slightly thicker borders for better definition
                style={{
                  default: { outline: "none" },
                  hover: { outline: "none", fill: styles.hover },
                  pressed: { outline: "none" },
                }}
              />
            ))
          }
        </Geographies>
        
        {servers.map((server) => {
          const isSelected = selectedServer?.id === server.id;
          
          // Custom offsets for tight locations like London (uk) vs Frankfurt (de)
          let labelYOffset = isSelected ? -18 : -16;
          let labelXOffset = 0;
          
          if (server.id === "uk") {
            labelXOffset = -45; // Move London further left
            labelYOffset -= 2;  // Nudge London up slightly
          }
          if (server.id === "de") {
            labelXOffset = 45;  // Move Frankfurt further right
            labelYOffset += 2;  // Nudge Frankfurt down slightly
          }

          return (
            <Marker key={server.id} coordinates={[server.lng, server.lat]}>
              <g
                className="cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  onServerSelect(server);
                }}
              >
                {/* Ripple Effect */}
                {isSelected && (
                  <circle r={14} fill={styles.marker} fillOpacity={0.4}>
                    <animate attributeName="r" from="4" to="20" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                
                {/* Marker Dot - slightly smaller to reduce overlap at zoom */}
                <circle
                  r={isSelected ? 5 : 4}
                  fill={isSelected ? styles.marker : styles.stroke}
                  stroke={styles.outline}
                  strokeWidth={2}
                  className={`transition-all duration-300 ${isMapMode ? 'scale-125' : 'scale-100'} shadow-2xl`}
                  style={{ filter: isSelected ? `drop-shadow(0 0 12px ${styles.marker})` : 'none' }}
                />
                
                {/* Label with dynamic collision avoidance */}
                <text
                  textAnchor="middle"
                  x={labelXOffset}
                  y={labelYOffset}
                  className={`
                    font-black text-[11px] tracking-[0.15em] uppercase pointer-events-none transition-all duration-300
                    ${isSelected || isMapMode ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
                  `}
                  fill={styles.text}
                  style={{ 
                    fontFamily: 'Manrope, sans-serif',
                    textShadow: theme === 'dark' || theme === 'vaporwave' ? '0 0 12px rgba(0,0,0,1), 0 0 4px rgba(0,0,0,1)' : '0 0 8px rgba(255,255,255,1), 0 0 2px rgba(255,255,255,1)' 
                  }}
                >
                  {server.name}
                </text>
              </g>
            </Marker>
          );
        })}
      </ComposableMap>
    </div>
  );
};
