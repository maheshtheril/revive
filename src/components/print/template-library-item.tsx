'use client'

import React from 'react'
import { Star, Trash2, FileCheck, Loader2, Layout } from 'lucide-react'

interface TemplateItemProps {
    t: any;
    isActive: boolean;
    localEditingId: string;
    isSettingDefault: string | null;
    normCurrentUsage: string;
    setLocalEditingId: (id: string) => void;
    setLocalEditingName: (name: string) => void;
    setCoords: (coords: any) => void;
    onSave: (config: any, usage: string) => void;
    currentUsage: string;
    handleSetDefault: (id: string, usage: string) => void;
    onDeleteTemplate: (id: string) => void;
    showDebugInfo?: boolean;
}

export function TemplateLibraryItem({ 
    t, 
    isActive, 
    localEditingId, 
    isSettingDefault, 
    normCurrentUsage,
    setLocalEditingId,
    setLocalEditingName,
    setCoords,
    onSave,
    currentUsage,
    handleSetDefault,
    onDeleteTemplate,
    showDebugInfo
}: TemplateItemProps) {
    return (
        <div 
        onClick={() => {
              if (confirm('Load layout?')) {
                  setLocalEditingId(t.id);
                  setLocalEditingName(t.name);
                  const savedConfig = t.config?.coordinates || t.config || {};
                  
                  // [FIELD UPGRADE MERGE]
                  // Intelligently merge the saved config ON TOP of the latest system defaults.
                  // This ensures missing clinical fields magically appear even for legacy templates!
                  import('@/lib/utils/pdf-defaults').then(({ getUsageDefault }) => {
                      const latestDefaults = getUsageDefault(currentUsage);
                      const mergedConfig = { ...latestDefaults, ...savedConfig };
                      setCoords(mergedConfig);
                      onSave(mergedConfig, currentUsage);
                  });
              }
          }}
          className={`group p-4 rounded-2xl border transition-all duration-300 cursor-pointer relative overflow-hidden backdrop-blur-md ${t.id === localEditingId ? 'bg-indigo-500/10 border-indigo-500/50 shadow-[0_4px_20px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/20' : 'bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/10 hover:-translate-y-[2px]'}`}
        >
            <div className="flex flex-col gap-3 relative z-10">
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <span className={`text-xs font-bold uppercase tracking-widest ${t.id === localEditingId ? 'text-indigo-400' : 'text-slate-200'}`}>{t.name}</span>
                        {showDebugInfo && (
                            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                <Layout className="h-2 w-2" />
                                {t.usage || 'Global'}
                            </span>
                        )}
                    </div>
                    {isActive && (
                        <div className="shrink-0 relative">
                            <div className="absolute inset-0 bg-emerald-500 blur-[6px] opacity-40 rounded-full" />
                            <span className="relative px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-[8px] font-black tracking-widest text-emerald-400 rounded-full flex items-center gap-1">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                ACTIVE
                            </span>
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button 
                      type="button"
                      onClick={(e) => { 
                          e.stopPropagation(); 
                          handleSetDefault(t.id, normCurrentUsage); 
                      }} 
                      className={`flex-1 py-2 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 border text-[9px] font-black uppercase tracking-widest ${isActive ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border-white/5 hover:border-white/20'}`}
                    >
                        {isSettingDefault === t.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <Star className={`h-3 w-3 ${isActive ? 'fill-current' : ''}`} />
                        )}
                        <span>{isActive ? 'Live' : 'Make Active'}</span>
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDeleteTemplate(t.id); }} 
                      className="p-2 bg-white/5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 rounded-xl transition-all duration-300 border border-white/5 hover:border-rose-500/30"
                      title="Delete Template"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
            {t.id === localEditingId && (
                <div className="absolute bottom-0 left-0 h-0.5 w-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
            )}
        </div>
    );
}
