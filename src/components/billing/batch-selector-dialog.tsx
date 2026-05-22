'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Package, ArrowRight, Table as TableIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Batch {
  id: string;
  batch_no: string;
  expiry_date: Date | string | null;
  qty_on_hand: number;
  mrp?: number;
}

interface BatchSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  batches: Batch[];
  onSelect: (batch: Batch) => void;
  currency?: string;
}

export function BatchSelectorDialog({
  isOpen,
  onClose,
  productName,
  batches,
  onSelect,
  currency = '₹'
}: BatchSelectorDialogProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset index when dialog opens or batches change
  useEffect(() => {
    if (isOpen) {
      setActiveIndex(0);
    }
  }, [isOpen, batches]);

  // High-Speed Keyboard Orchestration
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex(prev => (prev < batches.length - 1 ? prev + 1 : 0)); // Wrap to top
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex(prev => (prev > 0 ? prev - 1 : batches.length - 1)); // Wrap to bottom
          break;
        case 'Enter':
          e.preventDefault();
          if (batches[activeIndex]) {
            onSelect(batches[activeIndex]);
            onClose();
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeIndex, batches, onSelect, onClose]);

  // Auto-scroll active item into view
  useEffect(() => {
    if (isOpen && scrollRef.current) {
        const list = scrollRef.current.querySelector('.space-y-3');
        if (list) {
            const activeItem = list.children[activeIndex] as HTMLElement;
            if (activeItem) {
                activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }
  }, [activeIndex, isOpen]);
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-white dark:bg-[#0a0f1e] border-none shadow-[0_40px_100px_rgba(0,0,0,0.3)] rounded-[2.5rem] ring-1 ring-slate-200 dark:ring-white/10">
        <DialogHeader className="px-8 py-6 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
              <Package className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-[14px] font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Select Active Batch
              </DialogTitle>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] font-black mt-1">
                {productName}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-4">
          <div className="bg-slate-100/50 dark:bg-slate-800/30 rounded-2xl p-4 mb-4 flex items-center justify-between border border-slate-200/50 dark:border-white/5">
            <div className="flex items-center gap-2">
              <TableIcon className="h-4 w-4 text-slate-400" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Inventory Status</span>
            </div>
            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
              {batches.length} BATCHES FOUND
            </Badge>
          </div>

          <ScrollArea className="h-[300px] pr-4" ref={scrollRef}>
            <div className="space-y-3">
              {batches.map((batch, index) => {
                const isExpired = batch.expiry_date && new Date(batch.expiry_date) < new Date();
                const stockQty = Number(batch.qty_on_hand);
                const isActive = index === activeIndex;
                
                return (
                  <button
                    key={batch.id}
                    onClick={() => {
                        onSelect(batch);
                        onClose();
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                        "w-full group relative p-5 bg-white dark:bg-slate-900/50 border rounded-[1.5rem] text-left transition-all overflow-hidden",
                        isActive 
                            ? "border-indigo-600 shadow-xl shadow-indigo-500/10 ring-2 ring-indigo-600/20 translate-x-1" 
                            : "border-slate-100 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10"
                    )}
                  >
                    <div className="absolute top-0 right-0 p-3 flex flex-col items-end gap-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available</span>
                      <span className={`text-lg font-black italic tracking-tighter ${stockQty < 10 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
                        {stockQty} Units
                      </span>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-100 dark:bg-slate-950 p-2 rounded-xl border border-slate-200/50 dark:border-white/10 group-hover:bg-indigo-600 transition-colors">
                          <Package className="h-4 w-4 text-slate-500 group-hover:text-white" />
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Batch Number</p>
                          <p className="text-sm font-black text-slate-900 dark:text-white font-mono tracking-tight">{batch.batch_no}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Calendar className={`h-3 w-3 ${isExpired ? 'text-rose-500' : 'text-slate-400'}`} />
                          <div className="flex flex-col">
                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Expiry</span>
                            <span className={`text-[10px] font-black tracking-tight ${isExpired ? 'text-rose-500 underline' : 'text-slate-600 dark:text-slate-300'}`}>
                              {(() => {
                                if (!batch.expiry_date) return 'N/A';
                                const d = new Date(batch.expiry_date);
                                if (isNaN(d.getTime())) return 'N/A';
                                try { return format(d, 'MMM yyyy').toUpperCase(); } catch(e) { return 'N/A'; }
                              })()}
                            </span>
                          </div>
                        </div>
                        
                        {batch.mrp && (
                          <div className="flex flex-col">
                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">MRP</span>
                            <span className="text-[10px] font-black text-slate-900 dark:text-white tracking-tight">
                              {currency}{Number(batch.mrp).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="px-8 py-6 bg-slate-50 dark:bg-slate-900/10 border-t border-slate-100 dark:border-white/5">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="text-[9px] font-black uppercase tracking-widest h-12 px-8 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            Cancel Node
          </Button>
          <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] opacity-40">
            Secure Inventory Protocol Enabled <span className="h-1 w-1 bg-indigo-500 rounded-full animate-pulse" />
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
