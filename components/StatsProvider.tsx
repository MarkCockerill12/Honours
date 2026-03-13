"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { TrackerStats } from "./types";

interface StatsContextType {
  stats: TrackerStats;
  updateStats: () => Promise<void>;
  recordBlock: (size?: number) => Promise<void>;
}

const StatsContext = createContext<StatsContextType | null>(null);

export function StatsProvider({ children }: { readonly children: React.ReactNode }) {
  const [stats, setStats] = useState<TrackerStats>({
    totalBlocked: 0,
    bandwidthSaved: 0,
    timeSaved: 0,
    moneySaved: 0,
  });

  const updateStats = useCallback(async () => {
    const api = (globalThis.window as any)?.electron;
    if (api?.systemAdBlock?.getStats) {
       try {
         const s = await api.systemAdBlock.getStats();
         setStats({
           totalBlocked: s.totalBlocked || 0,
           bandwidthSaved: s.bandwidthSaved,
           timeSaved: s.timeSaved,
           moneySaved: s.moneySaved,
         });
       } catch (e) {
         console.warn("Failed to update stats from Electron:", e);
       }
    } else {
      // Fallback to localStorage for web/dev
      try {
        const raw = localStorage.getItem("blockStats");
        if (raw) {
          const s = JSON.parse(raw);
          setStats({
             totalBlocked: s.totalBlocked || 0,
             bandwidthSaved: s.bandwidthSaved || 0,
             timeSaved: s.timeSaved || 0,
             moneySaved: s.moneySaved || 0,
          });
        }
      } catch (e) {
        // Ignore error
      }
    }
  }, []);

  const recordBlock = useCallback(async (size: number = 50000) => {
    const api = (globalThis.window as any)?.electron;
    if (api?.systemAdBlock?.recordBlock) {
      await api.systemAdBlock.recordBlock({ size, category: 'ads' });
      await updateStats();
    } else {
      // Manual update for dev mode
      setStats(prev => {
        const newStats = {
          totalBlocked: prev.totalBlocked + 1,
          bandwidthSaved: prev.bandwidthSaved + size,
          timeSaved: prev.timeSaved + (size / (1.25 * 1024 * 1024)),
          moneySaved: prev.moneySaved + ((size / (1024 * 1024)) * 0.0048),
        };
        // Also save to localStorage for persistence in dev
        localStorage.setItem("blockStats", JSON.stringify(newStats));
        return newStats;
      });
    }
  }, [updateStats]);

  useEffect(() => {
    updateStats();
    const interval = setInterval(updateStats, 5000);
    return () => clearInterval(interval);
  }, [updateStats]);

  const value = useMemo(() => ({ stats, updateStats, recordBlock }), [stats, updateStats, recordBlock]);

  return (
    <StatsContext.Provider value={value}>
      {children}
    </StatsContext.Provider>
  );
}

export function useStats() {
  const context = useContext(StatsContext);
  if (!context) {
    // Return a dummy if not in provider (to avoid crashing during partial migration)
    return {
      stats: { totalBlocked: 0, bandwidthSaved: 0, timeSaved: 0, moneySaved: 0 },
      updateStats: async () => {},
      recordBlock: async () => {},
    };
  }
  return context;
}
