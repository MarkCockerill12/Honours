"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Switch } from "@privacy-shield/core";
import { Label } from "@privacy-shield/core";
import { Input } from "@privacy-shield/core";
import { Button } from "@privacy-shield/core";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@privacy-shield/core";
import { useTheme } from "@privacy-shield/core";
import {
  EyeOff,
  Shield,
  X,
} from "lucide-react";
import { SmartFilter, BlurMethod, BlockScope } from "@privacy-shield/core";
import anime from "animejs";

interface SmartFiltersProps {
  readonly filters: SmartFilter[];
  readonly onFiltersChange: (filters: SmartFilter[]) => void;
  readonly isActive: boolean;
}

export function SmartFilters({ filters, onFiltersChange, isActive }: SmartFiltersProps) {
  const [newBlockTerm, setNewBlockTerm] = useState("");
  const [newExceptWhen, setNewExceptWhen] = useState("");
  const [newBlockScope, setNewBlockScope] = useState<BlockScope>("word");
  const [blurMethod, setBlurMethod] = useState<BlurMethod>("blur");
  const [isTabReady, _setIsTabReady] = useState<boolean | null>(null);
  const { theme, colors } = useTheme();

  const glassCardClass = useMemo(() => {
    switch (theme) {
      case "dark": return "glass-card";
      case "vaporwave": return "glass-card-vaporwave";
      case "frutiger-aero": return "glass-card-frutiger";
      default: return "glass-card-light";
    }
  }, [theme]);
  
  const cardRef = useRef<HTMLDivElement>(null);
  const filtersListRef = useRef<HTMLDivElement>(null);

  // Load persistence
  useEffect(() => {
    const loadSettings = async () => {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        const res = await chrome.storage.local.get(["blurMethod", "newBlockScope"]);
        if (typeof res.blurMethod === "string") setBlurMethod(res.blurMethod as BlurMethod);
        if (typeof res.newBlockScope === "string") setNewBlockScope(res.newBlockScope as BlockScope);
      } else {
        // Fallback for non-Chrome environments (e.g., development in browser)
        const savedMethod = localStorage.getItem("blurMethod") as BlurMethod | null;
        const savedBlockScope = localStorage.getItem("newBlockScope") as BlockScope | null;
        
        if (savedMethod) setBlurMethod(savedMethod);
        if (savedBlockScope) setNewBlockScope(savedBlockScope);
      }
    };
    loadSettings();
  }, []);

  const updatePersistence = (key: string, value: any) => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ [key]: value });
    } else {
      localStorage.setItem(key, String(value));
    }
  };

  // Application effect - Removed. syncState in content.ts now handles this globally via storage.


  const addFilter = () => {
    if (!newBlockTerm.trim()) return;
    const newFilter: SmartFilter = {
      id: Math.random().toString(36).substring(2, 11),
      blockTerm: newBlockTerm,
      exceptWhen: newExceptWhen,
      enabled: true,
      blockScope: newBlockScope,
    };
    onFiltersChange([...filters, newFilter]);
    setNewBlockTerm("");
    setNewExceptWhen("");

    requestAnimationFrame(() => {
      if (filtersListRef.current) {
        const last = filtersListRef.current.querySelector(".filter-item:last-child");
        if (last) anime({ targets: last, translateX: [-20, 0], opacity: [0, 1], scale: [0.9, 1], duration: 500, easing: "easeOutBack" });
      }
    });
  };

  const removeFilter = (id: string) => {
    const el = document.querySelector(`[data-filter-id="${id}"]`);
    if (el) {
      anime({
        targets: el, translateX: [0, 30], opacity: [1, 0], scale: [1, 0.8], duration: 300, easing: "easeInQuad",
        complete: () => onFiltersChange(filters.filter((f) => f.id !== id))
      });
    } else {
      onFiltersChange(filters.filter((f) => f.id !== id));
    }
  };

  return (
    <div ref={cardRef} className="w-full text-zinc-100 space-y-5">
      {isTabReady === false && (
        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold text-amber-500 uppercase tracking-widest text-center">
          ⚠️ Content script not detected. Refresh the page to enable filters.
        </div>
      )}

      <div className="flex items-center justify-between gap-4 px-1">
        <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Method</Label>
        <Select value={blurMethod} onValueChange={(val) => {
          setBlurMethod(val as BlurMethod);
          updatePersistence("blurMethod", val);
        }}>
          <SelectTrigger className={`h-7 w-32 border-none text-[9px] font-black tracking-widest uppercase rounded-lg ${theme === "light" ? "bg-slate-100 text-slate-900" : "bg-stone-900 text-zinc-400"}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={`${glassCardClass} ${colors.text} border-zinc-800/50`}>
            <SelectItem value="blur" className="text-[9px] font-bold uppercase">Blur</SelectItem>
            <SelectItem value="blackbar" className="text-[9px] font-bold uppercase">Redact</SelectItem>
            <SelectItem value="warning" className="text-[9px] font-bold uppercase">Warning</SelectItem>
            <SelectItem value="kitten" className="text-[9px] font-bold uppercase">Kittens</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3" ref={filtersListRef}>
        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 px-1">Active Rules</Label>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 flex flex-col">
          {filters.map((filter) => (
            <div key={filter.id} data-filter-id={filter.id} className="filter-item flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5 group hover:border-white/10 transition-all">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-black/20 text-blue-400">
                  {filter.blockTerm === "nsfw" ? <EyeOff size={14} /> : <Shield size={14} />}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-tight">{filter.blockTerm}</span>
                    <Select
                      value={filter.blockScope || "word"}
                      onValueChange={(val) => onFiltersChange(filters.map(f => f.id === filter.id ? {...f, blockScope: val as BlockScope} : f))}
                    >
                      <SelectTrigger className="h-5 w-24 p-0 px-2 bg-zinc-800 hover:bg-zinc-700 border-none text-[8px] font-black uppercase tracking-widest rounded transition-colors shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={`${glassCardClass} ${colors.text} border-zinc-800/50`}>
                        <SelectItem value="word" className={`text-[9px] font-black uppercase ${theme === "light" ? "focus:bg-slate-200 focus:text-slate-900" : "focus:bg-zinc-800 focus:text-white"}`}>Word</SelectItem>
                        <SelectItem value="paragraph" className={`text-[9px] font-black uppercase ${theme === "light" ? "focus:bg-slate-200 focus:text-slate-900" : "focus:bg-zinc-800 focus:text-white"}`}>Para</SelectItem>
                        <SelectItem value="page-warning" className={`text-[9px] font-black uppercase ${theme === "light" ? "focus:bg-slate-200 focus:text-slate-900" : "focus:bg-zinc-800 focus:text-white"}`}>Page</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {filter.exceptWhen && <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Safe if contains: {filter.exceptWhen}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-500" onClick={() => removeFilter(filter.id)}>
                  <X size={14} />
                </Button>
                <Switch checked={filter.enabled} onCheckedChange={(val) => onFiltersChange(filters.map(f => f.id === filter.id ? {...f, enabled: val} : f))} />
              </div>
            </div>
          ))}
          {filters.length === 0 && <div className="text-[10px] text-zinc-600 font-bold uppercase text-center py-4 border border-dashed border-zinc-800 rounded-xl">No active rules</div>}
        </div>
      </div>

      <div className="pt-4 border-t border-zinc-900 space-y-2">
        <div className="flex gap-2">
          <Input placeholder="BLOCK TERM" value={newBlockTerm} onChange={(e) => setNewBlockTerm(e.target.value.toLowerCase())} className="h-8 text-[9px] font-black tracking-widest uppercase bg-zinc-950 border-zinc-900" />
          <Button onClick={addFilter} variant="secondary" className="h-8 px-4 font-black uppercase tracking-widest text-[9px] shrink-0">
            ADD
          </Button>
        </div>
        <Input placeholder="BLOCK UNLESS (WORD OR PHRASE)" value={newExceptWhen} onChange={(e) => setNewExceptWhen(e.target.value.toLowerCase())} className="h-8 text-[9px] font-black tracking-widest uppercase bg-zinc-950 border-zinc-900" />
      </div>
    </div>
  );
}

