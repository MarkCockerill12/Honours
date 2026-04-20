"use client";

import React, { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@privacy-shield/core";
import { Languages, RefreshCw, Zap, ZapOff, CheckCircle2, AlertCircle } from "lucide-react";
import { useTheme } from "@privacy-shield/core";
import anime from "animejs";
import { chromeBridge } from "../utils/chromeBridge";

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "zh-CN", name: "Chinese", flag: "🇨🇳" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
];

export function Translator() {
  const [targetLang, setTargetLang] = useState("es");
  const [isAutoTranslate, setIsAutoTranslate] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [status, setStatus] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const { theme, colors } = useTheme();

  // Load persistence
  useEffect(() => {
    const loadState = async () => {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        const res = await chrome.storage.local.get(["translatorTargetLang", "isAutoTranslate"]);
        if (res.translatorTargetLang) setTargetLang(res.translatorTargetLang);
        if (typeof res.isAutoTranslate === "boolean") setIsAutoTranslate(res.isAutoTranslate);
      }
    };
    loadState();
  }, []);

  const toggleAuto = () => {
    const newVal = !isAutoTranslate;
    setIsAutoTranslate(newVal);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ isAutoTranslate: newVal });
    }
    // Logic for auto-translation is handled in content.ts init
  };

  const handleTranslate = async () => {
    setIsTranslating(true);
    setStatus(null);

    if (!chromeBridge.isAvailable()) {
      setIsTranslating(false);
      setStatus({ type: 'error', text: "Extension context required." });
      return;
    }

    try {
      const tabs = await chromeBridge.queryTabs({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        setIsTranslating(false);
        setStatus({ type: 'error', text: "No active tab found." });
        return;
      }

      const response = await chromeBridge.sendMessage(tabs[0].id, {
        action: "TRANSLATE_PAGE",
        targetLang,
      });

      setIsTranslating(false);
      if (response?.success) {
        setStatus({ type: 'success', text: `Successfully translated ${response.count} items.` });
        setTimeout(() => setStatus(null), 5000);
      } else {
        setStatus({ type: 'error', text: response?.error || "Translation failed." });
      }
    } catch (err: any) {
      setIsTranslating(false);
      setStatus({ type: 'error', text: "Service unavailable." });
    }
  };

  const currentLangName = SUPPORTED_LANGUAGES.find(l => l.code === targetLang)?.name || "Select Language";

  return (
    <section className={`${colors.bgSecondary} rounded-2xl p-4 space-y-4 border ${colors.border} shadow-sm`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Languages className={`${colors.success} w-5 h-5`} />
          <span className={`text-[11px] font-black uppercase tracking-widest ${colors.success}`}>Smart Translator</span>
        </div>
      </div>
      
      <div className="flex flex-col gap-3">
        {/* Toggle & Action Row */}
        <div className="flex items-center gap-2.5">
          <button 
            onClick={toggleAuto}
            className={`flex-1 flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all duration-300 hover:scale-[1.02] active:scale-95 ${isAutoTranslate ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : colors.bg + ' ' + colors.border + ' ' + colors.textSecondary}`}
          >
            <div className="flex items-center gap-2.5">
              {isAutoTranslate ? <Zap size={14} fill="currentColor" /> : <ZapOff size={14} />}
              <span className="text-[10px] font-black uppercase tracking-wider">Auto Detect</span>
            </div>
            <div className={`w-8 h-4 rounded-full relative transition-colors ${isAutoTranslate ? 'bg-amber-500' : 'bg-zinc-700'}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isAutoTranslate ? 'left-4.5' : 'left-0.5'}`} />
            </div>
          </button>

          <button 
            onClick={handleTranslate} 
            disabled={isTranslating}
            className={`p-3 rounded-xl ${colors.accent} ${theme === 'dark' ? 'text-[#005762]' : 'text-white'} shadow-md hover:shadow-lg active:scale-90 transition-all disabled:opacity-50 disabled:scale-100`}
            title="Manual Translate Now"
          >
            <RefreshCw className={`w-5 h-5 ${isTranslating ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Language Selection Row */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Select value={targetLang} onValueChange={(val) => {
              setTargetLang(val);
              if (typeof chrome !== "undefined" && chrome.storage?.local) {
                chrome.storage.local.set({ translatorTargetLang: val });
              }
            }}>
              <SelectTrigger className={`${colors.bg} border ${colors.border} rounded-xl px-4 py-2.5 h-10 w-full border-none shadow-inner pointer-events-auto hover:bg-zinc-500/5 transition-colors`}>
                <SelectValue className={`text-[10px] font-bold ${colors.text}`} placeholder={currentLangName} />
              </SelectTrigger>
              <SelectContent className={`${theme === 'dark' || theme === 'vaporwave' ? 'bg-[#18181b] text-white' : 'bg-white text-zinc-900'} border-zinc-800/50 z-[9999] pointer-events-auto opacity-100`}>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code} className={`text-[10px] uppercase font-bold tracking-wider ${theme === 'dark' || theme === 'vaporwave' ? 'text-white' : 'text-zinc-900'}`}>
                    {lang.flag} {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {status && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border animate-in fade-in slide-in-from-top-2 ${status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
          {status.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <span className="text-[10px] font-bold uppercase tracking-wider">{status.text}</span>
        </div>
      )}
    </section>
  );
}
