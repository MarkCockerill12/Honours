"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Languages, RefreshCw, CheckCircle2, X } from "lucide-react";
import { useTheme } from "@/packages/ui/ThemeProvider";
import anime from "animejs";
import { chromeBridge } from "../Utils/chromeBridge";

const SUPPORTED_LANGUAGES = [
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
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslationActive, setIsTranslationActive] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [translatedCount, setTranslatedCount] = useState(0);
  const { theme, colors } = useTheme();
  
  const glassCardClass = useMemo(() => {
    switch (theme) {
      case "dark": return "glass-card";
      case "vaporwave": return "glass-card-vaporwave";
      case "frutiger-aero": return "glass-card-frutiger";
      default: return "glass-card-light";
    }
  }, [theme]);
  
  const statusRef = useRef<HTMLDivElement>(null);
  const activeBannerRef = useRef<HTMLDivElement>(null);
  const translateBtnRef = useRef<HTMLButtonElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const selectedLang = useMemo(() => SUPPORTED_LANGUAGES.find((l) => l.code === targetLang), [targetLang]);

  // Status message animation
  useEffect(() => {
    if (!statusRef.current || !status) return;
    anime({
      targets: statusRef.current,
      translateY: [-5, 0],
      opacity: [0, 1],
      duration: 400,
      easing: "easeOutExpo",
    });
  }, [status]);

  // Active banner animation
  useEffect(() => {
    if (!activeBannerRef.current) return;
    if (isTranslationActive) {
      anime({
        targets: activeBannerRef.current,
        height: [0, 44],
        opacity: [0, 1],
        duration: 400,
        easing: "easeOutExpo",
      });
    }
  }, [isTranslationActive]);

  // Progress animation
  useEffect(() => {
    if (!progressRef.current) return;
    if (isTranslating) {
      progressRef.current.style.display = "block";
      anime({
        targets: progressRef.current,
        width: ["0%", "90%"],
        duration: 8000,
        easing: "easeOutQuad",
      });
    } else if (translatedCount > 0) {
      anime({
        targets: progressRef.current,
        width: "100%",
        duration: 300,
        easing: "easeOutQuad",
        complete: () => {
          // Flattened timeout to reduce nesting
          handleProgressCompletion();
        },
      });
    }
  }, [isTranslating, translatedCount]);

  const handleProgressCompletion = () => {
    setTimeout(() => {
      if (!progressRef.current) return;
      anime({
        targets: progressRef.current,
        opacity: 0,
        duration: 500,
        complete: () => {
          if (!progressRef.current) return;
          progressRef.current.style.display = "none";
          progressRef.current.style.opacity = "1";
          progressRef.current.style.width = "0%";
        },
      });
    }, 600);
  };

  const handleTranslate = async () => {
    setIsTranslating(true);
    setStatus("Translating...");
    setTranslatedCount(0);

    if (translateBtnRef.current) {
      anime({ targets: translateBtnRef.current, rotate: 360, duration: 600, easing: "easeOutExpo" });
    }

    if (!chromeBridge.isAvailable()) {
      setIsTranslating(false);
      setStatus("Chrome APIs not available.");
      return;
    }

    try {
      const tabs = await chromeBridge.queryTabs({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        setIsTranslating(false);
        setStatus("Error: No active tab.");
        return;
      }

      const response = await chromeBridge.sendMessage(tabs[0].id, {
        action: "TRANSLATE_PAGE",
        targetLang,
      });

      setIsTranslating(false);
      if (response?.success) {
        setIsTranslationActive(true);
        setTranslatedCount(response.count);
        setStatus(`✓ Translated ${response.count} elements.`);
      } else {
        setStatus("Translation failed.");
      }
    } catch (err: any) {
      setIsTranslating(false);
      setStatus(`Failed: ${err.message}`);
    }
  };

  const handleClearTranslation = async () => {
    setStatus("Clearing...");
    if (!chromeBridge.isAvailable()) return;

    try {
      const tabs = await chromeBridge.queryTabs({ active: true, currentWindow: true });
      if (tabs[0]?.id) await chromeBridge.sendMessage(tabs[0].id, { action: "CLEAR_TRANSLATIONS" });

      if (activeBannerRef.current) {
        anime({
          targets: activeBannerRef.current,
          height: 0, opacity: 0, duration: 300, easing: "easeInQuad",
          complete: () => { setIsTranslationActive(false); setTranslatedCount(0); }
        });
      } else {
        setIsTranslationActive(false);
        setTranslatedCount(0);
      }
      setStatus("Translations cleared.");
    } catch (err: any) {
      setStatus(`Failed: ${err.message}`);
    }
  };

  return (
    <div className="w-full text-zinc-100 space-y-3">
      {isTranslationActive && (
        <div ref={activeBannerRef} className="overflow-hidden" style={{ height: 0, opacity: 0 }}>
          <div className="flex items-center justify-between p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <div className="flex items-center gap-2">
              <Languages className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                {selectedLang?.flag} {selectedLang?.name} Active ({translatedCount})
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-blue-500/20" onClick={handleClearTranslation}>
              <X className="h-3 w-3 text-blue-400" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Select value={targetLang} onValueChange={setTargetLang}>
          <SelectTrigger className={`h-10 text-[10px] font-black tracking-widest border-none uppercase ${theme === "light" ? "bg-slate-100 text-slate-900" : "bg-zinc-950 text-zinc-400"}`}>
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent className={`${glassCardClass} ${colors.text} border-zinc-800/50`}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <SelectItem key={lang.code} value={lang.code} className={`text-xs uppercase font-bold tracking-wider ${theme === "light" ? "focus:bg-slate-200 focus:text-slate-900" : "focus:bg-zinc-800 focus:text-white"}`}>{lang.flag} {lang.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          ref={translateBtnRef}
          className="bg-blue-600 hover:bg-blue-500 text-white shrink-0 w-10 h-10 p-0 shadow-lg"
          onClick={handleTranslate}
          disabled={isTranslating}
        >
          <RefreshCw className={`h-4 w-4 ${isTranslating ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="relative h-1 bg-zinc-900 rounded-full overflow-hidden">
        <div ref={progressRef} className="absolute top-0 left-0 h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" style={{ width: "0%", display: "none" }} />
      </div>

      {status && (
        <div ref={statusRef} className={`text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg border flex items-center gap-2
          ${status.includes("✓") || status.includes("cleared") ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}
          style={{ opacity: 0 }}
        >
          <CheckCircle2 className="h-3 w-3" />
          {status}
        </div>
      )}
    </div>
  );
}
