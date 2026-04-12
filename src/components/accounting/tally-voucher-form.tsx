'use client';

import { useState, useEffect, useRef } from 'react';
import { Save, Loader2, Search, X, Check } from 'lucide-react';

interface TallyPaymentFormProps {
    type: 'payment' | 'receipt';
    initialData?: any;
    onSave: (data: any) => Promise<any>;
    onCancel: () => void;
    suppliersSearch?: (query: string) => Promise<any[]>;
    patientsSearch?: (query: string) => Promise<any[]>;
    accountsSearch?: (query: string) => Promise<any[]>;
    journalsSearch?: (query: string) => Promise<any[]>;
    getBills?: (partnerId: string, includeIds?: string[]) => Promise<any>;
    currency?: string;
}

/**
 * TallySelect: A localized search component that doesn't use any shared code.
 * FORCED HIGH-CONTRAST COLORS: Black-on-Yellow Focus, White-on-Navy List.
 */
function TallySelect({ 
    id, 
    value, 
    label, 
    placeholder, 
    onSearch, 
    onChange,
    autoFocus = false 
}: { 
    id: string; 
    value: string | null; 
    label: string; 
    placeholder: string; 
    onSearch: (q: string) => Promise<any[]>;
    onChange: (id: string, label: string) => void;
    autoFocus?: boolean;
}) {
    const [query, setQuery] = useState(label || '');
    const [results, setResults] = useState<any[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setQuery(label || '');
    }, [label]);

    const performSearch = async (q: string) => {
        setLoading(true);
        try {
            const res = await onSearch(q);
            // Map results to ensure we have label/subLabel even if the API uses name/id
            const mapped = (res || []).map((item: any) => ({
                ...item,
                label: item.label || item.name || 'Unnamed Account',
                subLabel: item.subLabel || item.code || (item.type ? `(${item.type})` : '')
            }));
            setResults(mapped);
            setOpen(true);
            setActiveIndex(0);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (item: any) => {
        onChange(item.id, item.label);
        setQuery(item.label);
        setOpen(false);
    };

    const handleBlur = () => {
        // Strict Reset: If we don't have a valid value (ID), revert query to label
        if (!value) {
            setQuery('');
        } else {
            setQuery(label || '');
        }
        setOpen(false);
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            <input
                id={id}
                ref={inputRef}
                type="text"
                autoComplete="off"
                autoFocus={autoFocus}
                value={(open ? query : (label)) || ''}
                onChange={(e) => {
                    const val = e.target.value || '';
                    setQuery(val);
                    performSearch(val);
                }}
                onFocus={() => {
                    performSearch(query);
                }}
                onBlur={() => {
                    // Delay slightly to allow onMouseDown to trigger selection
                    setTimeout(handleBlur, 200);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setActiveIndex(prev => Math.min(prev + 1, results.length - 1));
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setActiveIndex(prev => Math.max(prev - 1, 0));
                    } else if (e.key === 'Enter' && open && results[activeIndex]) {
                        e.preventDefault();
                        handleSelect(results[activeIndex]);
                    } else if (e.key === 'Escape') {
                        setOpen(false);
                    }
                }}
                placeholder={placeholder}
                className={`w-full bg-transparent border-none outline-none text-[#ffffcc] text-xs placeholder:text-[#64ffff]/30 focus:bg-[#ffffcc] focus:text-black focus:font-bold px-1 py-0.5
                    ${!value && query && !open ? 'ring-1 ring-red-500 bg-red-900/20' : ''}`}
            />
            {open && (
                <div className="absolute z-[200] w-full mt-1 bg-[#000080] border border-[#006666] shadow-2xl max-h-60 overflow-auto">
                    {loading ? (
                        <div className="p-2 text-[10px] text-[#64ffff] italic">Searching...</div>
                    ) : results.length > 0 ? (
                        <ul className="py-1">
                            {results.map((item, idx) => (
                                <li
                                    key={item.id}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleSelect(item);
                                    }}
                                    onMouseEnter={() => setActiveIndex(idx)}
                                    className={`px-3 py-1.5 cursor-pointer flex flex-col border-b border-[#004d4d]/30 
                                        ${idx === activeIndex ? 'bg-[#006666]' : ''}`}
                                >
                                    <span className="text-white text-xs font-bold leading-tight">{item.label}</span>
                                    {item.subLabel && (
                                        <span className="text-[#64ffff] text-[9px] uppercase tracking-wider">{item.subLabel}</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="p-3 text-[10px] border-b border-red-900 bg-red-500/10 flex flex-col gap-1">
                            <span className="font-bold text-red-400 uppercase tracking-widest">Spelling Error / Not Found</span>
                            <span className="text-[#64ffff]/40">Ensure you have created this ledger in the Chart of Accounts first.</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function TallyPaymentForm({
    type,
    initialData,
    onSave,
    onCancel,
    suppliersSearch,
    patientsSearch,
    accountsSearch,
    journalsSearch,
    getBills,
    currency = '₹'
}: TallyPaymentFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [voucherType, setVoucherType] = useState<'bill' | 'direct'>(type === 'payment' ? 'bill' : 'direct');
    const [showAcceptPrompt, setShowAcceptPrompt] = useState(false);
    const [isSavedSuccessfully, setIsSavedSuccessfully] = useState(false);

    // Headers
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [journalId, setJournalId] = useState<string | null>(null);
    const [journalName, setJournalName] = useState('');
    const [partnerId, setPartnerId] = useState<string | null>(null);
    const [partnerName, setPartnerName] = useState('');

    // Grids
    const [bills, setBills] = useState<any[]>([]);
    const [allocations, setAllocations] = useState<Record<string, number>>({});
    const [directLines, setDirectLines] = useState<any[]>([
        { id: Math.random().toString(), accountId: '', accountName: '', amount: '' }
    ]);
    const [amount, setAmount] = useState('');
    const [memo, setMemo] = useState('');

    const [isLoaded, setIsLoaded] = useState(false);

    // Initial Data Hydration
    useEffect(() => {
        if (initialData && !isLoaded) {
            setDate(initialData.date || new Date().toISOString().split('T')[0]);
            setJournalId(initialData.journalId || null);
            setJournalName(initialData.journalName || '');
            setPartnerId(initialData.partner_id || null);
            setPartnerName(initialData.partnerName || '');
            setAmount(initialData.amount || '');
            setMemo(initialData.memo || '');
            
            if (initialData.lines) setDirectLines(initialData.lines);
            if (initialData.allocations) {
                const map: Record<string, number> = {};
                initialData.allocations.forEach((a: any) => map[a.invoiceId] = Number(a.amount));
                setAllocations(map);
            }
            
            // Logic: If partner exists, it's almost always a Bill-wise entry for HMS
            if (initialData.partner_id) setVoucherType('bill');
            else if (initialData.lines && initialData.lines.length > 0) setVoucherType('direct');

            setIsLoaded(true);
        }
    }, [initialData, isLoaded]);

    // Fetch Bills on Partner Selection
    useEffect(() => {
        if (partnerId && voucherType === 'bill' && getBills) {
            const fetch = async () => {
                const res = await getBills(partnerId);
                if (res.success) setBills(res.data || []);
            };
            fetch();
        }
    }, [partnerId, voucherType, getBills]);

    const [localVoucherNo, setLocalVoucherNo] = useState(1);

    const resetForm = () => {
        setPartnerId(null);
        setPartnerName('');
        setBills([]);
        setAllocations({});
        setDirectLines([{ id: Math.random().toString(), accountId: '', accountName: '', amount: '' }]);
        setAmount('');
        setMemo('');
        setIsSavedSuccessfully(false);
    };

    // Keyboard Listeners (Ctrl+A, Esc, Y/N)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+A -> Show Accept Prompt (Save)
            const isCtrlA = e.ctrlKey && e.key.toLowerCase() === 'a';
            if (isCtrlA) {
                e.preventDefault();
                if (!showAcceptPrompt && !isSavedSuccessfully && Number(amount || 0) > 0) {
                    setShowAcceptPrompt(true);
                }
            }
            // Esc -> Close Prompt or Abort
            if (e.key === 'Escape') {
                if (showAcceptPrompt) setShowAcceptPrompt(false);
                else if (!isSavedSuccessfully) onCancel();
            }
            // Y or Enter in Prompt
            if (showAcceptPrompt && (e.key.toLowerCase() === 'y' || (e.key === 'Enter' && !isSubmitting))) {
                e.preventDefault();
                handleSave();
            }
            // N in Prompt
            if (showAcceptPrompt && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                setShowAcceptPrompt(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showAcceptPrompt, isSavedSuccessfully, amount, isSubmitting, onCancel]);

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            const payload: any = {
                date: new Date(date),
                amount: Number(amount),
                journalId,
                partner_id: partnerId,
                memo,
                type: type === 'payment' ? 'outbound' : 'inbound'
            };

            if (voucherType === 'bill') {
                payload.allocations = Object.entries(allocations)
                    .filter(([_, amt]) => Number(amt) > 0)
                    .map(([id, amt]) => ({ invoiceId: id, amount: Number(amt) }));
            } else {
                payload.lines = directLines
                    .filter(l => l.accountId && Number(l.amount) > 0)
                    .map(l => ({ accountId: l.accountId, amount: Number(l.amount) }));
            }

            await onSave(payload);
            setIsSavedSuccessfully(true);
            
            // World Standard Continuous Entry: Reset for NEW Voucher after 1s
            setTimeout(() => {
                resetForm();
                setLocalVoucherNo(prev => prev + 1);
            }, 1000);
        } finally {
            setIsSubmitting(false);
            setShowAcceptPrompt(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[#003333] text-[#64ffff] font-mono select-none flex flex-col overflow-hidden">
            {/* Legend Bar */}
            <div className="h-7 bg-[#004d4d] flex items-center justify-between px-2 text-[10px] font-bold border-b border-[#006666]">
                <div className="flex items-center gap-4">
                    <span className="uppercase">{type} VOUCHER ENTRY</span>
                    <span className="text-[#ffffcc]">No. {localVoucherNo}</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-[#ffffcc]">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                {/* 1. Success Message overlay */}
                {isSavedSuccessfully && (
                    <div className="absolute inset-0 z-[300] bg-black/80 flex items-center justify-center animate-in fade-in duration-300">
                        <div className="bg-[#ffffcc] text-black p-8 border-4 border-[#006666] shadow-[0_0_50px_rgba(255,255,204,0.3)] text-center scale-110 animate-in zoom-in-95">
                            <Check className="h-12 w-12 mx-auto mb-4" />
                            <div className="text-2xl font-black uppercase tracking-tighter">Voucher Saved</div>
                            <div className="text-[10px] mt-2 opacity-60">Entry posted to ledger successfully</div>
                        </div>
                    </div>
                )}

                {/* 2. Accept Prompt (World Standard) */}
                {showAcceptPrompt && (
                    <div className="absolute inset-0 z-[250] bg-black/40 flex items-center justify-center backdrop-blur-sm">
                        <div className="bg-[#000080] border-2 border-[#ffffcc] p-6 shadow-2xl animate-in zoom-in-95 duration-100">
                            <div className="text-white text-xl font-black uppercase tracking-widest mb-4">Accept?</div>
                            <div className="flex gap-4">
                                <button 
                                    autoFocus
                                    onClick={handleSave}
                                    className="bg-[#ffffcc] text-black px-6 py-1 font-black uppercase text-xs hover:bg-white"
                                >Yes (Enter)</button>
                                <button 
                                    onClick={() => setShowAcceptPrompt(false)}
                                    className="border border-[#ffffcc] text-[#ffffcc] px-6 py-1 font-black uppercase text-xs hover:bg-[#004d4d]"
                                >No (Esc)</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Form Main Area */}
                <div className="flex-1 flex flex-col bg-[#004d4d] border-r border-[#006666] m-1 p-8 space-y-8 overflow-auto">
                    <div className="grid grid-cols-1 gap-6 max-w-2xl">
                        {/* Header Details */}
                        <div className="flex items-center gap-4">
                            <span className="w-24 text-[11px] uppercase tracking-widest">Date</span>
                            <span className="">:</span>
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="bg-[#003333] border-none outline-none text-[#ffffcc] focus:bg-[#000080] px-2 text-xs"
                            />
                        </div>

                        <div className="flex items-center gap-4 border-b border-[#006666] pb-4 mb-2">
                             <span className="w-24 text-[11px] uppercase tracking-widest text-[#64ffff]/50">Entry Mode</span>
                             <span className="">:</span>
                             <div className="flex gap-4">
                                <button 
                                    onClick={() => setVoucherType('bill')} 
                                    className={`px-4 py-0.5 text-[10px] uppercase font-black border ${voucherType === 'bill' ? 'bg-[#ffffcc] text-black border-[#ffffcc] shadow-[0_0_10px_rgba(255,255,204,0.3)]' : 'text-[#64ffff] border-[#006666]'}`}
                                >Against Bill</button>
                                <button 
                                    onClick={() => setVoucherType('direct')} 
                                    className={`px-4 py-0.5 text-[10px] uppercase font-black border ${voucherType === 'direct' ? 'bg-[#ffffcc] text-black border-[#ffffcc] shadow-[0_0_10px_rgba(255,255,204,0.3)]' : 'text-[#64ffff] border-[#006666]'}`}
                                >Indirect Expense</button>
                             </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <span className="w-24 text-[11px] uppercase tracking-widest">Account</span>
                            <span className="">:</span>
                            <div className="w-80">
                                <TallySelect
                                    id="money-account"
                                    value={journalId}
                                    label={journalName}
                                    placeholder="Select Cash / Bank Account..."
                                    onSearch={journalsSearch || (async () => [])}
                                    onChange={(id, lbl) => {
                                        setJournalId(id);
                                        setJournalName(lbl);
                                    }}
                                    autoFocus
                                />
                            </div>
                        </div>

                        {voucherType === 'bill' && (
                            <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top-1">
                                <span className="w-24 text-[11px] uppercase tracking-widest">Particulars</span>
                                <span className="">:</span>
                                <div className="w-80">
                                    <TallySelect
                                        id="partner-account"
                                        value={partnerId}
                                        label={partnerName}
                                        placeholder={type === 'payment' ? 'Select Vendor Ledger...' : 'Select Payer Ledger...'}
                                        onSearch={(type === 'payment' ? suppliersSearch : patientsSearch) || (async () => [])}
                                        onChange={(id, lbl) => {
                                            setPartnerId(id);
                                            setPartnerName(lbl);
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* DYNAMIC SUBTITLE */}
                    <div className="mb-4">
                        <div className="text-[10px] uppercase font-bold text-[#64ffff] opacity-40 italic tracking-widest">
                            {voucherType === 'bill' ? 'Select bills below to reconcile payment' : 'Enter indirect expense ledgers (Rent, Travel, Office) below'}
                        </div>
                    </div>

                    {/* 3. PARTICULARS GRID */}
                    <div className="flex-1 flex flex-col border border-[#006666] min-h-[300px] shadow-2xl">
                        <div className="grid grid-cols-12 bg-[#006666] text-[10px] font-bold py-1">
                            <div className="col-span-1 px-3">NO</div>
                            <div className="col-span-8 px-3">PARTICULARS</div>
                            <div className="col-span-3 px-3 text-right">AMOUNT</div>
                        </div>

                        <div className="flex-1 bg-[#003333] overflow-auto">
                            {voucherType === 'bill' ? (
                                bills.length > 0 ? (
                                    bills.map((bill, idx) => (
                                        <div key={bill.id} className="grid grid-cols-12 text-xs border-b border-[#004d4d]/30 hover:bg-[#000080]/50 h-8 items-center">
                                            <div className="col-span-1 px-3 opacity-50">{idx + 1}</div>
                                            <div className="col-span-8 px-3 flex justify-between">
                                                <span className="text-white font-bold">{bill.number}</span>
                                                <span className="text-[10px] italic text-[#64ffff]/60">Bal: {bill.outstanding}</span>
                                            </div>
                                            <div className="col-span-3">
                                                <input
                                                    type="number"
                                                    value={allocations[bill.id] || ''}
                                                    onChange={e => {
                                                        const newMap = { ...allocations, [bill.id]: Number(e.target.value) };
                                                        setAllocations(newMap);
                                                        const total = (Object.values(newMap) as number[]).reduce((acc, val) => acc + (val || 0), 0);
                                                        setAmount(total.toString());
                                                    }}
                                                    className="w-full bg-transparent text-right outline-none text-[#ffffcc] focus:bg-[#000080]"
                                                />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 text-center text-[10px] text-[#64ffff]/30 italic uppercase tracking-widest">No outstanding bills for this ledger</div>
                                )
                            ) : (
                                directLines.map((line, idx) => (
                                    <div key={line.id} className="grid grid-cols-12 text-xs border-b border-[#004d4d]/30 hover:bg-[#000080]/50 h-8 items-center">
                                        <div className="col-span-1 px-3 opacity-50">{idx + 1}</div>
                                        <div className="col-span-8 px-3">
                                            <TallySelect
                                                id={`direct-acc-${idx}`}
                                                value={line.accountId}
                                                label={line.accountName}
                                                placeholder="Select Expense Ledger..."
                                                onSearch={accountsSearch || (async () => [])}
                                                onChange={(id, lbl) => {
                                                    const lines = [...directLines];
                                                    lines[idx] = { ...lines[idx], accountId: id, accountName: lbl };
                                                    setDirectLines(lines);
                                                }}
                                            />
                                        </div>
                                        <div className="col-span-3 px-3">
                                            <input
                                                type="number"
                                                value={line.amount}
                                                onChange={e => {
                                                    const lines = [...directLines];
                                                    lines[idx] = { ...lines[idx], amount: e.target.value };
                                                    setDirectLines(lines);
                                                    const total = lines.reduce((acc: number, ln: any) => acc + Number(ln.amount || 0), 0);
                                                    setAmount(total.toString());
                                                    if (e.target.value && idx === lines.length - 1) {
                                                        setDirectLines([...lines, { id: Math.random().toString(), accountId: '', accountName: '', amount: '' }]);
                                                    }
                                                }}
                                                className="w-full bg-transparent text-right outline-none text-[#ffffcc] focus:bg-[#000080]"
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Total Bar */}
                        <div className="grid grid-cols-12 bg-[#006666] text-xs font-black py-2">
                             <div className="col-span-9 px-4 text-right opacity-80 tracking-widest">TOTAL</div>
                             <div className="col-span-3 px-4 text-right text-white drop-shadow-[0_0_5px_#ffffcc]">{currency} {Number(amount || 0).toLocaleString()}</div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] opacity-60 uppercase tracking-widest">Narration</span>
                        <textarea
                            value={memo}
                            onChange={e => setMemo(e.target.value)}
                            className="bg-[#003333] border border-[#006666] outline-none text-[#ffffcc] p-2 text-xs min-h-[60px]"
                        />
                    </div>
                </div>

                {/* Legend/Actions Side - HIDDEN ON MOBILE */}
                <div className="hidden lg:flex w-56 bg-[#003333] flex-col p-1 gap-1 border-l border-[#006666]">
                    <div className="bg-[#004d4d] py-4 text-center font-black text-[#ffffcc] border border-[#006666] mb-2 tracking-widest text-[11px]">GATEWAY OF ERP</div>
                    
                    {[
                        { key: 'F4', label: 'CONTRA' },
                        { key: 'F5', label: 'PAYMENT', active: type === 'payment' },
                        { key: 'F6', label: 'RECEIPT', active: type === 'receipt' },
                        { key: 'F7', label: 'JOURNAL' },
                        { key: 'F8', label: 'CREDIT NOTE' },
                        { key: 'F9', label: 'DEBIT NOTE' },
                        { key: 'F12', label: 'CONFIGURE' }
                    ].map(btn => (
                        <div key={btn.key} className={`flex items-center px-2 py-1 text-[10px] cursor-pointer hover:bg-[#000080] ${btn.active ? 'bg-[#ffffcc] text-black font-black' : ''}`}>
                            <span className="w-8 opacity-40">{btn.key}</span>
                            <span>{btn.label}</span>
                        </div>
                    ))}

                    <div className="mt-auto p-4 bg-black/20 border border-[#004d4d] text-[8px] text-[#64ffff]/40 uppercase leading-loose">
                        Node: Financial Prime<br/>
                        License: Institutional<br/>
                        Auth: Verified
                    </div>
                </div>
            </div>

            {/* Save Area - FIXED BOTTOM BAR */}
            <div className="h-10 bg-black/40 border-t border-[#006666] flex items-center justify-between px-4 mt-auto">
                <button onClick={onCancel} className="text-xs text-red-400 font-bold hover:text-white uppercase transition-colors">Abort (Esc)</button>
                <div className="flex gap-4">
                    <button 
                        onClick={() => setShowAcceptPrompt(true)} 
                        disabled={isSubmitting || isSavedSuccessfully}
                        className="bg-[#ffffcc] text-black px-10 h-7 text-[11px] font-black uppercase hover:bg-[#64ffff] transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(255,255,204,0.4)] animate-pulse hover:animate-none"
                    >
                        {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        Save Voucher (Ctrl+A)
                    </button>
                </div>
            </div>
        </div>
    );
}
