"use client";

import React, { useState, useEffect, useRef } from "react";
import { Label } from "@privacy-shield/core";
import { Button } from "@privacy-shield/core";
import {
  Globe,
  Trash2,
  Shield,
} from "lucide-react";
import { chromeBridge } from "../utils/chromeBridge";
import anime from "animejs";


export function AdBlockExceptions() {
  const [exceptions, setExceptions] = useState<string[]>([]);
  const [manualDomain, setManualDomain] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);


  const cardRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load persistence
  useEffect(() => {
    const loadExceptions = async () => {
      if (!chromeBridge.isAvailable()) return;
      try {
        const response = await chromeBridge.sendMessage(undefined as any, { action: "GET_EXCEPTIONS" });
        if (response?.success) {
          setExceptions(response.exceptions || []);
        }
      } catch (err) {
        console.warn("[AdBlockExceptions] Error loading exceptions:", err);
      }
    };
    loadExceptions();
  }, []);



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

  const addManualException = async () => {
    let domain = manualDomain.trim().toLowerCase();
    if (!domain) return;

    // URL parsing safety
    if (domain.includes("://") || domain.startsWith("www.")) {
      try {
        const urlToParse = domain.startsWith("http") ? domain : `https://${domain}`;
        const parsed = new URL(urlToParse);
        domain = parsed.hostname;
      } catch (e) {
        console.debug("[AdBlockExceptions] Manual entry parsing failed, using literal:", domain);
      }
    }

    if (!domain || exceptions.includes(domain)) {
      setStatusMessage(domain ? `"${domain}" is already trusted` : "Invalid domain");
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    if (chromeBridge.isAvailable()) {
      try {
        const response = await chromeBridge.sendMessage(undefined as any, { action: "ADD_EXCEPTION", domain });
        if (response?.success) {
          setExceptions(response.exceptions);
          setManualDomain("");
          setStatusMessage(`Trusted ${domain}`);
          setTimeout(() => setStatusMessage(null), 3000);
        }
      } catch (err) { console.warn(err); }
    }
  };

  const trustCurrentSite = async () => {
    if (!chromeBridge.isAvailable()) return;
    try {
      const tabs = await chromeBridge.queryTabs({ active: true, currentWindow: true });
      if (tabs[0]?.url) {
        try {
          const url = new URL(tabs[0].url);
          const domain = url.hostname;
          if (domain && domain !== "localhost" && !exceptions.includes(domain)) {
            const response = await chromeBridge.sendMessage(undefined as any, { action: "ADD_EXCEPTION", domain });
            if (response?.success) {
              setExceptions(response.exceptions);
              setStatusMessage(`Trusted ${domain}`);
              setTimeout(() => setStatusMessage(null), 3000);
            }
          }
        } catch (e) { console.warn(e); }
      }
    } catch (err) { console.warn(err); }
  };


  return (
    <div ref={cardRef} className="w-full text-zinc-100 space-y-5">
      <div className={`p-4 rounded-2xl border transition-all duration-500 bg-zinc-950 border-zinc-800`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-tight uppercase">Allowlist</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              AdBlocker Exceptions
            </span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={trustCurrentSite}
            className="h-8 border-emerald-500/30 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/50 text-[10px] font-black uppercase tracking-widest"
          >
            <Shield size={12} className="mr-2" /> Trust Current Site
          </Button>
        </div>

        <div className="flex gap-2 border-t border-zinc-900 mt-1 pt-3">
          <input 
            placeholder="DOMAIN OR URL" 
            value={manualDomain}
            onChange={(e) => setManualDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addManualException()}
            className="flex-1 h-8 bg-black/40 border border-zinc-800 rounded-lg px-3 text-[10px] font-black tracking-widest uppercase focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={addManualException}
            className="h-8 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-[10px] font-black uppercase tracking-widest"
          >
            Add
          </Button>
        </div>
      </div>

      {statusMessage && (
        <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10px] font-bold text-emerald-400 uppercase tracking-widest animate-pulse">
           {statusMessage}
        </div>
      )}

      <div className="space-y-3" ref={listRef}>
        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 px-1">Allowed Domains</Label>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 flex flex-col">
          {exceptions.map((domain) => (
            <div key={domain} data-domain={domain} className="exception-item flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5 group hover:border-white/10 transition-all">
              <div className="flex flex-row items-center gap-3">
                <div className="p-1.5 rounded-lg bg-black/20 text-emerald-400">
                  <Globe size={14} />
                </div>
                <span className="text-xs font-black lowercase tracking-tight">{domain}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-500" onClick={() => { removeException(domain).catch(err => console.warn(err)); }}>
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          {exceptions.length === 0 && <div className="text-[10px] text-zinc-600 font-bold uppercase text-center py-4 border border-dashed border-zinc-800 rounded-xl">No exceptions added</div>}
        </div>
      </div>


    </div>
  );
}
