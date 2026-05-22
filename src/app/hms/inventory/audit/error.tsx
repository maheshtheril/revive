'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AuditError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error for tracking
        console.error('Audit Terminal Recovery Error:', error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-black p-6">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
                <AlertCircle className="h-10 w-10 text-red-600" />
            </div>
            
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-2">
                Terminal Sync Exception
            </h1>
            
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-3xl w-full max-w-md shadow-xl mb-8">
                <p className="text-sm font-mono text-red-600 dark:text-red-400 break-words mb-4">
                    {error.message || "An unhandled client-side runtime error occurred."}
                </p>
                {error.digest && (
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Node Digest: {error.digest}
                    </p>
                )}
            </div>

            <div className="flex flex-col gap-3 w-full max-w-md">
                <Button 
                    onClick={() => reset()}
                    className="h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2"
                >
                    <RefreshCw className="h-4 w-4" />
                    Reset Terminal Node
                </Button>
                
                <Button 
                    variant="ghost"
                    onClick={() => window.location.href = '/hms/inventory'}
                    className="h-12 rounded-2xl text-slate-500 font-bold"
                >
                    Return to Dashboard
                </Button>
            </div>
        </div>
    );
}
