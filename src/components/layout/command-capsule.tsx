'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Zap, Users, Stethoscope, FlaskConical, HeartPulse, 
    X, ChevronRight, LayoutGrid, Monitor, ShieldCheck,
    Briefcase, Activity, Receipt
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface CommandCapsuleProps {
    user: any;
}

export function CommandCapsule({ user }: CommandCapsuleProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [personalPins, setPersonalPins] = useState<any[]>([]);
    const router = useRouter();
    const pathname = usePathname();

    // Load personal pins on mount
    useEffect(() => {
        const saved = localStorage.getItem('ziona-capsule-pins');
        if (saved) setPersonalPins(JSON.parse(saved));
    }, []);

    // Key permission check logic
    const hasPermission = (module: string) => {
        if (!user) return false;
        if (user.isAdmin || user.isTenantAdmin) return true;
        const permissions = user.permissions || [];
        return permissions.includes(module) || permissions.some((p: any) => p.module_key === module);
    };

    const coreShortcuts = [
        { 
            id: 'reception', 
            label: 'Reception', 
            icon: <Users className="h-5 w-5" />, 
            color: 'bg-indigo-500', 
            shadow: 'shadow-indigo-500/40',
            url: '/hms/reception/dashboard',
            permission: 'hms_reception'
        },
        { 
            id: 'doctor', 
            label: 'Doctor Hub', 
            icon: <Stethoscope className="h-5 w-5" />, 
            color: 'bg-emerald-500', 
            shadow: 'shadow-emerald-500/40',
            url: '/hms/doctor/dashboard',
            permission: 'hms_doctor'
        },
        { 
            id: 'nursing', 
            label: 'Nursing', 
            icon: <HeartPulse className="h-5 w-5" />, 
            color: 'bg-rose-500', 
            shadow: 'shadow-rose-500/40',
            url: '/hms/nursing/dashboard',
            permission: 'hms_nursing'
        },
        { 
            id: 'lab', 
            label: 'Lab Hub', 
            icon: <FlaskConical className="h-5 w-5" />, 
            color: 'bg-amber-500', 
            shadow: 'shadow-amber-500/40',
            url: '/hms/lab/dashboard',
            permission: 'hms_lab'
        },
        { 
            id: 'billing', 
            label: 'Billing', 
            icon: <Receipt className="h-5 w-5" />, 
            color: 'bg-violet-500', 
            shadow: 'shadow-violet-500/40',
            url: '/hms/billing',
            permission: 'hms_billing'
        }
    ].filter(s => hasPermission(s.permission));

    const pinCurrentPage = () => {
        if (personalPins.some(p => p.url === pathname)) return;
        
        // Extract a clean label from pathname
        const segments = pathname.split('/').filter(Boolean);
        const name = segments[segments.length - 1].replace(/-/g, ' ').toUpperCase();
        
        const newPin = {
            id: `pin-${Date.now()}`,
            label: name,
            url: pathname,
            icon: <Activity className="h-5 w-5" />,
            color: 'bg-slate-700',
            shadow: 'shadow-slate-500/20'
        };

        const updated = [...personalPins, newPin].slice(-3); // Limit to 3 custom pins
        setPersonalPins(updated);
        localStorage.setItem('ziona-capsule-pins', JSON.stringify(updated));
    };

    const removePin = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const updated = personalPins.filter(p => p.id !== id);
        setPersonalPins(updated);
        localStorage.setItem('ziona-capsule-pins', JSON.stringify(updated));
    };

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 40, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 40, scale: 0.8 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className="mb-6 pointer-events-auto"
                    >
                        <div className="flex items-center gap-3 p-2 bg-slate-900/90 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-full border border-white/10 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
                            
                            {/* Core Core Shortcuts */}
                            {coreShortcuts.map((shortcut) => (
                                <button
                                    key={shortcut.id}
                                    onClick={() => {
                                        router.push(shortcut.url);
                                        setIsOpen(false);
                                    }}
                                    className="group relative flex flex-col items-center gap-1.5 p-1.5 transition-all"
                                >
                                    <div className={cn(
                                        "h-12 w-12 rounded-full flex items-center justify-center text-white transition-all transform group-hover:scale-110 group-hover:-translate-y-1 group-active:scale-95",
                                        shortcut.color,
                                        shortcut.shadow,
                                        "shadow-lg"
                                    )}>
                                        {shortcut.icon}
                                        <div className="absolute inset-0 rounded-full bg-inherit blur-xl opacity-0 group-hover:opacity-40 transition-opacity" />
                                    </div>
                                    <span className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em] px-1 group-hover:text-white transition-colors">
                                        {shortcut.label}
                                    </span>
                                </button>
                            ))}

                            {/* Divider if personal pins exist */}
                            {personalPins.length > 0 && <div className="w-[1px] h-10 bg-white/10 mx-1" />}

                            {/* Personal Pins */}
                            {personalPins.map((pin) => (
                                <button
                                    key={pin.id}
                                    onClick={() => {
                                        router.push(pin.url);
                                        setIsOpen(false);
                                    }}
                                    onContextMenu={(e) => removePin(e, pin.id)}
                                    className="group relative flex flex-col items-center gap-1.5 p-1.5 transition-all"
                                >
                                    <div className={cn(
                                        "h-10 w-10 rounded-full flex items-center justify-center text-white/80 transition-all transform group-hover:scale-110 group-active:scale-95",
                                        "bg-slate-800 border border-white/10"
                                    )}>
                                        <Activity className="h-4 w-4" />
                                    </div>
                                    <span className="text-[8px] font-bold text-white/30 lowercase tracking-widest px-1 group-hover:text-white/60 transition-colors">
                                        {pin.label.substring(0, 10)}
                                    </span>
                                    
                                    {/* Small unpin button on hover */}
                                    <div 
                                        onClick={(e) => removePin(e, pin.id)}
                                        className="absolute -top-1 -right-1 h-4 w-4 bg-rose-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                    >
                                        <X className="h-2 w-2 text-white" />
                                    </div>
                                </button>
                            ))}
                            
                            <div className="w-[1px] h-10 bg-white/10 mx-2" />
                            
                            {/* Action Buttons */}
                            <div className="flex items-center gap-1 mr-2">
                                <button 
                                    onClick={pinCurrentPage}
                                    title="Pin Current View"
                                    className="h-10 w-10 rounded-full flex items-center justify-center text-white/40 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                                >
                                    <LayoutGrid className="h-5 w-5" />
                                </button>
                                <button 
                                    onClick={() => setIsOpen(false)}
                                    className="h-10 w-10 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                animate={{ rotate: isOpen ? 90 : 0, scale: isOpen ? 0.9 : 1 }}
                className={cn(
                    "pointer-events-auto mx-auto h-14 w-14 rounded-full flex items-center justify-center transition-all shadow-2xl backdrop-blur-xl border border-white/20",
                    isOpen ? "bg-slate-800 text-white" : "bg-indigo-600 text-white shadow-indigo-600/40 hover:scale-110 active:scale-95"
                )}
            >
                {isOpen ? <X className="h-6 w-6" /> : <Zap className="h-6 w-6 fill-current" />}
            </motion.button>
        </div>
    );
}
