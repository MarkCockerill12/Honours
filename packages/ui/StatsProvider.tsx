"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { TrackerStats } from "./types";

interface StatsContextType {
  stats: TrackerStats;
  updateStats: () => Promise<void>;
  recordBlock: (size?: number) => Promise<void>;
}

const StatsContext = createContext<StatsContextType | null>(null);

export function StatsProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<TrackerStats>({
    bandwidthSaved: 0,
    timeSaved: 0,
    dataValueReclaimed: 0,
  });

  const updateStats = useCallback(async () => {
    const api = (globalThis.window as any)?.electron;
    if (api?.systemAdBlock?.getStats) {
       try {
         const s = await api.systemAdBlock.getStats();
         setStats({
           bandwidthSaved: s.bandwidthSaved,
           timeSaved: s.timeSaved,
           dataValueReclaimed: s.moneySaved,
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
             bandwidthSaved: s.bandwidthSaved || 0,
             timeSaved: s.timeSaved || 0,
             dataValueReclaimed: s.moneySaved || 0,
          });
        }
      } catch (e) {}
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
          bandwidthSaved: prev.bandwidthSaved + size,
          timeSaved: prev.timeSaved + (size / (1.25 * 1024 * 1024)),
          dataValueReclaimed: prev.dataValueReclaimed + ((size / (1024 * 1024)) * 0.0048),
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

  return (
    <StatsContext.Provider value={{ stats, updateStats, recordBlock }}>
      {children}
    </StatsContext.Provider>
  );
}

export function useStats() {
  const context = useContext(StatsContext);
  if (!context) {
    // Return a dummy if not in provider (to avoid crashing during partial migration)
    return {
      stats: { bandwidthSaved: 0, timeSaved: 0, dataValueReclaimed: 0 },
      updateStats: async () => {},
      recordBlock: async () => {},
    };
  }
  return context;
}
