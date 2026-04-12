'use client';

import Link from 'next/navigation';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Breadcrumbs() {
    const pathname = usePathname();
    
    // Split pathname and remove empty segments
    const segments = pathname.split('/').filter(Boolean);

    // Don't show breadcrumbs on the main dashboard
    if (segments.length <= 1) return null;

    return (
        <nav className="flex items-center space-x-2 px-6 py-3 text-xs font-medium text-slate-500 dark:text-zinc-500 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border-b border-slate-100 dark:border-zinc-800/50">
            <div className="flex items-center group cursor-pointer hover:text-indigo-600 transition-colors">
                <Home className="h-3.5 w-3.5 mr-1.5" />
                <span className="uppercase tracking-widest text-[10px]">HMS</span>
            </div>

            {segments.map((segment, index) => {
                // Skip the 'hms' segment as we show a home icon
                if (segment === 'hms') return null;

                const isLast = index === segments.length - 1;
                const path = `/${segments.slice(0, index + 1).join('/')}`;
                
                // Format label: remove hyphens, capitalize, handle [id]
                let label = segment.replace(/-/g, ' ');
                if (label.length > 20) label = label.substring(0, 18) + '...';
                
                // Special labels
                if (segment.match(/^[0-9a-fA-F-]{36}$/)) label = 'Record Detail';

                return (
                    <div key={path} className="flex items-center">
                        <ChevronRight className="h-3 w-3 mx-1 text-slate-300 dark:text-zinc-700" />
                        <span className={cn(
                            "transition-colors uppercase tracking-widest text-[10px]",
                            isLast 
                                ? "text-indigo-600 dark:text-indigo-400 font-black" 
                                : "hover:text-slate-900 dark:hover:text-white"
                        )}>
                            {label}
                        </span>
                    </div>
                );
            })}
        </nav>
    );
}
