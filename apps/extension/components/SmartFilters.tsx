"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/packages/ui/ThemeProvider";
import {
  EyeOff,
  Shield,
  Plus,
  X,
} from "lucide-react";
import { SmartFilter, BlurMethod, BlockScope } from "@/packages/ui/types";
import { chromeBridge } from "../Utils/chromeBridge";
import anime from "animejs";

interface SmartFiltersProps {
  filters: SmartFilter[];
  onFiltersChange: (filters: SmartFilter[]) => void;
}

export function SmartFilters({
  filters = [],
  onFiltersChange,
}: Readonly<SmartFiltersProps>) {
  const [newBlockTerm, setNewBlockTerm] = useState("");
  const [newExceptWhen, setNewExceptWhen] = useState("");
  const [newBlockScope, setNewBlockScope] = useState<BlockScope>("word");
  const [isFilteringActive, setIsFilteringActive] = useState(false);
  const [blurMethod, setBlurMethod] = useState<BlurMethod>("blur");
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
    if (chromeBridge.isAvailable() && typeof chrome !== "undefined" && chrome?.storage?.local) {
      chrome.storage.local.get(["isFilteringActive", "blurMethod"], (result) => {
        if (typeof result?.isFilteringActive === "boolean") setIsFilteringActive(result.isFilteringActive);
        if (typeof result?.blurMethod === "string") setBlurMethod(result.blurMethod as BlurMethod);
      });
    } else {
      const savedActive = localStorage.getItem("isFilteringActive") === "true";
      const savedMethod = localStorage.getItem("blurMethod") as BlurMethod;
      if (savedActive) setIsFilteringActive(true);
      if (savedMethod) setBlurMethod(savedMethod);
    }
  }, []);

  // Application effect
  useEffect(() => {
    const apply = async () => {
      if (!chromeBridge.isAvailable()) return;
      const tabs = await chromeBridge.queryTabs({ active: true, currentWindow: true });
      if (!tabs[0]?.id) return;

      if (isFilteringActive) {
        await chromeBridge.sendMessage(tabs[0].id, {
          action: "APPLY_FILTERS",
          filters,
          blurMethod,
        });
      } else {
        await chromeBridge.sendMessage(tabs[0].id, { action: "CLEAR_FILTERS" });
      }
    };
    apply();
  }, [isFilteringActive, filters, blurMethod]);

  const handleMasterToggle = (active: boolean) => {
    setIsFilteringActive(active);
    if (typeof chrome !== "undefined" && chrome?.storage?.local) {
      chrome.storage.local.set({ isFilteringActive: active });
    } else {
      localStorage.setItem("isFilteringActive", String(active));
    }
  };

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
      <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-500 ${isFilteringActive ? "bg-emerald-500/10 border-emerald-500/30" : "bg-zinc-950 border-zinc-800"}`}>
        <div className="flex flex-col">
          <span className="text-sm font-black tracking-tight uppercase">Content Sanitizer</span>
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isFilteringActive ? "text-emerald-400" : "text-zinc-500"}`}>
            {isFilteringActive ? "Filtering Active" : "Filters Paused"}
          </span>
        </div>
        <Switch checked={isFilteringActive} onCheckedChange={handleMasterToggle} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Method</Label>
          <Select value={blurMethod} onValueChange={(m) => setBlurMethod(m as BlurMethod)}>
            <SelectTrigger className={`h-9 border-none text-[10px] font-black tracking-widest uppercase ${theme === "light" ? "bg-slate-100 text-slate-900" : "bg-zinc-950 text-zinc-400"}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={`${glassCardClass} ${colors.text} border-zinc-800/50`}>
              <SelectItem value="blur" className={`text-[10px] font-bold uppercase ${theme === "light" ? "focus:bg-slate-200 focus:text-slate-900" : "focus:bg-zinc-800 focus:text-white"}`}>Blur Text</SelectItem>
              <SelectItem value="blackbar" className={`text-[10px] font-bold uppercase ${theme === "light" ? "focus:bg-slate-200 focus:text-slate-900" : "focus:bg-zinc-800 focus:text-white"}`}>Redact ███</SelectItem>
              <SelectItem value="warning" className={`text-[10px] font-bold uppercase ${theme === "light" ? "focus:bg-slate-200 focus:text-slate-900" : "focus:bg-zinc-800 focus:text-white"}`}>Warning ⚠️</SelectItem>
              <SelectItem value="kitten" className={`text-[10px] font-bold uppercase ${theme === "light" ? "focus:bg-slate-200 focus:text-slate-900" : "focus:bg-zinc-800 focus:text-white"}`}>Kittens 🐱</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Scope</Label>
          <Select value={newBlockScope} onValueChange={(v) => setNewBlockScope(v as BlockScope)}>
            <SelectTrigger className={`h-9 border-none text-[10px] font-black tracking-widest uppercase ${theme === "light" ? "bg-slate-100 text-slate-900" : "bg-zinc-950 text-zinc-400"}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={`${glassCardClass} ${colors.text} border-zinc-800/50`}>
              <SelectItem value="word" className={`text-[10px] font-bold uppercase tracking-widest ${theme === "light" ? "focus:bg-slate-200 focus:text-slate-900" : "focus:bg-zinc-800 focus:text-white"}`}>Word</SelectItem>
              <SelectItem value="paragraph" className={`text-[10px] font-bold uppercase tracking-widest ${theme === "light" ? "focus:bg-slate-200 focus:text-slate-900" : "focus:bg-zinc-800 focus:text-white"}`}>Paragraph</SelectItem>
              <SelectItem value="page-warning" className={`text-[10px] font-bold uppercase tracking-widest ${theme === "light" ? "focus:bg-slate-200 focus:text-slate-900" : "focus:bg-zinc-800 focus:text-white"}`}>Page Wide</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
                  <span className="text-xs font-black uppercase tracking-tight">{filter.blockTerm}</span>
                  {filter.exceptWhen && <span className="text-[9px] font-bold text-zinc-600 uppercase">Unless: {filter.exceptWhen}</span>}
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

      <div className="pt-4 border-t border-zinc-900 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="BLOCK TERM" value={newBlockTerm} onChange={(e) => setNewBlockTerm(e.target.value.toLowerCase())} className="h-9 text-[10px] font-black tracking-widest uppercase bg-zinc-950 border-zinc-900" />
          <Input placeholder="EXCEPTION" value={newExceptWhen} onChange={(e) => setNewExceptWhen(e.target.value.toLowerCase())} className="h-9 text-[10px] font-black tracking-widest uppercase bg-zinc-950 border-zinc-900" />
        </div>
        <Button onClick={addFilter} className="w-full h-10 bg-zinc-100 hover:bg-white text-black font-black uppercase tracking-[0.2em] text-[10px]">
          <Plus size={14} className="mr-2" /> CREATE NEW RULE
        </Button>
      </div>
    </div>
  );
}
