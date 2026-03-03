import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EyeOff, AlertTriangle, Shield, Cat, Skull, Plus, X, Type, AlignLeft, MonitorX } from 'lucide-react';
import { SmartFilter, BlurMethod, BlockScope } from '@/packages/ui/types';
import { chromeBridge } from '../Utils/chromeBridge';
import anime from 'animejs';

interface SmartFiltersProps {
  filters: SmartFilter[];
  onFiltersChange: (filters: SmartFilter[]) => void;
}

export function SmartFilters({
  filters = [],
  onFiltersChange,
}: Readonly<SmartFiltersProps>) {
  const [newBlockTerm, setNewBlockTerm] = useState('');
  const [newExceptWhen, setNewExceptWhen] = useState('');
  const [newBlockScope, setNewBlockScope] = useState<BlockScope>('word');
  const [isFilteringActive, setIsFilteringActive] = useState(false);
  const [blurMethod, setBlurMethod] = useState<BlurMethod>('blur');
  const cardRef = useRef<HTMLDivElement>(null);
  const filtersListRef = useRef<HTMLDivElement>(null);

  // Entrance animation removed to avoid conflict with CollapsibleSection
  useEffect(() => {
    // Component is ready
  }, []);

  // Load initial state from chrome.storage.local or localStorage fallback
  useEffect(() => {
    const isStorageAvailable = typeof chrome !== 'undefined' && !!chrome?.storage?.local;
    
    if (isStorageAvailable) {
      chrome.storage.local.get(['isFilteringActive', 'blurMethod'], (result) => {
        if (result?.isFilteringActive !== undefined && typeof result.isFilteringActive === 'boolean') {
          setIsFilteringActive(result.isFilteringActive);
        }
        if (result?.blurMethod && typeof result.blurMethod === 'string') {
          setBlurMethod(result.blurMethod as BlurMethod);
        }
      });
    } else {
      // Fallback for development/non-extension context
      const savedActive = localStorage.getItem('isFilteringActive') === 'true';
      const savedMethod = localStorage.getItem('blurMethod') as BlurMethod;
      if (savedActive) setIsFilteringActive(true);
      if (savedMethod) setBlurMethod(savedMethod);
    }
  }, []);

  // Effect to apply/clear filters when master toggle or filters change
  useEffect(() => {
    if (isFilteringActive) {
      applyFiltersToPage(filters, blurMethod);
    } else {
      clearFiltersFromPage();
    }
  }, [isFilteringActive, filters, blurMethod]);

  const toggleFilter = (id: string, enabled: boolean) => {
    const updated = filters.map(f => f.id === id ? { ...f, enabled } : f);
    onFiltersChange(updated);
  };

  const applyFiltersToPage = async (currentFilters: SmartFilter[], currentBlurMethod: BlurMethod) => {
    if (!chromeBridge.isAvailable()) return;
    try {
      const tabs = await chromeBridge.queryTabs({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        await chromeBridge.sendMessage(tabs[0].id, {
          action: 'APPLY_FILTERS',
          filters: currentFilters,
          blurMethod: currentBlurMethod,
        });
      }
    } catch (error) {
      console.error('[SmartFilters] Error applying filters:', error);
    }
  };

  const clearFiltersFromPage = async () => {
    if (!chromeBridge.isAvailable()) return;
    try {
      const tabs = await chromeBridge.queryTabs({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        await chromeBridge.sendMessage(tabs[0].id, { action: 'CLEAR_FILTERS' });
      }
    } catch (error) {
      console.error('[SmartFilters] Error clearing filters:', error);
    }
  };

  const handleMasterToggle = async (active: boolean) => {
    setIsFilteringActive(active);
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.set({ isFilteringActive: active });
    } else {
      localStorage.setItem('isFilteringActive', String(active));
    }

    // Toggle animation on the card
    if (cardRef.current) {
      const borderColor = active ? 'rgba(52, 211, 153, 0.5)' : 'rgba(63, 63, 70, 1)';
      anime({
        targets: cardRef.current,
        borderColor: borderColor,
        duration: 400,
        easing: 'easeOutQuad',
      });
    }
  };

  const handleBlurMethodChange = (method: BlurMethod) => {
    setBlurMethod(method);
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.set({ blurMethod: method });
    } else {
      localStorage.setItem('blurMethod', method);
    }
  };

  const addFilter = () => {
    if (!newBlockTerm.trim()) return;
    const newFilter: SmartFilter = {
      id: Math.random().toString(36).substring(2, 11),
      name: newBlockTerm,
      blockTerm: newBlockTerm,
      exceptWhen: newExceptWhen,
      enabled: true,
      blockScope: newBlockScope,
    };
    onFiltersChange([...filters, newFilter]);
    setNewBlockTerm('');
    setNewExceptWhen('');

    // Animate the new filter in
    requestAnimationFrame(() => {
      if (filtersListRef.current) {
        const items = filtersListRef.current.querySelectorAll('.filter-item');
        const last = items[items.length - 1];
        if (last) {
          anime({
            targets: last,
            translateX: [-20, 0],
            opacity: [0, 1],
            scale: [0.9, 1],
            duration: 500,
            easing: 'easeOutBack',
          });
        }
      }
    });
  };

  const removeFilter = (id: string) => {
    // Animate out, then remove
    const el = document.querySelector(`[data-filter-id="${id}"]`);
    if (el) {
      anime({
        targets: el,
        translateX: [0, 30],
        opacity: [1, 0],
        scale: [1, 0.8],
        duration: 300,
        easing: 'easeInQuad',
        complete: () => {
          onFiltersChange(filters.filter((f) => f.id !== id));
        },
      });
    } else {
      onFiltersChange(filters.filter((f) => f.id !== id));
    }
  };

  const getFilterIcon = (term: string) => {
    if (term === 'violence') return <Skull className="h-3 w-3 text-red-500" />;
    if (term === 'nsfw') return <AlertTriangle className="h-3 w-3 text-orange-500" />;
    return <Shield className="h-3 w-3 text-blue-500" />;
  };

  const getScopeIcon = (scope?: BlockScope) => {
    switch (scope) {
      case 'paragraph': return <AlignLeft className="h-3 w-3 text-amber-400" />;
      case 'page-warning': return <MonitorX className="h-3 w-3 text-red-400" />;
      default: return <Type className="h-3 w-3 text-blue-400" />;
    }
  };

  const getScopeLabel = (scope?: BlockScope) => {
    switch (scope) {
      case 'paragraph': return 'Paragraph';
      case 'page-warning': return 'Page Warning';
      default: return 'Word';
    }
  };

  return (
    <Card ref={cardRef} className="w-full border-zinc-800 bg-zinc-950 text-zinc-100">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Content Sanitizer</CardTitle>
          {blurMethod === 'kitten' ? <Cat className="h-4 w-4 text-pink-400" /> : <EyeOff className="h-4 w-4 text-zinc-500" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Master Toggle */}
        <div className={`flex items-center justify-between p-3 rounded-md border transition-colors duration-300 ${isFilteringActive ? 'bg-emerald-950/30 border-emerald-800/50' : 'bg-zinc-900 border-zinc-800'}`}>
          <span className="text-sm font-medium">Content Filtering</span>
          <Switch checked={isFilteringActive} onCheckedChange={handleMasterToggle} />
        </div>

        {/* Blur Method Selector */}
        <div className="space-y-2">
          <Label className="text-xs text-zinc-400">Censorship Method</Label>
          <Select value={blurMethod} onValueChange={handleBlurMethodChange}>
            <SelectTrigger className="w-full h-8 text-xs bg-zinc-900 border-zinc-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="blur">Blur Text</SelectItem>
              <SelectItem value="blackbar">Redact (Black Bar) ███</SelectItem>
              <SelectItem value="warning">Warning Label ⚠️</SelectItem>
              <SelectItem value="kitten">Replace with Kittens 🐱</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Block Scope Selector */}
        <div className="space-y-2">
          <Label className="text-xs text-zinc-400">Block Scope (for new filters)</Label>
          <Select value={newBlockScope} onValueChange={(v) => setNewBlockScope(v as BlockScope)}>
            <SelectTrigger className="w-full h-8 text-xs bg-zinc-900 border-zinc-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="word">
                <div className="flex items-center gap-2">
                  <Type className="h-3 w-3" /> Word Only
                </div>
              </SelectItem>
              <SelectItem value="paragraph">
                <div className="flex items-center gap-2">
                  <AlignLeft className="h-3 w-3" /> Entire Paragraph
                </div>
              </SelectItem>
              <SelectItem value="page-warning">
                <div className="flex items-center gap-2">
                  <MonitorX className="h-3 w-3" /> Page Warning
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filter List */}
        <div className="space-y-3" ref={filtersListRef}>
          <Label className="text-xs text-zinc-400">Active Filters</Label>
          {filters.length === 0 && (
            <div className="text-xs text-zinc-500 italic">No filters configured.</div>
          )}

          {filters.map((filter) => (
            <div
              key={filter.id}
              data-filter-id={filter.id}
              className="filter-item flex items-center justify-between group"
            >
              <div className="flex items-center gap-2">
                {getFilterIcon(filter.blockTerm)}
                <div className="flex flex-col">
                  <span className="text-sm capitalize">{filter.blockTerm}</span>
                  <div className="flex items-center gap-1.5">
                    {filter.exceptWhen && (
                      <span className="text-[10px] text-zinc-500">Unless: {filter.exceptWhen}</span>
                    )}
                    <span className="flex items-center gap-0.5 text-[10px] text-zinc-600">
                      {getScopeIcon(filter.blockScope)}
                      {getScopeLabel(filter.blockScope)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeFilter(filter.id)}
                >
                  <X className="h-3 w-3 text-zinc-500 hover:text-red-500" />
                </Button>
                <Switch
                  checked={filter.enabled}
                  onCheckedChange={(val) => toggleFilter(filter.id, val)}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Add New Filter */}
        <div className="pt-2 border-t border-zinc-900 space-y-2">
          <Label className="text-xs text-zinc-400">Add Custom Filter</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Block word..."
              value={newBlockTerm}
              onChange={(e) => setNewBlockTerm(e.target.value)}
              className="h-8 text-xs bg-zinc-900 border-zinc-700"
              onKeyDown={(e) => e.key === 'Enter' && addFilter()}
            />
            <Input
              placeholder="Unless..."
              value={newExceptWhen}
              onChange={(e) => setNewExceptWhen(e.target.value)}
              className="h-8 text-xs bg-zinc-900 border-zinc-700"
              onKeyDown={(e) => e.key === 'Enter' && addFilter()}
            />
          </div>
          <Button
            onClick={addFilter}
            className="w-full h-8 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Add Filter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
