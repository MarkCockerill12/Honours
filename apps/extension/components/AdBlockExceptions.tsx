"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "@privacy-shield/core";
import {
  Globe,
  Trash2,
  Shield,
  Plus
} from "lucide-react";
import anime from "animejs";
import { chromeBridge } from "../utils/chromeBridge";

export function AdBlockExceptions() {
  const [exceptions, setExceptions] = useState<string[]>([]);
  const [manualDomain, setManualDomain] = useState("");
  const { colors } = useTheme();

  const listRef = useRef<HTMLDivElement>(null);

  // Load persistence
  useEffect(() => {
    const loadData = async () => {
      if (!chromeBridge.isAvailable()) return;
      try {
        const response = await chromeBridge.sendMessage(undefined as any, { action: "GET_EXCEPTIONS" });
        if (response?.success) {
          setExceptions(response.exceptions || []);
        }
      } catch (err) {
        console.warn("[AdBlockExceptions] Error loading data:", err);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (exceptions.length > 0 && listRef.current) {
      const items = listRef.current.querySelectorAll(".exception-item");
      anime({
        targets: items,
        translateX: [-10, 0],
        opacity: [0, 1],
        delay: anime.stagger(30),
        duration: 400,
        easing: "easeOutQuad"
      });
    }
  }, [exceptions.length]);

  const removeException = async (domain: string) => {
    const el = document.querySelector(`[data-domain="${domain}"]`);
    
    const completeRemoval = async () => {
      if (chromeBridge.isAvailable()) {
        try {
        const response = await chromeBridge.sendMessage(undefined as any, { action: "REMOVE_EXCEPTION", domain });
        if (response?.success) {
          setExceptions(response.exceptions);
        }
        } catch (err) {
          console.warn("[AdBlockExceptions] Error removing exception:", err);
        }
      } else {
        setExceptions(exceptions.filter((d) => d !== domain));
      }
    };

    if (el) {
      anime({
        targets: el, translateX: [0, 30], opacity: [1, 0], scale: [1, 0.8], duration: 300, easing: "easeInQuad",
        complete: () => { completeRemoval().catch(err => console.warn(err)); }
      });
    } else {
      await completeRemoval();
    }
  };

  const addManualException = async (domainToSet?: string) => {
    let domain = (domainToSet || manualDomain).trim().toLowerCase();
    if (!domain) return;

    if (chromeBridge.isAvailable()) {
      try {
        const response = await chromeBridge.sendMessage(undefined as any, { action: "ADD_EXCEPTION", domain });
        if (response?.success) {
          setExceptions(response.exceptions);
          setManualDomain("");
        }
      } catch (err) { console.warn(err); }
    }
  };

  const trustCurrentSite = async () => {
    if (!chromeBridge.isAvailable()) return;
    try {
      const tabs = await chromeBridge.queryTabs({ active: true, currentWindow: true });
      if (tabs[0]?.url) {
        const url = new URL(tabs[0].url);
        const domain = url.hostname;
        if (domain && domain !== "localhost") {
          await addManualException(domain);
        }
      }
    } catch (err) { console.warn(err); }
  };

  return (
    <div className="w-full flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${colors.textSecondary}`}>Domain Exclusions</span>
        <button 
          onClick={trustCurrentSite}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20 ${colors.success} text-[9px] font-black uppercase hover:bg-primary/20 transition-all`}
        >
          <Plus size={10} /> Trust Current Site
        </button>
      </div>

      {/* Exclude Domain Input */}
      <div className={`${colors.bgSecondary} rounded-xl p-0.5 flex items-center gap-2 group transition-all focus-within:ring-1 focus-within:ring-primary/50`}>
        <input 
          type="text"
          placeholder="Enter domain manually..."
          value={manualDomain}
          onChange={(e) => setManualDomain(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addManualException()}
          className={`bg-transparent border-none text-[11px] font-body w-full focus:ring-0 placeholder:${colors.textSecondary}/40 px-3 py-1.5 ${colors.text}`}
        />
        <button 
          onClick={() => addManualException()}
          className={`mr-1 p-1.5 ${colors.accentSecondary} ${colors.success} rounded-lg hover:opacity-90 transition-opacity active:scale-95`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-1 overflow-y-auto max-h-32 pr-1 custom-scrollbar" ref={listRef}>
        {exceptions.map((domain) => (
          <div key={domain} data-domain={domain} className={`exception-item ${colors.bgSecondary} hover:${colors.bg} transition-colors p-2.5 rounded-lg flex items-center justify-between group border ${colors.border}`}>
            <div className="flex items-center gap-2.5 overflow-hidden">
              <Globe className={`${colors.success} w-3.5 h-3.5 shrink-0`} />
              <span className={`text-[11px] font-semibold truncate ${colors.text}`}>{domain}</span>
            </div>
            <button className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-500 transition-all p-1" onClick={() => removeException(domain)}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {exceptions.length === 0 && (
          <div className={`text-[9px] ${colors.textSecondary} font-bold uppercase text-center py-4 border border-dashed ${colors.border} rounded-xl opacity-40`}>
            No domains excluded
          </div>
        )}
      </div>
    </div>
  );
}
