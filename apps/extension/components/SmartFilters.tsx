"use client";

import React, { useState, useRef, useEffect } from "react";
import { Switch, useTheme, Select, SelectContent, SelectItem, SelectTrigger } from "@privacy-shield/core";
import { Trash2 } from "lucide-react";
import { SmartFilter, FilterScope, FilterStyle } from "@privacy-shield/core";
import anime from "animejs";

interface SmartFiltersProps {
  readonly filters: SmartFilter[];
  readonly onFiltersChange: (filters: SmartFilter[]) => void;
  readonly isActive: boolean;
}

export function SmartFilters({ filters, onFiltersChange }: SmartFiltersProps) {
  const [newBlockTerm, setNewBlockTerm] = useState("");
  const [newUnlessWord, setNewUnlessWord] = useState("");
  const [newBlockScope, setNewBlockScope] = useState<FilterScope>("word");
  const [newFilterStyle, setNewFilterStyle] = useState<FilterStyle>("blur");
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
      unlessWord: newUnlessWord,
      exceptWhen: "",
      enabled: true,
      blockScope: newBlockScope,
      filterStyle: newFilterStyle,
    };
    onFiltersChange([...filters, newFilter]);
    setNewBlockTerm("");
    setNewUnlessWord("");
  };

  const updateFilterStyle = (id: string, style: FilterStyle) => {
    onFiltersChange(filters.map(f => f.id === id ? { ...f, filterStyle: style } : f));
  };

  const updateFilterScope = (id: string, scope: FilterScope) => {
    onFiltersChange(filters.map(f => f.id === id ? { ...f, blockScope: scope } : f));
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



  return (
    <div className="flex-1 flex flex-col gap-3 overflow-hidden">
      {/* Add Block Term Section */}
      <div className={`${colors.bgSecondary} rounded-xl p-3 space-y-2.5 border ${colors.border}`}>
        <div className="px-1">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${colors.textSecondary}`}>New Filter Rule</span>
        </div>

        {/* Block term input */}
        <input
          type="text"
          placeholder="Block Term (e.g. advertisement)"
          value={newBlockTerm}
          onChange={(e) => setNewBlockTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addFilter()}
          className={`w-full bg-transparent border-b-2 ${colors.border} text-xs py-1 px-1 focus:border-primary outline-none ${colors.text}`}
        />

        {/* Scope + Style on same row — explicit labels because SelectValue doesn't show defaults */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-0.5">
            <span className={`text-[8px] uppercase font-black tracking-widest ${colors.textSecondary} opacity-60 px-1`}>Scope</span>
            <Select value={newBlockScope} onValueChange={(val) => setNewBlockScope(val as FilterScope)}>
              <SelectTrigger className={`h-7 text-[9px] font-black uppercase bg-zinc-500/10 border-none shadow-none ${colors.text} pointer-events-auto w-full`}>
                <span className="truncate">
                  {newBlockScope === 'word' ? 'Word' : newBlockScope === 'paragraph' ? 'Paragraph' : 'Block Page'}
                </span>
              </SelectTrigger>
              <SelectContent className={`${theme === 'dark' || theme === 'vaporwave' ? 'bg-[#18181b] text-white' : 'bg-white text-zinc-900'} border-zinc-800/50 z-[200] opacity-100`}>
                <SelectItem value="word">Word</SelectItem>
                <SelectItem value="paragraph">Paragraph</SelectItem>
                <SelectItem value="page-warning">Block Page</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className={`text-[8px] uppercase font-black tracking-widest ${colors.textSecondary} opacity-60 px-1`}>Style</span>
            <Select value={newFilterStyle} onValueChange={(val) => setNewFilterStyle(val as FilterStyle)}>
              <SelectTrigger className={`h-7 text-[9px] font-black uppercase bg-zinc-500/10 border-none shadow-none ${colors.text} pointer-events-auto w-full`}>
                <span className="truncate capitalize">{newFilterStyle}</span>
              </SelectTrigger>
              <SelectContent className={`${theme === 'dark' || theme === 'vaporwave' ? 'bg-[#18181b] text-white' : 'bg-white text-zinc-900'} border-zinc-800/50 z-[200] opacity-100`}>
                <SelectItem value="blur">Blur</SelectItem>
                <SelectItem value="redact">Redact</SelectItem>
                <SelectItem value="highlight">Highlight</SelectItem>
                <SelectItem value="kitten">Kitten</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Unless word — skip filtering if this word appears in the same paragraph */}
        <div className="flex flex-col gap-0.5">
          <span className={`text-[8px] uppercase font-black tracking-widest ${colors.textSecondary} opacity-60 px-1`}>Unless Word</span>
          <input
            type="text"
            placeholder="Unless (e.g. research, news)"
            value={newUnlessWord}
            onChange={(e) => setNewUnlessWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addFilter()}
            className={`w-full bg-transparent border-b-2 ${colors.border} text-[10px] py-1 px-1 focus:border-primary outline-none ${colors.textSecondary}`}
          />
        </div>

        {/* Add rule button */}
        <button
          onClick={addFilter}
          disabled={!newBlockTerm.trim()}
          className={`w-full py-1.5 rounded-lg transition-all text-[10px] font-black uppercase ${
            newBlockTerm.trim()
              ? `${colors.accentSecondary} text-white hover:opacity-90 active:scale-95`
              : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
          }`}
        >
          Add Filter Rule
        </button>
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
            {/* Row 1: word + delete + toggle */}
            <div className="flex items-center justify-between gap-2">
              <span className={`text-sm font-bold flex-1 min-w-0 truncate ${colors.text}`} title={filter.blockTerm}>
                {filter.blockTerm}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  className="text-zinc-500 hover:text-red-500 transition-all p-1"
                  onClick={() => removeFilter(filter.id)}
                >
                  <Trash2 size={13} />
                </button>
                <Switch
                  checked={filter.enabled}
                  onCheckedChange={(val) => onFiltersChange(filters.map(f => f.id === filter.id ? {...f, enabled: val} : f))}
                />
              </div>
            </div>
            {/* Row 2: scope + style dropdowns with explicit labels */}
            <div className="flex items-center gap-2">
              <Select value={filter.blockScope || "word"} onValueChange={(val) => updateFilterScope(filter.id, val as FilterScope)}>
                <SelectTrigger className={`h-6 px-2 text-[8px] font-black uppercase bg-zinc-500/5 border-none shadow-none ${colors.textSecondary} flex-1 pointer-events-auto`}>
                  <span>{filter.blockScope === 'paragraph' ? 'Para' : filter.blockScope === 'page-warning' ? 'Page' : 'Word'}</span>
                </SelectTrigger>
                <SelectContent className={`${theme === 'dark' || theme === 'vaporwave' ? 'bg-[#18181b] text-white' : 'bg-white text-zinc-900'} border-zinc-800/50 z-[100] opacity-100`}>
                  <SelectItem value="word">Word</SelectItem>
                  <SelectItem value="paragraph">Paragraph</SelectItem>
                  <SelectItem value="page-warning">Block Page</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filter.filterStyle || "blur"} onValueChange={(val) => updateFilterStyle(filter.id, val as FilterStyle)}>
                <SelectTrigger className={`h-6 px-2 text-[8px] font-black uppercase bg-zinc-500/5 border-none shadow-none ${colors.textSecondary} flex-1 pointer-events-auto`}>
                  <span className="capitalize">{filter.filterStyle || 'blur'}</span>
                </SelectTrigger>
                <SelectContent className={`${theme === 'dark' || theme === 'vaporwave' ? 'bg-[#18181b] text-white' : 'bg-white text-zinc-900'} border-zinc-800/50 z-[100] opacity-100`}>
                  <SelectItem value="blur">Blur</SelectItem>
                  <SelectItem value="redact">Redact</SelectItem>
                  <SelectItem value="highlight">Highlight</SelectItem>
                  <SelectItem value="kitten">Kitten</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filter.unlessWord && (
              <div className={`text-[9px] px-2 py-1 rounded font-bold truncate ${
                theme === 'dark' || theme === 'vaporwave'
                  ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                  : 'bg-amber-50 border border-amber-200 text-amber-700'
              }`}>
                UNLESS: {filter.unlessWord}
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
