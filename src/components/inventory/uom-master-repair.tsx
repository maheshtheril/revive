'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Check, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function UOMMasterRepair() {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [details, setDetails] = useState<any>(null);

    const handleRepair = async () => {
        setStatus('loading');
        try {
            const res = await fetch('/api/fix-uom-master');
            const data = await res.json();
            
            if (data.success) {
                setStatus('success');
                setDetails(data);
                toast.success("UOM Master Revived!", {
                    description: `Repaired ${data.linksRepaired} product links and mapped ${data.uniqueUomsCreated} unique units.`
                });
            } else {
                throw new Error(data.error || "Repair failed");
            }
        } catch (err: any) {
            setStatus('error');
            toast.error("Repair Failed", { description: err.message });
        }
    };

    return (
        <div className="flex items-center gap-2">
            {status === 'success' ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 animate-in fade-in zoom-in">
                    <Check className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Master Revived</span>
                </div>
            ) : (
                <Button
                    variant="outline"
                    size="sm"
                    disabled={status === 'loading'}
                    onClick={handleRepair}
                    className="h-9 px-4 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition-all flex items-center gap-2"
                >
                    {status === 'loading' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <RotateCcw className="h-4 w-4" />
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest">
                        {status === 'loading' ? 'Reviving Master...' : 'Revive UOM Master'}
                    </span>
                </Button>
            )}

            {status === 'error' && (
                <div className="flex items-center gap-1 text-rose-500 bg-rose-50 px-2 py-1 rounded border border-rose-100 animate-pulse">
                    <AlertTriangle className="h-3 w-3" />
                    <span className="text-[8px] font-bold">Failure</span>
                </div>
            )}
        </div>
    );
}
