'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Save, Loader2, ArrowLeft, Calendar,
    ArrowRight, User, Building2, Layers, HelpCircle
} from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface ClassicVoucherEditorProps {
    type: 'payment' | 'receipt';
    initialData?: any;
    onSave: (data: any) => Promise<any>;
    onCancel: () => void;
    suppliersSearch?: (query: string) => Promise<any[]>;
    patientsSearch?: (query: string) => Promise<any[]>;
    accountsSearch?: (query: string) => Promise<any[]>;
    getBills?: (partnerId: string) => Promise<any>;
    currency?: string;
}

export function ClassicVoucherEditor({
    type,
    onSave,
    onCancel,
    suppliersSearch,
    patientsSearch,
    accountsSearch,
    getBills,
    currency = '₹'
}: ClassicVoucherEditorProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [voucherType, setVoucherType] = useState<'bill' | 'direct'>(type === 'payment' ? 'bill' : 'direct');

    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('bank_transfer');
    const [reference, setReference] = useState('');
    const [memo, setMemo] = useState('');

    // Partner State
    const [partnerId, setPartnerId] = useState<string | null>(null);
    const [partnerName, setPartnerName] = useState('');
    const [payeeName, setPayeeName] = useState('');

    // Bill Mode State
    const [bills, setBills] = useState<any[]>([]);
    const [allocations, setAllocations] = useState<Record<string, number>>({});
    const [isFetchingBills, setIsFetchingBills] = useState(false);

    // Direct Mode State
    const [directLines, setDirectLines] = useState<any[]>([
        { id: '1', accountId: '', accountName: '', description: '', amount: '' }
    ]);

    // Handle Partner Change
    const handlePartnerChange = async (id: string | null, opt?: any) => {
        setPartnerId(id);
        setPartnerName(opt?.label || '');
        if (id && type === 'payment' && voucherType === 'bill' && getBills) {
            setIsFetchingBills(true);
            const res = (await getBills(id)) as any;
            if (res.success) {
                setBills(res.data || []);
                setAllocations({});
            }
            setIsFetchingBills(false);
        } else {
            setBills([]);
            setAllocations({});
        }
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        const payload: any = {
            type: type === 'payment' ? 'outbound' : 'inbound',
            partner_id: partnerId,
            amount: Number(amount),
            method,
            reference,
            date: new Date(date),
            memo,
        };

        if (type === 'payment') {
            if (voucherType === 'bill') {
                payload.allocations = Object.entries(allocations)
                    .filter(([_, amt]) => amt > 0)
                    .map(([id, amt]) => ({ invoiceId: id, amount: amt }));
            } else {
                payload.payeeName = payeeName;
                payload.lines = directLines
                    .filter(l => l.accountId && Number(l.amount) > 0)
                    .map(l => ({
                        accountId: l.accountId,
                        amount: Number(l.amount),
                        description: l.description
                    }));
            }
        }

        const success = await onSave(payload);
        if (success !== false) {
            // Reset Form for next entry
            setAmount('');
            setPartnerId(null);
            setPartnerName('');
            setPayeeName('');
            setBills([]);
            setAllocations({});
            setDirectLines([{ id: '1', accountId: '', accountName: '', description: '', amount: '' }]);
            setMemo('');

            // Force focus back to Ledger Search
            setTimeout(() => {
                const ledgerInput = document.getElementById('main-ledger-search') as HTMLInputElement;
                if (ledgerInput) {
                    ledgerInput.focus();
                    ledgerInput.select();
                }
            }, 100);
        }
        setIsSubmitting(false);
    };

    useEffect(() => {
        const handleKeys = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                handleSave();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
            }
            if (e.key === 'F5') {
                e.preventDefault();
                // If already on payment, do nothing, else we might need to navigate or change internal state
                // Since 'type' is a prop, we should ideally handle this via navigation or a callback
                window.location.href = '/hms/accounting/payments/new';
            }
            if (e.key === 'F6') {
                e.preventDefault();
                window.location.href = '/hms/accounting/receipts/new';
            }
            if (e.key === 'F7') {
                e.preventDefault();
                window.location.href = '/hms/accounting/journals';
            }
            if (e.key === 'F8') {
                e.preventDefault();
                window.location.href = '/hms/accounting/credit-notes/new';
            }
            if (e.key === 'F9') {
                e.preventDefault();
                window.location.href = '/hms/accounting/debit-notes/new';
            }
        };
        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, [amount, partnerId, allocations, directLines, onCancel]);

    return (
        <div className="fixed inset-0 z-[100] bg-[#002b2b] text-[#ffffcc] font-mono select-none flex flex-col overflow-hidden">
            {/* Tally Header Bar */}
            <div className="h-8 bg-[#004d4d] flex items-center justify-between px-2 border-b border-[#006666] text-[10px] font-bold">
                <div className="flex items-center gap-4">
                    <span className="text-[#64ffff]">{type.toUpperCase()} VOUCHER ENTRY</span>
                    <span className="text-[#ffffcc]">No. 1</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-[#64ffff]">Enterprise ERP</span>
                    <span className="text-[#ffffcc]">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
            </div>

            {/* Main Voucher Body */}
            <div className="flex-1 flex gap-1 p-1">
                {/* Left Side: Current Entry */}
                <div className="flex-1 bg-[#004d4d] border border-[#006666] flex flex-col">
                    <div className="h-8 bg-[#006666] flex items-center px-4 justify-between border-b border-[#008080]">
                        <span className="text-[12px] font-black">{type === 'payment' ? 'PAYMENT' : 'RECEIPT'} VOUCHER</span>
                        <div className="flex gap-4 text-[10px]">
                            <span className="text-white">F2: DATE</span>
                            <span className="text-white">F12: CONFIGURE</span>
                        </div>
                    </div>

                    <div className="p-8 space-y-6 flex-1 overflow-auto">
                        {/* Date Row */}
                        <div className="flex items-center gap-4 text-sm">
                            <span className="w-32 text-[#64ffff]">Date</span>
                            <span className="w-4">:</span>
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="bg-[#002b2b] border-none outline-none text-[#ffffcc] focus:bg-[#ffffcc] focus:text-black px-2 py-0.5"
                            />
                        </div>

                        {/* Partner Row */}
                        <div className="flex items-center gap-4 text-sm">
                            <span className="w-32 text-[#64ffff]">{type === 'payment' ? 'Account (Debit)' : 'Account (Credit)'}</span>
                            <span className="w-4">:</span>
                            <div className="flex-1 max-w-md">
                                <SearchableSelect
                                    inputId="main-ledger-search"
                                    value={partnerId}
                                    onChange={(id, opt) => {
                                        handlePartnerChange(id, opt);
                                        if (id) {
                                            // More aggressive focus attempt
                                            setTimeout(() => {
                                                const btn = document.getElementById('entry-mode-bill');
                                                if (btn) btn.focus();
                                                else {
                                                    const firstAmt = document.getElementById('amount-bill-0');
                                                    if (firstAmt) firstAmt.focus();
                                                    const firstPart = document.getElementById('particulars-direct-0')?.querySelector('input');
                                                    if (firstPart) firstPart.focus();
                                                }
                                            }, 150);
                                        }
                                    }}
                                    onSearch={((type === 'payment' ? suppliersSearch : patientsSearch) || (async () => [])) as any}
                                    placeholder="Select Ledger..."
                                    className="bg-[#002b2b] border-none text-xs text-[#ffffcc]"
                                    isDark
                                />
                            </div>
                        </div>

                        {/* Mode Switcher (Payment only) */}
                        {type === 'payment' && (
                            <div className="flex items-center gap-4 text-[10px] text-[#64ffff]">
                                <span className="w-32">Entry Mode</span>
                                <span className="w-4">:</span>
                                <div className="flex gap-4">
                                    <button
                                        id="entry-mode-bill"
                                        onClick={() => setVoucherType('bill')}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                setVoucherType('bill');
                                                setTimeout(() => document.getElementById('amount-bill-0')?.focus(), 50);
                                            }
                                        }}
                                        className={`px-2 ${voucherType === 'bill' ? 'bg-[#ffffcc] text-black' : 'hover:bg-[#006666]'}`}
                                    >Against Bill</button>
                                    <button
                                        id="entry-mode-direct"
                                        onClick={() => setVoucherType('direct')}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                setVoucherType('direct');
                                                setTimeout(() => document.getElementById('particulars-direct-0')?.querySelector('input')?.focus(), 50);
                                            }
                                        }}
                                        className={`px-2 ${voucherType === 'direct' ? 'bg-[#ffffcc] text-black' : 'hover:bg-[#006666]'}`}
                                    >Direct Expense</button>
                                </div>
                            </div>
                        )}

                        {/* Particulars Table */}
                        <div className="mt-8 border border-[#006666] flex-1 min-h-[300px] flex flex-col">
                            <div className="grid grid-cols-12 bg-[#006666] text-[10px] font-bold border-b border-[#008080]">
                                <div className="col-span-1 px-2 py-1 border-r border-[#008080]">No</div>
                                <div className="col-span-7 px-2 py-1 border-r border-[#008080]">Particulars</div>
                                <div className="col-span-4 px-2 py-1 text-right">Amount</div>
                            </div>

                            <div className="flex-1 bg-[#002b2b]">
                                {voucherType === 'bill' ? (
                                    bills.length > 0 ? (
                                        bills.map((bill, idx) => (
                                            <div key={bill.id} className="grid grid-cols-12 text-xs border-b border-[#003333] hover:bg-[#004d4d]">
                                                <div className="col-span-1 px-2 py-1 border-r border-[#003333]">{idx + 1}</div>
                                                <div className="col-span-7 px-2 py-1 border-r border-[#003333] flex justify-between">
                                                    <span>{bill.number}</span>
                                                    <span className="text-[10px] text-slate-500 italic">Bal: {bill.outstanding}</span>
                                                </div>
                                                <div className="col-span-4 px-2 py-1 text-right">
                                                    <input
                                                        id={`amount-bill-${idx}`}
                                                        type="number"
                                                        value={allocations[bill.id] || ''}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                const next = document.getElementById(`amount-bill-${idx + 1}`);
                                                                if (next) next.focus();
                                                                else document.querySelector('textarea')?.focus();
                                                            }
                                                        }}
                                                        onChange={(e) => {
                                                            const val = Number(e.target.value);
                                                            const newAllocations = { ...allocations, [bill.id]: val };
                                                            setAllocations(newAllocations);
                                                            const total = (Object.values(newAllocations) as number[]).reduce((a, b) => a + Number(b || 0), 0);
                                                            setAmount(total.toString());
                                                        }}
                                                        className="bg-transparent border-none text-right w-full outline-none text-[#ffffcc] focus:bg-[#ffffcc] focus:text-black"
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-4 text-xs text-[#64ffff]/50 italic text-center">
                                            {partnerId ? 'No outstanding bills found.' : 'Select a ledger to view particulars.'}
                                        </div>
                                    )
                                ) : (
                                    directLines.map((line, idx) => (
                                        <div key={line.id} className="grid grid-cols-12 text-xs border-b border-[#003333]">
                                            <div className="col-span-1 px-2 py-1 border-r border-[#003333]">{idx + 1}</div>
                                            <div className="col-span-11 grid grid-cols-11">
                                                <div className="col-span-7 px-2 py-1 border-r border-[#003333]">
                                                    <SearchableSelect
                                                        inputId={`particulars-direct-${idx}`}
                                                        value={line.accountId}
                                                        onChange={(id, opt) => {
                                                            const newLines = directLines.map(l => l.id === line.id ? { ...l, accountId: id, accountName: opt?.label } : l);
                                                            setDirectLines(newLines);
                                                            if (id) setTimeout(() => document.getElementById(`amount-direct-${idx}`)?.focus(), 10);
                                                        }}
                                                        onSearch={(accountsSearch || (async () => [])) as any}
                                                        placeholder="Select Expense Account..."
                                                        className="bg-transparent border-none text-[10px] text-[#ffffcc]"
                                                        isDark
                                                    />
                                                </div>
                                                <div className="col-span-4 px-2 py-1 text-right">
                                                    <input
                                                        id={`amount-direct-${idx}`}
                                                        type="number"
                                                        value={line.amount}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                const next = document.getElementById(`particulars-direct-${idx + 1}`)?.querySelector('input');
                                                                if (next) {
                                                                    next.focus();
                                                                } else {
                                                                    // Auto-add line or move to narration
                                                                    if (line.amount && line.accountId) {
                                                                        const newLine = { id: Math.random().toString(), accountId: '', accountName: '', description: '', amount: '' };
                                                                        setDirectLines([...directLines, newLine]);
                                                                        setTimeout(() => document.getElementById(`particulars-direct-${idx + 1}`)?.querySelector('input')?.focus(), 50);
                                                                    } else {
                                                                        document.querySelector('textarea')?.focus();
                                                                    }
                                                                }
                                                            }
                                                        }}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            const newLines = directLines.map(l => l.id === line.id ? { ...l, amount: val } : l);
                                                            setDirectLines(newLines);
                                                            const total = newLines.reduce((a: number, b: any) => a + Number(b.amount || 0), 0);
                                                            setAmount(total.toString());
                                                        }}
                                                        className="bg-transparent border-none text-right w-full outline-none text-[#ffffcc] focus:bg-[#ffffcc] focus:text-black"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Total Bar */}
                            <div className="grid grid-cols-12 bg-[#006666] text-sm font-black border-t border-[#008080]">
                                <div className="col-span-8 px-4 py-2 text-right text-[#ffffcc]">TOTAL</div>
                                <div className="col-span-4 px-4 py-2 text-right">{currency} {Number(amount).toLocaleString()}</div>
                            </div>
                        </div>

                        {/* Narration */}
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] text-[#64ffff] font-bold uppercase tracking-widest">Narration:</span>
                            <textarea
                                value={memo}
                                onChange={e => setMemo(e.target.value)}
                                className="bg-[#002b2b] border border-[#006666] text-xs p-2 outline-none focus:border-[#ffffcc] text-[#ffffcc]"
                                rows={2}
                            />
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="h-12 bg-[#003333] border-t border-[#006666] flex items-center justify-between px-4">
                        <div className="flex gap-4">
                            <button onClick={onCancel} className="bg-red-900/50 text-red-100 px-4 py-1 text-[10px] uppercase font-black border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">Quit (Esc)</button>
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={handleSave}
                                disabled={isSubmitting}
                                className="bg-[#ffffcc] text-black px-8 py-1 text-xs uppercase font-black hover:bg-[#64ffff] transition-all flex items-center gap-2"
                            >
                                {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                Accept (Ctrl+A)
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Side: Gateway Simulation */}
                <div className="w-56 bg-[#003333] border border-[#006666] flex flex-col p-1 gap-1">
                    <div className="bg-[#004d4d] flex flex-col items-center py-4 border border-[#006666] mb-2">
                        <span className="text-[12px] font-black text-[#ffffcc]">CLASSIC ERP GATEWAY</span>
                    </div>

                    <div className="flex-1 space-y-1">
                        {[
                            { f: 'F4', l: 'CONTRA', active: false },
                            { f: 'F5', l: 'PAYMENT', active: type === 'payment' },
                            { f: 'F6', l: 'RECEIPT', active: type === 'receipt' },
                            { f: 'F7', l: 'JOURNAL', active: false },
                            { f: 'F8', l: 'CREDIT NOTE', active: false },
                            { f: 'F9', l: 'DEBIT NOTE', active: false },
                            { f: 'F11', l: 'FEATURES', active: false },
                            { f: 'F12', l: 'CONFIGURE', active: false },
                        ].map(btn => (
                            <button key={btn.f} className={`w-full flex items-center h-8 px-2 text-[10px] transition-all ${btn.active ? 'bg-[#ffffcc] text-black font-black' : 'hover:bg-[#004d4d] text-white'}`}>
                                <span className="w-8 opacity-50">{btn.f}</span>
                                <span className="flex-1 text-left">{btn.l}</span>
                            </button>
                        ))}
                    </div>

                    <div className="bg-[#004d4d] p-3 border border-[#006666]">
                        <p className="text-[8px] text-[#64ffff]/60 uppercase tracking-widest leading-relaxed">
                            System Node: Institutional Ledger v4.2<br />
                            Identity: Verified<br />
                            Sync: Live
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
