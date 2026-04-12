'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Layout, ChevronLeft, ChevronRight, LayoutGrid, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tab {
    id: string;
    label: string;
    url: string;
    icon?: string;
    active: boolean;
}

export function WorkspaceTabs() {
    const pathname = usePathname();
    const router = useRouter();
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, id: string } | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Close menu on click elsewhere
    useEffect(() => {
        const handleDown = () => setContextMenu(null);
        window.addEventListener('mousedown', handleDown);
        return () => window.removeEventListener('mousedown', handleDown);
    }, []);

    // Filter out home and common high-level routes from being 'tabs'
    const isTabbable = (path: string) => {
        const skipRoutes = ['/hms', '/unauthorized', '/hms/dashboard'];
        return !skipRoutes.includes(path) && path.startsWith('/hms/');
    };

    // Auto-track navigation and add to tabs
    useEffect(() => {
        if (!isTabbable(pathname)) return;

        setTabs(prev => {
            const exists = prev.find(t => t.url === pathname);
            const deactivated = prev.map(t => ({ ...t, active: false }));

            if (exists) {
                return deactivated.map(t => t.url === pathname ? { ...t, active: true } : t);
            }

            const segments = pathname.split('/').filter(Boolean);
            let label = segments[segments.length - 1];
            if (segments.length > 2) {
                const parent = segments[segments.length - 2];
                label = `${parent.charAt(0).toUpperCase() + parent.slice(1)}: ${label}`;
            } else {
                label = label.charAt(0).toUpperCase() + label.slice(1).replace(/-/g, ' ');
            }

            const newTab: Tab = {
                id: Math.random().toString(36).substring(7),
                label,
                url: pathname,
                active: true
            };

            const updated = [...deactivated, newTab];
            if (updated.length > 8) updated.shift();
            return updated;
        });
    }, [pathname]);

    const closeTab = (id: string) => {
        const tabToClose = tabs.find(t => t.id === id);
        if (!tabToClose) return;

        const index = tabs.findIndex(t => t.id === id);
        const isClosingActive = tabToClose.active;
        const remaining = tabs.filter(t => t.id !== id);

        setTabs(remaining);

        if (isClosingActive) {
            if (remaining.length > 0) {
                const nextActive = remaining[Math.max(0, index - 1)];
                router.push(nextActive.url);
            } else {
                router.push('/hms');
            }
        }
    };

    const closeAll = () => {
        setTabs([]);
        router.push('/hms');
    };

    const closeOthers = (id: string) => {
        const target = tabs.find(t => t.id === id);
        if (!target) return;
        setTabs([target]);
        if (!target.active) router.push(target.url);
    };

    const handleContextMenu = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, id });
    };

    if (tabs.length === 0) return null;

    return (
        <div className="sticky top-0 z-20 w-full bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 shadow-sm backdrop-blur-xl bg-opacity-80 dark:bg-opacity-80 overflow-hidden select-none">
            <div className="flex items-center">
                {/* Home/Overview Icon */}
                <div 
                    onClick={() => router.push('/hms')}
                    className="px-4 h-12 flex items-center justify-center border-r border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors text-slate-400 hover:text-indigo-600"
                >
                    <LayoutGrid className="h-4 w-4" />
                </div>

                {/* Scrollable Tab Container */}
                <div 
                    ref={scrollRef}
                    className="flex-1 flex items-end h-12 overflow-x-auto scrollbar-hide no-scrollbar"
                >
                    <AnimatePresence mode="popLayout" initial={false}>
                        {tabs.map((tab) => (
                            <motion.div
                                key={tab.id}
                                layout
                                initial={{ opacity: 0, x: -20, width: 0 }}
                                animate={{ opacity: 1, x: 0, width: 'auto' }}
                                exit={{ opacity: 0, y: 10, width: 0 }}
                                onContextMenu={(e) => handleContextMenu(e, tab.id)}
                                className={cn(
                                    "relative h-10 min-w-[120px] max-w-[200px] flex items-center px-4 rounded-t-xl transition-all cursor-pointer group shrink-0 ml-1",
                                    tab.active 
                                        ? "bg-white dark:bg-zinc-900 border-x border-t border-slate-200 dark:border-zinc-800 z-10 shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.05)]"
                                        : "bg-slate-100/50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-500 hover:bg-slate-200/50 dark:hover:bg-zinc-800"
                                )}
                                onClick={() => router.push(tab.url)}
                            >
                                {/* Active Indicator Top Line */}
                                {tab.active && (
                                    <motion.div 
                                        layoutId="tabUnderline" 
                                        className="absolute -top-[1px] left-0 right-0 h-[2px] bg-indigo-600 rounded-full" 
                                    />
                                )}

                                <span className={cn(
                                    "text-xs font-bold truncate pr-6 transition-colors",
                                    tab.active ? "text-indigo-600 dark:text-indigo-400" : "group-hover:text-slate-900 dark:group-hover:text-zinc-300"
                                )}>
                                    {tab.label}
                                </span>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        closeTab(tab.id);
                                    }}
                                    className={cn(
                                        "absolute right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all",
                                        tab.active && "opacity-100"
                                    )}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Utility Buttons */}
                <div className="flex items-center px-2 gap-1 border-l border-slate-200 dark:border-zinc-800 h-10">
                   <button 
                    onClick={closeAll}
                    title="Close All Tabs"
                    className="p-2 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                   >
                        <X className="h-4 w-4" />
                   </button>
                </div>
            </div>

            {/* Right Click Context Menu */}
            <AnimatePresence>
                {contextMenu && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                        className="fixed z-[100] min-w-[160px] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-2xl p-1 backdrop-blur-xl bg-opacity-95"
                    >
                        <button 
                            onClick={() => closeTab(contextMenu.id)}
                            className="w-full flex items-center px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-md transition-colors text-left"
                        >
                            <X className="h-3.5 w-3.5 mr-2" />
                            Close Tab
                        </button>
                        <button 
                            onClick={() => closeOthers(contextMenu.id)}
                            className="w-full flex items-center px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-md transition-colors text-left"
                        >
                            <Layout className="h-3.5 w-3.5 mr-2" />
                            Close Other Tabs
                        </button>
                        <div className="h-[1px] bg-slate-100 dark:bg-zinc-800 my-1" />
                        <button 
                            onClick={closeAll}
                            className="w-full flex items-center px-3 py-2 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-md transition-colors text-left"
                        >
                            <Maximize2 className="h-3.5 w-3.5 mr-2" />
                            Close All
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
