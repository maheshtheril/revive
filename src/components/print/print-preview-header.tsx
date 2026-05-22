'use client';

import { Printer, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function PrintPreviewHeader({ source, usage }: { source: string; usage: string }) {
    const router = useRouter();

    return (
        <div className="bg-slate-900 text-white p-2 px-4 text-[10px] font-black uppercase tracking-widest flex justify-between items-center print:hidden">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => router.back()} 
                    className="flex items-center gap-1 hover:text-indigo-400 transition-colors"
                >
                    <ArrowLeft className="h-3 w-3" /> Back
                </button>
                <span>Print Preview: {usage.replace('_', ' ')}</span>
            </div>
            <div className="flex gap-2 items-center">
                <span className={`px-2 py-0.5 rounded-full ${source === 'modern_db' ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                    Engine: {source || 'stable'}
                </span>
                <button 
                    onClick={() => window.print()} 
                    className="bg-indigo-600 px-3 py-1 rounded hover:bg-indigo-500 transition-all active:scale-95 flex items-center gap-2"
                >
                    <Printer className="h-3 w-3" />
                    Print Now
                </button>
            </div>
        </div>
    );
}
