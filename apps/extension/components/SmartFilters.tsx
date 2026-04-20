"use client";

import React, { useState, useRef, useEffect } from "react";
import { Switch, useTheme, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@privacy-shield/core";
import {
  Shield,
  Plus,
  Trash2,
} from "lucide-react";
import { SmartFilter, BlockScope } from "@privacy-shield/core";
import anime from "animejs";

interface SmartFiltersProps {
  readonly filters: SmartFilter[];
  readonly onFiltersChange: (filters: SmartFilter[]) => void;
  readonly isActive: boolean;
}

export function SmartFilters({ filters, onFiltersChange }: SmartFiltersProps) {
  const [newBlockTerm, setNewBlockTerm] = useState("");
  const [newExceptWhen, setNewExceptWhen] = useState("");
  const [newBlockScope, setNewBlockScope] = useState<BlockScope>("word");
  const { colors, theme } = useTheme();

  const filtersListRef = useRef<HTMLDivElement>(null);
  const lastFiltersCount = useRef(filters.length);

  useEffect(() => {
    if (filters.length > lastFiltersCount.current) {
      // Rule added
      const lastItem = filtersListRef.current?.querySelector(".filter-item:last-child");
      if (lastItem) {
        anime({
          targets: lastItem,
          translateX: [-20, 0],
          opacity: [0, 1],
          scale: [0.95, 1],
          duration: 600,
          easing: "easeOutBack"
        });
      }
    } else if (filters.length === lastFiltersCount.current && lastFiltersCount.current > 0) {
      // Staggered entrance on mount if not already done
      const items = filtersListRef.current?.querySelectorAll(".filter-item");
      if (items && items.length > 0 && lastFiltersCount.current === filters.length) {
         // Only run if they are invisible or just mounted. 
         // Actually ExtensionApp handles general stagger, but we can refine it here.
      }
    }
    lastFiltersCount.current = filters.length;
  }, [filters.length]);

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
  };

  const removeFilter = (id: string) => {
    const el = document.querySelector(`[data-filter-id="${id}"]`);
    if (el) {
      anime({
        targets: el, translateX: [0, 30], opacity: [1, 0], duration: 300, easing: "easeInQuad",
        complete: () => onFiltersChange(filters.filter((f) => f.id !== id))
      });
    } else {
      onFiltersChange(filters.filter((f) => f.id !== id));
    }
  };

  const updateFilterScope = (id: string, scope: BlockScope) => {
    onFiltersChange(filters.map(f => f.id === id ? { ...f, blockScope: scope } : f));
  };

  const trustCurrentSite = async () => {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.url) {
        try {
          const url = new URL(tabs[0].url);
          const domain = url.hostname;
          if (domain && domain !== "localhost" && !newExceptWhen.includes(domain)) {
            setNewExceptWhen(prev => prev ? `${prev}, ${domain}` : domain);
          }
        } catch (e) { console.warn(e); }
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-hidden">
      {/* Add Block Term Section */}
      <div className={`${colors.bgSecondary} rounded-xl p-3 space-y-3 border ${colors.border}`}>
        <div className="flex items-center justify-between px-1">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${colors.textSecondary}`}>New Filter Rule</span>
          <button 
            onClick={trustCurrentSite}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20 ${colors.success} text-[9px] font-black uppercase hover:bg-primary/20 transition-all`}
          >
            <Plus size={10} /> Trust Site
          </button>
        </div>
        <div className="flex gap-2">
          <input 
            type="text"
            placeholder="Block Term"
            value={newBlockTerm}
            onChange={(e) => setNewBlockTerm(e.target.value)}
            className={`flex-1 bg-transparent border-b-2 ${colors.border} text-xs py-1 px-1 focus:border-primary outline-none ${colors.text}`}
          />
          <Select value={newBlockScope} onValueChange={(val) => setNewBlockScope(val as BlockScope)}>
            <SelectTrigger className={`w-24 h-8 text-[9px] font-black uppercase bg-zinc-500/10 border-none shadow-none ${colors.text} pointer-events-auto`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={`${theme === 'dark' || theme === 'vaporwave' ? 'bg-[#18181b] text-white' : 'bg-white text-zinc-900'} border-zinc-800/50 z-[100] opacity-100`}>
              <SelectItem value="word">Word</SelectItem>
              <SelectItem value="paragraph">Para</SelectItem>
              <SelectItem value="page-warning">Page</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <input 
            type="text"
            placeholder="Except when..."
            value={newExceptWhen}
            onChange={(e) => setNewExceptWhen(e.target.value)}
            className={`flex-1 bg-transparent border-b-2 ${colors.border} text-[10px] py-1 px-1 focus:border-primary outline-none ${colors.textSecondary}`}
          />
          <button 
            onClick={addFilter}
            className={`px-4 py-2 ${colors.accentSecondary} ${colors.success} rounded-lg hover:opacity-90 active:scale-95 transition-all text-[10px] font-black uppercase`}
          >
            Add Rule
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center px-1 mt-1">
        <span className={`text-[10px] font-bold tracking-widest ${colors.textSecondary} uppercase`}>Active Filter Rules ({filters.length})</span>
      </div>

      {/* Rules List */}
      <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar min-h-0" ref={filtersListRef}>
        {filters.map((filter) => (
          <div 
            key={filter.id} 
            data-filter-id={filter.id}
            className={`filter-item ${colors.bgSecondary} p-3 rounded-xl flex flex-col gap-2 border ${colors.border} group transition-all`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className={`text-sm font-bold truncate ${colors.text}`} title={filter.blockTerm}>
                  {filter.blockTerm}
                </span>
                <Select value={filter.blockScope || "word"} onValueChange={(val) => updateFilterScope(filter.id, val as BlockScope)}>
                  <SelectTrigger className={`h-6 px-2 text-[8px] font-black uppercase bg-zinc-500/5 border-none shadow-none ${colors.textSecondary} w-auto pointer-events-auto`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={`${theme === 'dark' || theme === 'vaporwave' ? 'bg-[#18181b] text-white' : 'bg-white text-zinc-900'} border-zinc-800/50 z-[100] opacity-100`}>
                    <SelectItem value="word">Word</SelectItem>
                    <SelectItem value="paragraph">Para</SelectItem>
                    <SelectItem value="page-warning">Page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  className="text-zinc-500 hover:text-red-500 transition-all p-1" 
                  onClick={() => removeFilter(filter.id)}
                >
                  <Trash2 size={14} />
                </button>
                <Switch 
                  checked={filter.enabled} 
                  onCheckedChange={(val) => onFiltersChange(filters.map(f => f.id === filter.id ? {...f, enabled: val} : f))} 
                />
              </div>
            </div>
            {filter.exceptWhen && (
              <div className={`text-[9px] px-2 py-1 rounded bg-emerald-500/5 border border-emerald-500/10 ${colors.success} font-bold truncate`}>
                SAFE IF: {filter.exceptWhen}
              </div>
            )}
          </div>
        ))}
        {filters.length === 0 && (
          <div className={`text-[10px] ${colors.textSecondary} font-bold uppercase text-center py-10 border border-dashed ${colors.border} rounded-xl opacity-40`}>
            No active rules
          </div>
        )}
      </div>
    </div>
  );
}
