"use client"

import React, { useState } from "react"
import { ChevronDown, ChevronUp, Plus, Trash2, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useTheme } from "@/packages/ui/ThemeProvider"
import type { SmartFilter, BlurMethod } from "@/packages/ui/types"

interface SmartFiltersProps {
  filters: SmartFilter[]
  onFiltersChange: (filters: SmartFilter[]) => void
  contextLevel: number
  onContextLevelChange: (level: number) => void
  blurMethod: BlurMethod
  onBlurMethodChange: (method: BlurMethod) => void
}

export function SmartFilters({
  filters,
  onFiltersChange,
  contextLevel,
  onContextLevelChange,
  blurMethod,
  onBlurMethodChange,
}: SmartFiltersProps) {
  const { colors } = useTheme()
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [newBlockTerm, setNewBlockTerm] = useState("")
  const [newExceptWhen, setNewExceptWhen] = useState("")

  const addFilter = () => {
    if (!newBlockTerm.trim()) return
    const newFilter: SmartFilter = {
      id: Date.now().toString(),
      blockTerm: newBlockTerm.trim(),
      exceptWhen: newExceptWhen.trim(),
      enabled: true,
    }
    onFiltersChange([...filters, newFilter])
    setNewBlockTerm("")
    setNewExceptWhen("")
  }

  const removeFilter = (id: string) => {
    onFiltersChange(filters.filter(f => f.id !== id))
  }

  const toggleFilter = (id: string) => {
    onFiltersChange(
      filters.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f)
    )
  }

  const updateFilter = (id: string, field: "blockTerm" | "exceptWhen", value: string) => {
    onFiltersChange(
      filters.map(f => f.id === id ? { ...f, [field]: value } : f)
    )
  }

  return (
    <div className={`rounded-2xl ${colors.bgSecondary} ${colors.border} border p-4`}>
      <h3 className={`text-sm font-semibold mb-4 ${colors.text}`}>Smart Content Filters</h3>
      
      {/* Context Slider */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className={`text-xs ${colors.textSecondary}`}>Strict</span>
          <span className={`text-xs font-medium ${colors.text}`}>Context Level: {contextLevel}%</span>
          <span className={`text-xs ${colors.textSecondary}`}>Nuanced</span>
        </div>
        <Slider
          value={[contextLevel]}
          onValueChange={([val]) => onContextLevelChange(val)}
          max={100}
          step={1}
          className="cursor-pointer"
        />
        <p className={`text-xs ${colors.textSecondary} mt-1`}>
          {contextLevel < 30 
            ? "Blocks all matching content strictly" 
            : contextLevel < 70 
            ? "Uses context to determine relevance"
            : "Only blocks clearly problematic content"}
        </p>
      </div>

      {/* Add New Filter */}
      <div className="space-y-2 mb-4">
        <div className="flex gap-2">
          <Input
            value={newBlockTerm}
            onChange={(e) => setNewBlockTerm(e.target.value)}
            placeholder="Block word/phrase..."
            className={`flex-1 h-8 text-xs ${colors.bg} ${colors.text}`}
          />
          <Button 
            onClick={addFilter}
            size="sm"
            className="h-8 px-3 hover:scale-105 active:scale-95"
            disabled={!newBlockTerm.trim()}
          >
            <Plus size={14} />
          </Button>
        </div>
        <Input
          value={newExceptWhen}
          onChange={(e) => setNewExceptWhen(e.target.value)}
          placeholder="UNLESS contains... (optional)"
          className={`h-8 text-xs ${colors.bg} ${colors.text}`}
        />
      </div>

      {/* Active Filters - Fixed height with scroll */}
      <div className={`space-y-2 mb-4 h-28 overflow-y-auto pr-1 ${colors.border} border rounded-lg p-2`}>
        {filters.length === 0 ? (
          <p className={`text-xs ${colors.textSecondary} text-center py-4`}>
            No filters added yet. Add one above.
          </p>
        ) : (
          filters.map((filter) => (
            <div 
              key={filter.id}
              className={`
                flex items-start gap-2 p-2 rounded-lg bg-black/20
                transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
              `}
            >
              <Switch 
                checked={filter.enabled}
                onCheckedChange={() => toggleFilter(filter.id)}
                className="scale-75 mt-1"
              />
              <div className="flex-1 min-w-0 space-y-1">
                <Input
                  value={filter.blockTerm}
                  onChange={(e) => updateFilter(filter.id, "blockTerm", e.target.value)}
                  className={`h-6 text-xs ${colors.bg} ${colors.text} border-none p-1`}
                  placeholder="Block term..."
                />
                <div className="flex items-center gap-1">
                  <span className={`text-xs ${colors.textSecondary} whitespace-nowrap`}>unless:</span>
                  <Input
                    value={filter.exceptWhen}
                    onChange={(e) => updateFilter(filter.id, "exceptWhen", e.target.value)}
                    className={`h-5 text-xs ${colors.bg} ${colors.text} border-none p-1`}
                    placeholder="(empty = always block)"
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFilter(filter.id)}
                className="h-6 w-6 p-0 hover:scale-110 active:scale-95"
              >
                <Trash2 size={14} className={colors.danger} />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Advanced Settings Dropdown */}
      <div className={`rounded-xl ${colors.border} border overflow-hidden`}>
        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className={`
            w-full flex items-center justify-between p-3
            ${colors.bgSecondary} ${colors.text}
            transition-all duration-200 hover:bg-black/10
          `}
        >
          <div className="flex items-center gap-2">
            <Settings2 size={16} />
            <span className="text-sm font-medium">Advanced Settings</span>
          </div>
          {advancedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        {advancedOpen && (
          <div className={`p-4 border-t ${colors.border} space-y-4`}>
            {/* Blur Method */}
            <div>
              <h4 className={`text-xs font-semibold mb-2 ${colors.textSecondary}`}>
                Content Hiding Method
              </h4>
              <RadioGroup 
                value={blurMethod} 
                onValueChange={(val) => onBlurMethodChange(val as BlurMethod)}
                className="grid grid-cols-2 gap-2"
              >
                {[
                  { value: "blackbar", label: "Black Bar", desc: "Solid black overlay" },
                  { value: "blur", label: "Blur", desc: "Gaussian blur effect" },
                  { value: "kitten", label: "Kitten", desc: "Replace with cat image" },
                  { value: "warning", label: "Warning", desc: "Show warning message" },
                ].map((option) => (
                  <div 
                    key={option.value}
                    className={`
                      flex items-center gap-2 p-2 rounded-lg
                      ${blurMethod === option.value ? "bg-black/30" : "bg-black/10"}
                      transition-all duration-200 hover:scale-105 active:scale-95
                      cursor-pointer
                    `}
                    onClick={() => onBlurMethodChange(option.value as BlurMethod)}
                  >
                    <RadioGroupItem value={option.value} id={option.value} />
                    <Label htmlFor={option.value} className={`text-xs ${colors.text} cursor-pointer`}>
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Preset Filters */}
            <div>
              <h4 className={`text-xs font-semibold mb-2 ${colors.textSecondary}`}>
                Quick Add Presets
              </h4>
              <div className="flex flex-wrap gap-1">
                {["Violence", "Profanity", "Politics", "Spoilers", "NSFW"].map((preset) => (
                  <Button
                    key={preset}
                    variant="outline"
                    size="sm"
                    className={`
                      h-6 text-xs px-2
                      transition-all duration-200 hover:scale-105 active:scale-95
                    `}
                    onClick={() => {
                      const newFilter: SmartFilter = {
                        id: Date.now().toString(),
                        blockTerm: preset.toLowerCase(),
                        exceptWhen: "",
                        enabled: true,
                      }
                      onFiltersChange([...filters, newFilter])
                    }}
                  >
                    + {preset}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
