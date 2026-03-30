'use client';

import { useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCcw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('CRITICAL BILLING FAILURE:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-mono">
      <div className="max-w-2xl w-full bg-slate-900 border border-rose-500/30 rounded-[2.5rem] p-12 text-center shadow-[0_50px_100px_rgba(255,0,0,0.2)]">
        <div className="h-20 w-20 bg-rose-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-rose-500/20">
          <AlertCircle className="h-10 w-10 text-rose-500" />
        </div>
        
        <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-4">
          Terminal Hydration Exception
        </h1>
        
        <div className="bg-black/40 rounded-2xl p-6 text-left mb-8 border border-white/5">
          <p className="text-rose-400 text-xs font-black uppercase tracking-widest mb-2">Error Diagnostic</p>
          <p className="text-slate-300 text-sm leading-relaxed overflow-hidden break-words">
            {error.message || "An unexpected client-side exception occurred while initializing the billing interface."}
          </p>
          {error.digest && (
            <p className="text-slate-500 text-[10px] mt-4 font-mono">Digest: {error.digest}</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            <Button 
                onClick={() => reset()}
                className="h-14 px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl gap-2 font-black uppercase tracking-widest transition-all"
            >
                <RotateCcw className="h-4 w-4" /> Hard Reset
            </Button>
            <Button 
                variant="ghost"
                onClick={() => window.location.href = '/hms/reception/dashboard'}
                className="h-14 px-8 text-slate-400 hover:text-white rounded-2xl gap-2 font-black uppercase tracking-widest"
            >
                <Home className="h-4 w-4" /> Abandon Operation
            </Button>
        </div>
      </div>
    </div>
  );
}
