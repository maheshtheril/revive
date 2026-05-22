'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Loader2, Trash2, Save, ArrowLeft, Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Form,
    FormControl,
    FormField,
} from "@/components/ui/form";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { recordExpense } from "@/app/actions/accounting/expenses";
import { upsertPayment } from '@/app/actions/accounting/payments';
import { getJournals } from "@/app/actions/accounting-journals";
import { searchSuppliers, getOutstandingPurchaseBills } from "@/app/actions/accounting/helpers";
import { getAccounts } from "@/app/actions/accounting/chart-of-accounts";
import { cn } from "@/lib/utils";

// Tally Style Schema
const lineItemSchema = z.object({
    categoryId: z.string().min(1, "Ledger required"),
    amount: z.coerce.number().min(0.01, "Amount required"),
})

const expenseSchema = z.object({
    date: z.date(),
    journalId: z.string().min(1, "Credit Account required"),
    lines: z.array(lineItemSchema).optional(), // Optional for Bill Mode
    narration: z.string().optional()
})

type VOUCHER_MODE = 'GENERAL' | 'BILL_SETTLEMENT';


interface PaymentVoucherFormProps {
    onClose?: () => void;
    className?: string;
    onSuccess?: () => void;
    headerActions?: React.ReactNode; // For injecting top-right controls
    initialData?: any;
    simplified?: boolean;
}

export function PaymentVoucherForm({ onClose, className, onSuccess, headerActions, initialData, simplified }: PaymentVoucherFormProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    // Mode State
    const [mode, setMode] = useState<VOUCHER_MODE>(initialData?.metadata?.allocations?.length > 0 ? 'BILL_SETTLEMENT' : 'GENERAL');

    // General Mode State
    const [accounts, setAccounts] = useState<{ id: string; name: string; code: string; type: string }[]>([])
    const [journals, setJournals] = useState<{ id: string; name: string; type: string }[]>([])

    // Bill Mode State
    const [selectedVendorId, setSelectedVendorId] = useState<string | null>(initialData?.partner_id || null);
    const [bills, setBills] = useState<any[]>([]);

    // Initialize allocations from initialData if existing
    const initialAllocations: Record<string, number> = {};
    if (initialData?.metadata?.allocations) {
        initialData.metadata.allocations.forEach((a: any) => {
            initialAllocations[a.invoiceId] = Number(a.amount);
        });
    }

    const [allocations, setAllocations] = useState<Record<string, number>>(initialAllocations);
    const [totalAllocated, setTotalAllocated] = useState(initialData?.amount || 0);

    const voucherNo = initialData?.payment_number || "Auto"

    useEffect(() => {
        const fetchAccounts = async () => {
            const res = await getAccounts('', ['Expense', 'Liability', 'Equity', 'Asset', 'Cost of Goods Sold']);
            if (res.success && res.data) {
                setAccounts(res.data as any);
            }
        };
        fetchAccounts();

        const fetchJournals = async () => {
            const res = await getJournals(['cash', 'bank']);
            if (res.success && res.data) {
                setJournals(res.data as any);
            }
        };
        fetchJournals();


        // If editing in bill mode, fetch bills for the vendor
        if (initialData?.partner_id) {
            loadVendorBills(initialData.partner_id, true); // true to preserve allocations
        }

    }, [initialData]);

    const form = useForm({
        resolver: zodResolver(expenseSchema),
        defaultValues: {
            date: initialData?.date ? new Date(initialData.date) : (initialData?.created_at ? new Date(initialData.created_at) : new Date()),
            journalId: initialData?.journal_id || "",
            lines: (initialData?.payment_lines?.length > 0)
                ? initialData.payment_lines
                    .filter((l: any) => l.metadata?.account_id) // Only take expense lines (not bill allocations)
                    .map((l: any) => ({
                        categoryId: l.metadata.account_id,
                        amount: Number(l.amount)
                    }))
                : (initialData?.metadata?.lines?.length > 0
                    ? initialData.metadata.lines.map((l: any) => ({
                        categoryId: l.account_id || l.categoryId,
                        amount: Number(l.amount)
                    }))
                    : [{ categoryId: "", amount: 0 }]
                ),
            narration: initialData?.metadata?.memo || initialData?.reference || ""
        }
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "lines"
    })

    const generalTotal = form.watch("lines")?.reduce((sum, line) => sum + (Number(line.amount) || 0), 0) || 0;

    // --- Bill Logic ---

    const loadVendorBills = async (id: string | null, preserveAllocations = false) => {
        setSelectedVendorId(id);
        if (id) {
            const res = await getOutstandingPurchaseBills(id);
            if (res.success) {
                setBills(res.data || []);
                if (!preserveAllocations) {
                    setAllocations({});
                    setTotalAllocated(0);
                }
            }
        } else {
            setBills([]);
            setAllocations({});
            setTotalAllocated(0);
        }
    };

    const handleVendorSelect = (val: string | null) => {
        loadVendorBills(val, false);
    }

    const handleAllocationChange = (billId: string, val: string) => {
        const num = Number(val);
        const newAllocations = { ...allocations, [billId]: num };
        setAllocations(newAllocations);
        const total = (Object.values(newAllocations) as number[]).reduce((sum, a) => sum + a, 0);
        setTotalAllocated(total);
    };

    // --- Submission ---
    const onSubmit = async (values: z.infer<typeof expenseSchema>) => {
        setLoading(true)
        try {
            if (mode === 'GENERAL') {
                const primaryLine = values.lines![0];
                const primaryAcc = accounts.find(a => a.id === primaryLine.categoryId);
                const payeeName = primaryAcc ? primaryAcc.name : "Payment";

                const combinedMemo = values.lines!.map(l => {
                    const accName = accounts.find(a => a.id === l.categoryId)?.name || 'Exp';
                    return `${accName}: ${l.amount}`;
                }).join(', ');

                const finalMemo = values.narration ? `${values.narration} (${combinedMemo})` : combinedMemo;

                const result = await recordExpense({
                    id: initialData?.id, // Pass ID for updating
                    amount: generalTotal,
                    categoryId: primaryLine.categoryId,
                    payeeName: payeeName,
                    memo: finalMemo,
                    date: values.date,
                    journalId: values.journalId
                });

                if (result.success) {
                    toast({ title: "Success", description: `Voucher ${result.data?.payment_number} Saved`, className: "bg-emerald-50 border-emerald-200" });
                    onSuccess?.();
                    onClose?.();
                } else {
                    toast({ title: "Error", description: result.error, variant: "destructive" });
                }

            } else {
                // BILL SETTLEMENT MODE
                if (!selectedVendorId) {
                    toast({ title: "Error", description: "Select a Vendor", variant: "destructive" });
                    setLoading(false); return;
                }
                if (totalAllocated <= 0) {
                    toast({ title: "Error", description: "Allocate amount to at least one bill", variant: "destructive" });
                    setLoading(false); return;
                }

                const allocationList = Object.entries(allocations)
                    .filter(([_, amt]) => amt > 0)
                    .map(([id, amt]) => ({ invoiceId: id, amount: amt }));

                const payload = {
                    id: initialData?.id, // Pass ID for updating
                    type: 'outbound' as const,
                    partner_id: selectedVendorId,
                    amount: totalAllocated,
                    date: values.date,
                    allocations: allocationList,
                    journalId: values.journalId,
                    memo: values.narration || "Bill Settlement"
                };

                const result = await upsertPayment(payload);

                if (result.success) {
                    toast({ title: "Success", description: `Payment Voucher Saved`, className: "bg-emerald-50 border-emerald-200" });
                    onSuccess?.();
                    onClose?.();
                } else {
                    toast({ title: "Error", description: (result as any).error, variant: "destructive" });
                }
            }
        } catch (error) {
            console.error(error)
            toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
        } finally {
            setLoading(false)
        }
    }

    const accountOptions = accounts.map(acc => ({
        id: acc.id,
        label: acc.name,
        subLabel: acc.type
    }));

    return (
        <div className={cn("bg-gradient-to-br from-slate-50 via-indigo-50/20 to-emerald-50/20 dark:from-slate-950 dark:via-indigo-950/30 dark:to-emerald-950/20 font-sans text-sm flex flex-col h-full overflow-hidden text-slate-900 dark:text-slate-100", className)}>
            <Toaster />

            {/* Header - Fixed Stick Top */}
            <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-emerald-700 text-white px-8 py-4 flex justify-between items-center shadow-lg shrink-0 relative z-50 border-b border-indigo-500/30">
                <div className="flex items-center gap-4">
                    {onClose && (
                        <Button variant="ghost" size="icon" onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    )}
                    <div>
                        <span className="font-black text-xl tracking-tight block italic">{simplified ? 'Petty Cash & Expense Entry Terminal' : 'Financial Voucher Terminal'}</span>
                        <span className="text-[10px] text-indigo-200 font-bold uppercase tracking-[0.2em]">
                            {simplified ? 'Quick Expense Record (General Ledgers)' : (mode === 'GENERAL' ? 'General Expenses & Direct Payments (F5)' : 'Bill-Wise Settlement (Accounts Payable)')}
                        </span>
                    </div>
                </div>

                {/* Right Side: Mode Switcher + Custom Actions */}
                <div className="flex items-center gap-4">
                    {!simplified && (
                        <div className="flex bg-black/20 p-1.5 rounded-2xl gap-1 border border-white/10 shadow-inner">
                            <Button
                                size="sm"
                                variant="ghost"
                                className={`font-black uppercase tracking-wider text-xs px-4 h-9 rounded-xl transition-all ${mode === 'GENERAL' ? 'bg-white text-indigo-900 shadow-md hover:bg-white/90' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                                onClick={() => setMode('GENERAL')}
                            >
                                General (F5)
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className={`font-black uppercase tracking-wider text-xs px-4 h-9 rounded-xl transition-all ${mode === 'BILL_SETTLEMENT' ? 'bg-white text-indigo-900 shadow-md hover:bg-white/90' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                                onClick={() => setMode('BILL_SETTLEMENT')}
                            >
                                Bill Pay (Adv)
                            </Button>
                        </div>
                    )}
                    {/* Injected Header Actions */}
                    {headerActions && (
                        <div className="border-l border-white/20 pl-4 ml-2">
                            {headerActions}
                        </div>
                    )}
                </div>
            </div>

            {/* Top Info Bar */}
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl px-8 py-5 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-8 shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Voucher No:</span>
                    <span className="text-sm font-black font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 rounded-xl border border-indigo-100 dark:border-indigo-900/50">{voucherNo}</span>
                </div>
                <div className="flex items-center gap-3 justify-end">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Date:</span>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="h-10 px-4 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white shadow-sm hover:border-indigo-500/30 transition-all">
                                {format(form.watch("date"), "dd-MMM-yyyy")}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl">
                            <Calendar mode="single" selected={form.watch("date")} onSelect={(d) => d && form.setValue("date", d)} initialFocus />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-8 bg-transparent min-h-0 custom-scrollbar">
                <Form {...form}>
                    <form className="space-y-8 max-w-5xl mx-auto pb-6">

                        {/* Credit Account Box */}
                        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex items-center gap-6 transition-all hover:shadow-md mb-8">
                            <div className="flex items-center gap-6 flex-1">
                                <span className="font-black text-xs uppercase tracking-widest text-indigo-600 dark:text-indigo-400 w-56 text-right">Credit Account (Cash/Bank) :</span>
                                <div className="w-[450px]">
                                    <FormField
                                        control={form.control}
                                        name="journalId"
                                        render={({ field }) => (
                                            <SearchableSelect
                                                value={field.value}
                                                inputId="voucher-credit-account"
                                                autoFocus={true}
                                                onChange={(val) => {
                                                    field.onChange(val || "");
                                                    if (val) {
                                                        setTimeout(() => {
                                                            if (mode === 'GENERAL') {
                                                                const firstLedger = document.getElementById('voucher-ledger-0');
                                                                if (firstLedger) {
                                                                    firstLedger.focus();
                                                                }
                                                            } else {
                                                                const vendorSelect = document.getElementById('voucher-vendor-select');
                                                                if (vendorSelect) vendorSelect.focus();
                                                            }
                                                        }, 50);
                                                    }
                                                }}
                                                options={journals.map(j => ({ id: j.id, label: j.name, subLabel: j.type.toUpperCase() }))}
                                                onSearch={async (q) => {
                                                    const res = await getJournals(['cash', 'bank']);
                                                    return res.success && res.data ? (res.data as any).filter((j: any) => j.name.toLowerCase().includes(q.toLowerCase())).map((j: any) => ({ id: j.id, label: j.name, subLabel: j.type.toUpperCase() })) : [];
                                                }}
                                                placeholder="Select Cash / Bank Account..."
                                                className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-2xl font-bold h-11 text-xs shadow-sm"
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        </div>

                        {mode === 'GENERAL' ? (
                            // --- GENERAL MODE ---
                            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden animate-in fade-in duration-500 transition-all">
                                {/* Grid Header */}
                                <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-black text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 py-4">
                                    <div className="flex-1 px-6 border-r border-slate-200 dark:border-slate-800 text-left">Particulars (Expense / Liability)</div>
                                    <div className="w-56 px-6 text-right">Amount</div>
                                    <div className="w-16"></div>
                                </div>

                                <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                    {fields.map((field, index) => (
                                        <div key={field.id} className="flex items-center group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                            <div className="flex-1 p-3 border-r border-slate-100 dark:border-slate-800/50">
                                                <FormField
                                                    control={form.control}
                                                    name={`lines.${index}.categoryId`}
                                                    render={({ field }) => (
                                                        <SearchableSelect
                                                            value={field.value}
                                                            onChange={(val) => {
                                                                field.onChange(val || "");
                                                                if (val) {
                                                                    setTimeout(() => {
                                                                        const amtInput = document.getElementById(`voucher-amount-${index}`);
                                                                        if (amtInput) {
                                                                            amtInput.focus();
                                                                            (amtInput as HTMLInputElement).select();
                                                                        }
                                                                    }, 50);
                                                                }
                                                            }}
                                                            onSearch={async (q) => {
                                                                const res = await getAccounts(q, ['Expense', 'Liability', 'Equity', 'Asset', 'Cost of Goods Sold']);
                                                                return res.success && res.data ? res.data.map((a: any) => ({ id: a.id, label: a.name, subLabel: a.type })) : [];
                                                            }}
                                                            options={accountOptions}
                                                            placeholder="Select Ledger..."
                                                            inputId={`voucher-ledger-${index}`}
                                                            autoFocus={index > 0 && index === fields.length - 1}
                                                            className="border-0 shadow-none bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold h-11 text-xs"
                                                        />
                                                    )}
                                                />
                                            </div>
                                            <div className="w-56 p-3">
                                                <FormField
                                                    control={form.control}
                                                    name={`lines.${index}.amount`}
                                                    render={({ field }) => (
                                                        <Input
                                                            id={`voucher-amount-${index}`}
                                                            type="number"
                                                            {...field}
                                                            value={(field.value as number) || ''}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    if (index === fields.length - 1) {
                                                                        const addBtn = document.getElementById('add-ledger-row-btn');
                                                                        if (addBtn) addBtn.focus();
                                                                    } else {
                                                                        const nextAmt = document.getElementById(`voucher-amount-${index + 1}`);
                                                                        if (nextAmt) {
                                                                            nextAmt.focus();
                                                                            (nextAmt as HTMLInputElement).select();
                                                                        }
                                                                    }
                                                                }
                                                            }}
                                                            className="text-right border-0 shadow-none bg-transparent h-11 font-black text-base font-mono focus-visible:ring-1 focus-visible:ring-indigo-500 rounded-xl"
                                                            placeholder="0.00"
                                                        />
                                                    )}
                                                />
                                            </div>
                                            <div className="w-16 flex items-center justify-center p-3">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => remove(index)}
                                                    disabled={fields.length === 1}
                                                    className="h-9 w-9 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    id="add-ledger-row-btn"
                                    onClick={() => append({ categoryId: "", amount: 0 })}
                                    className="p-4 bg-slate-50/50 dark:bg-slate-800/30 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2 transition-all focus:ring-2 focus:ring-indigo-500 focus:outline-none w-full font-sans"
                                >
                                    <span className="text-base font-bold leading-none">+</span> Add Ledger Row
                                </button>
                            </div>
                        ) : (
                            // --- BILL SETTLEMENT MODE ---
                            <div className="space-y-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm animate-in fade-in duration-500">
                                <div className="flex items-center gap-6">
                                    <span className="font-black text-xs uppercase tracking-widest text-indigo-600 dark:text-indigo-400 w-48 text-right">Select Vendor :</span>
                                    <div className="w-[450px]">
                                        <SearchableSelect
                                            value={selectedVendorId}
                                            inputId="voucher-vendor-select"
                                            onChange={handleVendorSelect}
                                            onSearch={async (q) => searchSuppliers(q)}
                                            placeholder="Search Supplier Name..."
                                            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-2xl font-bold h-11 text-xs shadow-sm"
                                        />
                                    </div>
                                </div>

                                {bills.length > 0 && (
                                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-black border-b border-slate-200 dark:border-slate-800 text-[10px] tracking-widest uppercase">
                                                <tr>
                                                    <th className="p-4 px-6">Bill #</th>
                                                    <th className="p-4 px-6">Date</th>
                                                    <th className="p-4 px-6 text-right">Bill Amount</th>
                                                    <th className="p-4 px-6 text-right">Due Amount</th>
                                                    <th className="p-4 px-6 text-right bg-amber-50/50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400">Payment Allocation</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs font-bold">
                                                {bills.map(bill => (
                                                    <tr key={bill.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                        <td className="p-4 px-6 font-mono font-black">{bill.number}</td>
                                                        <td className="p-4 px-6 text-slate-400">{new Date(bill.date).toLocaleDateString()}</td>
                                                        <td className="p-4 px-6 text-right font-mono">₹{bill.total.toLocaleString()}</td>
                                                        <td className="p-4 px-6 text-right font-mono font-black text-rose-500 dark:text-rose-400">₹{bill.outstanding.toLocaleString()}</td>
                                                        <td className="p-3 px-6 text-right bg-amber-50/30 dark:bg-amber-950/10">
                                                            <Input
                                                                type="number"
                                                                value={allocations[bill.id] || ''}
                                                                onChange={(e) => handleAllocationChange(bill.id, e.target.value)}
                                                                className="text-right h-10 w-36 ml-auto bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-black font-mono rounded-xl focus-visible:ring-1 focus-visible:ring-amber-500 text-sm"
                                                                placeholder="0.00"
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {selectedVendorId && bills.length === 0 && (
                                    <div className="text-center p-12 text-slate-400 font-bold uppercase tracking-widest text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">No outstanding bills found for this vendor.</div>
                                )}
                            </div>
                        )}

                        {/* Total & Narration */}
                        <div className="flex flex-col gap-6 pt-6">
                            <div className="flex justify-end items-center gap-16 px-8 py-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Total Voucher Payment</span>
                                <span className="text-3xl font-black font-mono bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">₹ {mode === 'GENERAL' ? generalTotal.toFixed(2) : totalAllocated.toLocaleString()}</span>
                            </div>

                            <div className="flex items-start gap-6 p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
                                <span className="font-black text-xs uppercase tracking-widest text-indigo-600 dark:text-indigo-400 w-32 mt-3 text-right">Narration / Memo :</span>
                                <FormField
                                    control={form.control}
                                    name="narration"
                                    render={({ field }) => (
                                        <Textarea
                                            {...field}
                                            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-mono text-sm min-h-[90px] flex-1 max-w-2xl rounded-2xl p-4 shadow-sm focus-visible:ring-1 focus-visible:ring-indigo-500"
                                            placeholder="Enter transaction details, check number, or references..."
                                        />
                                    )}
                                />
                            </div>
                        </div>
                    </form>
                </Form>
            </div>

            {/* Sticky Footer */}
            <div className="p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 flex justify-end items-center gap-6 shadow-2xl shrink-0 z-50">
                {onClose && (
                    <Button variant="ghost" className="text-xs font-black uppercase tracking-widest rounded-2xl h-12 px-6 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onClose}>
                        Quit (Esc)
                    </Button>
                )}
                <Button onClick={form.handleSubmit(onSubmit)} disabled={loading} className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs uppercase tracking-widest h-12 px-10 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {simplified ? 'Record Expense (Yes)' : 'Accept (Yes)'}
                </Button>
            </div>
        </div>
    );
}
