'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

type SupplierPricingDefaultsProps = {
    isOpen: boolean;
    onClose: () => void;
    supplierId: string;
    supplierName: string;
    currentDefaults?: {
        defaultPricingStrategy?: 'mrp_discount' | 'cost_markup' | 'none';
        defaultMrpDiscountPct?: number;
        defaultMarkupPct?: number;
    };
    onSave: (defaults: any) => Promise<{ error?: string } | void>;
};

export function SupplierPricingDefaults({
    isOpen,
    onClose,
    supplierId,
    supplierName,
    currentDefaults,
    onSave
}: SupplierPricingDefaultsProps) {
    const { toast } = useToast();
    const [strategy, setStrategy] = useState(currentDefaults?.defaultPricingStrategy || 'mrp_discount');
    const [mrpDiscountPct, setMrpDiscountPct] = useState(currentDefaults?.defaultMrpDiscountPct || 10);
    const [markupPct, setMarkupPct] = useState(currentDefaults?.defaultMarkupPct || 25);

    const handleSave = async () => {
        const defaults = {
            strategy: strategy as 'mrp_discount' | 'cost_markup' | 'none',
            percentage: strategy === 'mrp_discount' ? mrpDiscountPct :
                strategy === 'cost_markup' ? markupPct : 0
        };

        const result = await onSave(defaults);

        if (result?.error) {
            toast({
                title: "Error",
                description: result.error,
                variant: "destructive"
            });
        } else {
            toast({
                title: "Pricing Defaults Saved",
                description: `Default pricing for ${supplierName} has been updated.`
            });
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] bg-neutral-900 border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold">
                        Default Pricing for {supplierName}
                    </DialogTitle>
                    <p className="text-sm text-neutral-400 mt-1">
                        Auto-apply pricing when receiving goods from this supplier
                    </p>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Strategy Selection */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium text-neutral-300">Pricing Strategy</Label>
                        <div className="space-y-2">
                            <label className="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:border-emerald-500/50 cursor-pointer transition-colors">
                                <input
                                    type="radio"
                                    name="strategy"
                                    value="mrp_discount"
                                    checked={strategy === 'mrp_discount'}
                                    onChange={(e) => setStrategy(e.target.value as any)}
                                    className="w-4 h-4 text-emerald-500"
                                />
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-white">Discount from MRP</div>
                                    <div className="text-xs text-neutral-500">Sale Price = MRP - X%</div>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:border-emerald-500/50 cursor-pointer transition-colors">
                                <input
                                    type="radio"
                                    name="strategy"
                                    value="cost_markup"
                                    checked={strategy === 'cost_markup'}
                                    onChange={(e) => setStrategy(e.target.value as any)}
                                    className="w-4 h-4 text-emerald-500"
                                />
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-white">Markup on Cost</div>
                                    <div className="text-xs text-neutral-500">Sale Price = Cost + X%</div>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:border-emerald-500/50 cursor-pointer transition-colors">
                                <input
                                    type="radio"
                                    name="strategy"
                                    value="none"
                                    checked={strategy === 'none'}
                                    onChange={(e) => setStrategy(e.target.value as any)}
                                    className="w-4 h-4 text-emerald-500"
                                />
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-white">No Default</div>
                                    <div className="text-xs text-neutral-500">Enter manually each time</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* MRP Discount Input */}
                    {strategy === 'mrp_discount' && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            <Label htmlFor="mrpDiscount" className="text-sm font-medium text-neutral-300">
                                Default MRP Discount %
                            </Label>
                            <div className="flex items-center gap-3">
                                <Input
                                    id="mrpDiscount"
                                    type="number"
                                    value={mrpDiscountPct}
                                    onChange={(e) => setMrpDiscountPct(Number(e.target.value))}
                                    className="bg-neutral-800 border-white/10 text-white"
                                    min="0"
                                    max="100"
                                    step="1"
                                />
                                <span className="text-sm text-neutral-400">%</span>
                            </div>
                            <p className="text-xs text-neutral-500">
                                Example: MRP ₹150 - {mrpDiscountPct}% = ₹{(150 * (1 - mrpDiscountPct / 100)).toFixed(2)} sale price
                            </p>
                            {/* Quick Presets */}
                            <div className="flex gap-2 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setMrpDiscountPct(5)}
                                    className="px-2 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 border border-white/10 transition-colors"
                                >
                                    5%
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMrpDiscountPct(10)}
                                    className="px-2 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 border border-white/10 transition-colors"
                                >
                                    10%
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMrpDiscountPct(15)}
                                    className="px-2 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 border border-white/10 transition-colors"
                                >
                                    15%
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMrpDiscountPct(20)}
                                    className="px-2 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 border border-white/10 transition-colors"
                                >
                                    20%
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Markup Input */}
                    {strategy === 'cost_markup' && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            <Label htmlFor="markup" className="text-sm font-medium text-neutral-300">
                                Default Markup %
                            </Label>
                            <div className="flex items-center gap-3">
                                <Input
                                    id="markup"
                                    type="number"
                                    value={markupPct}
                                    onChange={(e) => setMarkupPct(Number(e.target.value))}
                                    className="bg-neutral-800 border-white/10 text-white"
                                    min="0"
                                    max="500"
                                    step="5"
                                />
                                <span className="text-sm text-neutral-400">%</span>
                            </div>
                            <p className="text-xs text-neutral-500">
                                Example: Cost ₹100 + {markupPct}% = ₹{(100 * (1 + markupPct / 100)).toFixed(2)} sale price
                            </p>
                            {/* Quick Presets */}
                            <div className="flex gap-2 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setMarkupPct(20)}
                                    className="px-2 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 border border-white/10 transition-colors"
                                >
                                    20%
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMarkupPct(25)}
                                    className="px-2 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 border border-white/10 transition-colors"
                                >
                                    25%
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMarkupPct(30)}
                                    className="px-2 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 border border-white/10 transition-colors"
                                >
                                    30%
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMarkupPct(50)}
                                    className="px-2 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 border border-white/10 transition-colors"
                                >
                                    50%
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Info Box */}
                    <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-lg p-3">
                        <p className="text-xs text-emerald-300">
                            💡 <strong>Tip:</strong> These defaults will auto-apply when you receive goods from this supplier.
                            You can always override pricing for individual items.
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        className="border-white/10 hover:bg-white/5"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        Save Defaults
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
