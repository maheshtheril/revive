'use client'

import React, { useEffect, useState } from 'react';
import { getShiftsForAudit, getShiftSummary, verifyShift } from '@/app/actions/shift';
import { 
    ShieldCheck, 
    Calendar, 
    User, 
    ArrowRightLeft, 
    Wallet, 
    AlertCircle, 
    Search,
    ChevronRight,
    FileText,
    CheckCircle2,
    Clock,
    Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function ShiftAuditPage() {
    const [shifts, setShifts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedShift, setSelectedShift] = useState<any>(null);
    const [details, setDetails] = useState<any>(null);
    const [auditNotes, setAuditNotes] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState<{ start?: Date; end?: Date }>({
        start: new Date(new Date().setDate(new Date().getDate() - 7)),
        end: new Date()
    });
    const [quickPreset, setQuickPreset] = useState<'all' | 'today' | 'yesterday' | '7d' | 'custom'>('7d');
    const [activeTab, setActiveTab] = useState<'overview' | 'inbound' | 'outbound'>('overview');

    useEffect(() => {
        loadShifts(dateRange.start, dateRange.end);
    }, []);

    async function loadShifts(start?: Date, end?: Date) {
        setLoading(true);
        const res = await getShiftsForAudit(start, end);
        if (res.success) setShifts(res.shifts);
        else toast.error(res.error || "Failed to load shifts");
        setLoading(false);
    }

    function handleQuickPreset(preset: 'all' | 'today' | 'yesterday' | '7d' | 'custom') {
        setQuickPreset(preset);
        let s = new Date();
        let e = new Date();
        
        if (preset === 'today') {
            s.setHours(0, 0, 0, 0);
            e.setHours(23, 59, 59, 999);
        } else if (preset === 'yesterday') {
            s.setDate(s.getDate() - 1);
            s.setHours(0, 0, 0, 0);
            e.setDate(e.getDate() - 1);
            e.setHours(23, 59, 59, 999);
        } else if (preset === '7d') {
            s.setDate(s.getDate() - 7);
            s.setHours(0, 0, 0, 0);
            e.setHours(23, 59, 59, 999);
        } else if (preset === 'all') {
            s.setDate(s.getDate() - 30); // Default 30 days
            s.setHours(0, 0, 0, 0);
            e.setHours(23, 59, 59, 999);
        }
        
        setDateRange({ start: s, end: e });
        loadShifts(s, e);
    }

    async function handleViewDetails(shift: any) {
        setSelectedShift(shift);
        setDetails(null);
        const res = await getShiftSummary(shift.id);
        if (res.success) setDetails(res);
        else toast.error(res.error || "Failed to load shift details");
    }

    async function handleVerify() {
        if (!selectedShift) return;
        setIsVerifying(true);
        const res = await verifyShift(selectedShift.id, auditNotes);
        if (res.success) {
            toast.success("Shift verified successfully");
            setAuditNotes('');
            setSelectedShift(null);
            loadShifts(dateRange.start, dateRange.end);
        } else {
            toast.error(res.error || "Verification failed");
        }
        setIsVerifying(false);
    }

    const filteredShifts = shifts.filter(s => {
        if (!searchTerm) return true;
        const nameMatch = s.userName?.toLowerCase().includes(searchTerm.toLowerCase());
        const noteMatch = s.notes?.toLowerCase().includes(searchTerm.toLowerCase());
        return nameMatch || noteMatch;
    });

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/20">
                            <ShieldCheck className="h-6 w-6 text-white" />
                        </div>
                        Financial Shift Audit
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Verify daily collections, cash shortages, and counter handovers.
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <button 
                        onClick={() => loadShifts(dateRange.start, dateRange.end)} 
                        className="px-4 py-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold text-sm rounded-2xl hover:bg-indigo-100 transition-all flex items-center gap-2 border border-indigo-100 dark:border-indigo-900/50 shadow-sm"
                    >
                        <ArrowRightLeft className="h-4 w-4" /> Refresh Data
                    </button>
                </div>
            </div>

            {/* Filter Hub Card */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
                {/* Search Bar */}
                <div className="relative w-full lg:w-72">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                        type="text"
                        placeholder="Search cashier or notes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium outline-none focus:border-indigo-500 transition-all"
                    />
                </div>

                {/* Date Controls */}
                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                    {/* Quick Presets */}
                    <div className="flex items-center p-1 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                        <button 
                            onClick={() => handleQuickPreset('today')} 
                            className={`px-3 py-1.5 rounded-xl transition-all ${quickPreset === 'today' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                        >
                            Today
                        </button>
                        <button 
                            onClick={() => handleQuickPreset('yesterday')} 
                            className={`px-3 py-1.5 rounded-xl transition-all ${quickPreset === 'yesterday' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                        >
                            Yesterday
                        </button>
                        <button 
                            onClick={() => handleQuickPreset('7d')} 
                            className={`px-3 py-1.5 rounded-xl transition-all ${quickPreset === '7d' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                        >
                            Last 7 Days
                        </button>
                        <button 
                            onClick={() => handleQuickPreset('all')} 
                            className={`px-3 py-1.5 rounded-xl transition-all ${quickPreset === 'all' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                        >
                            30 Days
                        </button>
                    </div>

                    {/* Custom Date Pickers */}
                    <div className="flex items-center gap-1.5 p-1 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-medium">
                        <Calendar className="h-4 w-4 text-slate-400 ml-2" />
                        <input 
                            type="date"
                            value={dateRange.start ? format(dateRange.start, 'yyyy-MM-dd') : ''}
                            onChange={(e) => {
                                setQuickPreset('custom');
                                const d = e.target.value ? new Date(e.target.value) : undefined;
                                setDateRange(prev => ({ ...prev, start: d }));
                                loadShifts(d, dateRange.end);
                            }}
                            className="bg-transparent border-none text-slate-700 dark:text-slate-200 px-1 font-bold outline-none cursor-pointer"
                        />
                        <span className="text-slate-400 font-bold">to</span>
                        <input 
                            type="date"
                            value={dateRange.end ? format(dateRange.end, 'yyyy-MM-dd') : ''}
                            onChange={(e) => {
                                setQuickPreset('custom');
                                const d = e.target.value ? new Date(e.target.value) : undefined;
                                setDateRange(prev => ({ ...prev, end: d }));
                                loadShifts(dateRange.start, d);
                            }}
                            className="bg-transparent border-none text-slate-700 dark:text-slate-200 px-1 font-bold outline-none cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Shift List */}
                <div className="lg:col-span-7 space-y-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-white/50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200">
                            <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
                            <p className="text-slate-400 font-bold">Scanning Hospital Vault...</p>
                        </div>
                    ) : filteredShifts.length === 0 ? (
                        <div className="py-20 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 shadow-sm">
                            <Calendar className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-slate-700">No Matching Shifts</h3>
                            <p className="text-slate-400 text-sm">No shifts matched your search or selected date range.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredShifts.map((shift) => {
                                const isShort = Number(shift.difference) < 0;
                                const isAudited = shift.notes?.includes('AUDITED');

                                return (
                                    <div 
                                        key={shift.id} 
                                        onClick={() => handleViewDetails(shift)}
                                        className={`group relative overflow-hidden bg-white dark:bg-slate-800 p-5 rounded-3xl border-2 transition-all cursor-pointer hover:shadow-xl hover:shadow-indigo-500/5 ${
                                            selectedShift?.id === shift.id 
                                            ? 'border-indigo-500 shadow-lg shadow-indigo-500/10' 
                                            : 'border-slate-50 dark:border-slate-700/50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between relative z-10">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-3 rounded-2xl ${isShort ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                                    <Wallet className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-slate-800 dark:text-white text-base">
                                                        {shift.userName}
                                                    </h4>
                                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
                                                        <Calendar className="h-3 w-3 shrink-0" />
                                                        <span>{format(new Date(shift.end_time), 'MMM dd, yyyy')}</span>
                                                        <span className="text-slate-300">•</span>
                                                        <Clock className="h-3 w-3 shrink-0 ml-1" />
                                                        <span>{format(new Date(shift.start_time), 'hh:mm a')} - {format(new Date(shift.end_time), 'hh:mm a')}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <div className={`text-xl font-black ${isShort ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                    ₹{Number(shift.closing_balance).toLocaleString()}
                                                </div>
                                                {isAudited ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-500 rounded-full text-[10px] font-black uppercase tracking-tighter mt-1">
                                                        <CheckCircle2 className="h-3 w-3" /> Verified
                                                    </span>
                                                ) : isShort ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-500 rounded-full text-[10px] font-black uppercase tracking-tighter mt-1 animate-pulse">
                                                        <AlertCircle className="h-3 w-3" /> Short: ₹{Math.abs(Number(shift.difference))}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-500 rounded-full text-[10px] font-black uppercase tracking-tighter mt-1">
                                                        Ready to Audit
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right: Shift Details & Verification */}
                <div className="lg:col-span-5 sticky top-8">
                    {selectedShift ? (
                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-2xl shadow-indigo-500/5 overflow-hidden flex flex-col max-h-[calc(100vh-8rem)]">
                            {/* Detail Header */}
                            <div className="p-8 bg-indigo-500 text-white relative shrink-0">
                                <div className="absolute top-0 right-0 p-20 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                                <div className="flex items-center justify-between relative z-10">
                                    <div>
                                        <h3 className="text-2xl font-black tracking-tight">Shift Financial Audit</h3>
                                        <p className="text-indigo-100 font-medium text-sm opacity-90 uppercase tracking-widest mt-1 flex items-center gap-2">
                                            <User className="h-3 w-3" /> {selectedShift.userName}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-bold bg-indigo-600/50 text-indigo-100 px-3 py-1 rounded-xl uppercase tracking-widest border border-indigo-400/30">
                                            {selectedShift.status === 'closed' ? 'Pending Audit' : selectedShift.status}
                                        </span>
                                    </div>
                                </div>

                                {/* Navigation Tabs */}
                                <div className="flex items-center gap-2 mt-6 bg-indigo-600/40 p-1.5 rounded-2xl border border-indigo-400/20 backdrop-blur-md relative z-10 font-bold text-xs">
                                    <button 
                                        onClick={() => setActiveTab('overview')}
                                        className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeTab === 'overview' ? 'bg-white text-indigo-600 shadow-md' : 'text-indigo-100 hover:text-white hover:bg-white/10'}`}
                                    >
                                        <Wallet className="h-3.5 w-3.5" /> Overview & Math
                                    </button>
                                    <button 
                                        onClick={() => setActiveTab('inbound')}
                                        className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeTab === 'inbound' ? 'bg-white text-indigo-600 shadow-md' : 'text-indigo-100 hover:text-white hover:bg-white/10'}`}
                                    >
                                        <Clock className="h-3.5 w-3.5" /> Income ({details?.ledger?.filter((i:any) => i.type === 'IN').length || 0})
                                    </button>
                                    <button 
                                        onClick={() => setActiveTab('outbound')}
                                        className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeTab === 'outbound' ? 'bg-white text-indigo-600 shadow-md' : 'text-indigo-100 hover:text-white hover:bg-white/10'}`}
                                    >
                                        <FileText className="h-3.5 w-3.5" /> Expenses ({details?.ledger?.filter((i:any) => i.type === 'OUT').length || 0})
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
                                {activeTab === 'overview' && (
                                    <div className="space-y-6 animate-in fade-in duration-300">
                                        {/* 4-Pillar Financial Summary Grid */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                                                <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                    <span>Opening Float</span>
                                                </div>
                                                <p className="text-lg font-black text-slate-700 dark:text-slate-200">₹{Number(selectedShift.opening_balance).toLocaleString()}</p>
                                            </div>

                                            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-900/20 rounded-3xl border border-emerald-100 dark:border-emerald-900/30">
                                                <div className="flex items-center justify-between text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">
                                                    <span>Drawer Cash Income (+)</span>
                                                </div>
                                                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">₹{Number(details?.summary?.cashCollected || 0).toLocaleString()}</p>
                                            </div>

                                            <div className="p-4 bg-rose-50/50 dark:bg-rose-900/20 rounded-3xl border border-rose-100 dark:border-rose-900/30">
                                                <div className="flex items-center justify-between text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">
                                                    <span>Total Expenses (-)</span>
                                                </div>
                                                <p className="text-lg font-black text-rose-600 dark:text-rose-400">₹{Number(details?.summary?.totalOut || 0).toLocaleString()}</p>
                                            </div>

                                            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-3xl border border-indigo-100 dark:border-indigo-900/30">
                                                <div className="flex items-center justify-between text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">
                                                    <span>Declared Drawer Cash</span>
                                                </div>
                                                <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">₹{Number(selectedShift.closing_balance).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        {/* Online Bank Collections Pill */}
                                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/40 rounded-3xl flex items-center justify-between text-blue-700 dark:text-blue-300">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-500 text-white rounded-2xl">
                                                    <Wallet className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Online Bank Revenue (UPI + Card + Other)</p>
                                                    <p className="text-xs font-bold mt-0.5 opacity-90">Directly remitted to hospital bank account</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xl font-black">₹{Number((details?.summary?.upi || 0) + (details?.summary?.card || 0) + (details?.summary?.other || 0)).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        {/* Reconciliation Math Alert */}
                                        <div className={`p-4 rounded-3xl border-2 flex items-center justify-between ${Number(selectedShift.difference) < 0 ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-900/20 dark:border-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-2xl ${Number(selectedShift.difference) < 0 ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                                    <AlertCircle className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold uppercase tracking-wider opacity-80">System Expected vs Declared</p>
                                                    <p className="text-sm font-black mt-0.5">Expected: ₹{Number(selectedShift.system_balance).toLocaleString()}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-bold uppercase tracking-wider opacity-80">Shortage / Surplus</p>
                                                <p className="text-lg font-black">₹{Number(selectedShift.difference).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        {/* Payment Modes Breakdown */}
                                        {details?.summary && (
                                            <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-3 font-medium text-xs">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Collections Method Breakdown</p>
                                                <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                                                    <span className="text-slate-600 dark:text-slate-300">Physical Cash Collected</span>
                                                    <span className="font-black text-slate-800 dark:text-white">₹{Number(details.summary.cashCollected || 0).toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                                                    <span className="text-slate-600 dark:text-slate-300">UPI / QR Scan</span>
                                                    <span className="font-black text-slate-800 dark:text-white">₹{Number(details.summary.upi || 0).toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                                                    <span className="text-slate-600 dark:text-slate-300">Credit / Debit Card</span>
                                                    <span className="font-black text-slate-800 dark:text-white">₹{Number(details.summary.card || 0).toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-600 dark:text-slate-300">Other Methods</span>
                                                    <span className="font-black text-slate-800 dark:text-white">₹{Number(details.summary.other || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Audit Form */}
                                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Accountant Audit Sign-Off</h4>
                                            <textarea 
                                                value={auditNotes}
                                                onChange={(e) => setAuditNotes(e.target.value)}
                                                placeholder="Enter verification remarks (e.g., Physical cash verified against counter drawer. ₹20 shortage adjusted in petty cash...)"
                                                className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-3xl text-sm font-medium outline-none focus:border-indigo-500 transition-all min-h-[100px]"
                                            />
                                            <button 
                                                onClick={handleVerify}
                                                disabled={isVerifying}
                                                className="w-full mt-4 py-4 bg-indigo-600 text-white font-black rounded-3xl shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                                            >
                                                {isVerifying ? 'Processing...' : <><CheckCircle2 className="h-5 w-5" /> Verify & Close Shift Audit</>}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'inbound' && (
                                    <div className="space-y-4 animate-in fade-in duration-300">
                                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 font-black text-xs text-slate-400 uppercase tracking-widest">
                                            <span>Patient Invoices Collected</span>
                                            <span className="text-emerald-500">Total: ₹{Number(details?.summary?.totalIn || 0).toLocaleString()}</span>
                                        </div>

                                        {details ? (
                                            <div className="space-y-2.5">
                                                {details.ledger?.filter((i:any) => i.type === 'IN').map((item: any, idx: number) => (
                                                    <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs hover:border-emerald-500/30 transition-all">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 font-bold uppercase text-[10px]">
                                                                {item.method}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[220px]">
                                                                    {item.description}
                                                                </div>
                                                                <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                                                    {format(new Date(item.time), 'hh:mm a')}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                                                + ₹{Number(item.amount).toLocaleString()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {details.ledger?.filter((i:any) => i.type === 'IN').length === 0 && (
                                                    <p className="text-center text-slate-400 py-10 text-xs font-bold">No income recorded in this shift.</p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="animate-pulse space-y-3">
                                                {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-50 dark:bg-slate-900 rounded-2xl w-full"></div>)}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'outbound' && (
                                    <div className="space-y-4 animate-in fade-in duration-300">
                                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 font-black text-xs text-slate-400 uppercase tracking-widest">
                                            <span>Outbound Petty Cash / F5 Vouchers</span>
                                            <span className="text-rose-500">Total: ₹{Number(details?.summary?.totalOut || 0).toLocaleString()}</span>
                                        </div>

                                        {details ? (
                                            <div className="space-y-2.5">
                                                {details.ledger?.filter((i:any) => i.type === 'OUT').map((item: any, idx: number) => (
                                                    <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs hover:border-rose-500/30 transition-all">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 font-black text-[10px]">
                                                                F5
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[220px]">
                                                                    {item.description}
                                                                </div>
                                                                <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                                                    {format(new Date(item.time), 'hh:mm a')} • {item.category}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="font-black text-rose-600 dark:text-rose-400 text-sm">
                                                                - ₹{Number(item.amount).toLocaleString()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {details.ledger?.filter((i:any) => i.type === 'OUT').length === 0 && (
                                                    <p className="text-center text-slate-400 py-10 text-xs font-bold">No F5 outbound expenses in this shift.</p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="animate-pulse space-y-3">
                                                {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-50 dark:bg-slate-900 rounded-2xl w-full"></div>)}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-800 rounded-[2.5rem] border border-dashed border-slate-200">
                            <Search className="h-16 w-16 text-slate-100 mb-6" />
                            <h3 className="text-xl font-black text-slate-300">Select a Shift</h3>
                            <p className="text-slate-400 text-sm font-medium mt-2">
                                Click on a shift from the list to view its transactions and perform the audit.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
