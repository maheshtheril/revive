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
}

export function PaymentVoucherForm({ onClose, className, onSuccess, headerActions, initialData }: PaymentVoucherFormProps) {
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
        <div className={cn("bg-[#fff9e6] dark:bg-slate-900 font-mono text-sm flex flex-col h-full overflow-hidden", className)}>
            <Toaster />

            {/* Header - Fixed Stick Top */}
            <div className="bg-teal-700 text-yellow-400 px-6 py-3 flex justify-between items-center shadow-md shrink-0 relative z-50">
                <div className="flex items-center gap-4">
                    {onClose && (
                        <Button variant="ghost" size="icon" onClick={onClose} className="text-yellow-400 hover:text-white hover:bg-teal-600">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    )}
                    <div>
                        <span className="font-bold text-xl tracking-wider block">Payment / Expense Voucher</span>
                        <span className="text-[10px] text-teal-200 font-bold uppercase tracking-widest">
                            {mode === 'GENERAL' ? 'General Expenses & Direct Payments' : 'Bill-Wise Settlement (Accounts Payable)'}
                        </span>
                    </div>
                </div>

                {/* Right Side: Mode Switcher + Custom Actions */}
                <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant={mode === 'GENERAL' ? 'secondary' : 'ghost'}
                            className={`font-bold ${mode === 'GENERAL' ? 'bg-yellow-400 text-teal-900 hover:bg-yellow-300' : 'text-teal-100 hover:text-white hover:bg-teal-600'}`}
                            onClick={() => setMode('GENERAL')}
                        >
                            General (F5)
                        </Button>
                        <Button
                            size="sm"
                            variant={mode === 'BILL_SETTLEMENT' ? 'secondary' : 'ghost'}
                            className={`font-bold ${mode === 'BILL_SETTLEMENT' ? 'bg-yellow-400 text-teal-900 hover:bg-yellow-300' : 'text-teal-100 hover:text-white hover:bg-teal-600'}`}
                            onClick={() => setMode('BILL_SETTLEMENT')}
                        >
                            Bill Pay (Adv)
                        </Button>
                    </div>
                    {/* Injected Header Actions (like Min/Max) */}
                    {headerActions && (
                        <div className="border-l border-teal-600 pl-4 ml-2">
                            {headerActions}
                        </div>
                    )}
                </div>
            </div>

            {/* Top Info Bar */}
            <div className="bg-[#fff9e6] dark:bg-slate-900 p-6 border-b border-teal-700/20 grid grid-cols-2 gap-8 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-teal-900 dark:text-teal-400 w-24">Voucher No:</span>
                    <span className="font-bold text-black dark:text-white">{voucherNo}</span>
                </div>
                <div className="flex items-center gap-2 justify-end">
                    <span className="font-bold text-teal-900 dark:text-teal-400">Date:</span>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="h-8 border-teal-700/30 bg-white text-teal-900 font-bold">
                                {format(form.watch("date"), "dd-MMM-yyyy")}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={form.watch("date")} onSelect={(d) => d && form.setValue("date", d)} initialFocus />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* Scrollable Content Area: flex-1 ensures it takes remaining space */}
            <div className="flex-1 overflow-y-auto p-8 bg-[#fff9e6] dark:bg-slate-950 min-h-0">
                <Form {...form}>
                    <form className="space-y-8 max-w-5xl mx-auto pb-6">

                        {/* Source Account (Common) */}
                        <div className="flex items-center gap-6 py-4 px-6 border border-teal-700/20 bg-teal-50/30 dark:bg-teal-900/10 rounded-xl mb-8 shadow-sm">
                            <div className="flex items-center gap-4 flex-1">
                                <span className="font-extrabold text-teal-900 dark:text-teal-300 w-48 text-right tracking-tight text-sm uppercase">Credit Account (Cash/Bank) :</span>
                                <div className="w-[450px]">
                                    <FormField
                                        control={form.control}
                                        name="journalId"
                                        render={({ field }) => (
                                            <SearchableSelect
                                                value={field.value}
                                                onChange={(val) => field.onChange(val || "")}
                                                options={journals.map(j => ({ id: j.id, label: j.name, subLabel: j.type.toUpperCase() }))}
                                                onSearch={async (q) => {
                                                    const res = await getJournals(['cash', 'bank']);
                                                    return res.success && res.data ? (res.data as any).filter((j: any) => j.name.toLowerCase().includes(q.toLowerCase())).map((j: any) => ({ id: j.id, label: j.name, subLabel: j.type.toUpperCase() })) : [];
                                                }}
                                                placeholder="Select Cash / Bank Account..."
                                                className="bg-white border-b-2 border-teal-700/20 rounded-none focus:ring-0 font-bold"
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        </div>

                        {mode === 'GENERAL' ? (
                            // --- GENERAL MODE ---
                            <div className="border border-teal-700/30 bg-white dark:bg-slate-900 shadow-sm animate-in fade-in duration-300">
                                {/* Grid Header */}
                                <div className="flex border-b border-teal-700/30 bg-teal-50 dark:bg-teal-900/20 font-bold text-teal-900 dark:text-teal-400">
                                    <div className="flex-1 p-3 border-r border-teal-700/30 text-center">Particulars (Expense / Liability)</div>
                                    <div className="w-48 p-3 text-right">Amount</div>
                                    <div className="w-12"></div>
                                </div>

                                {fields.map((field, index) => (
                                    <div key={field.id} className="flex border-b border-dashed border-slate-300 items-start">
                                        <div className="flex-1 p-2 border-r border-slate-300">
                                            <FormField
                                                control={form.control}
                                                name={`lines.${index}.categoryId`}
                                                render={({ field }) => (
                                                    <SearchableSelect
                                                        value={field.value}
                                                        onChange={(val) => field.onChange(val || "")}
                                                        onSearch={async (q) => {
                                                            const res = await getAccounts(q, ['Expense', 'Liability', 'Equity', 'Asset', 'Cost of Goods Sold']);
                                                            return res.success && res.data ? res.data.map((a: any) => ({ id: a.id, label: a.name, subLabel: a.type })) : [];
                                                        }}
                                                        options={accountOptions}
                                                        placeholder="Select Ledger..."
                                                        className="border-0 shadow-none bg-transparent hover:bg-teal-50 text-base h-10"
                                                    />
                                                )}
                                            />
                                        </div>
                                        <div className="w-48 p-2">
                                            <FormField
                                                control={form.control}
                                                name={`lines.${index}.amount`}
                                                render={({ field }) => (
                                                    <Input
                                                        type="number"
                                                        {...field}
                                                        value={(field.value as number) || ''}
                                                        className="text-right border-0 shadow-none bg-transparent h-10 font-bold text-base"
                                                        placeholder="0.00"
                                                    />
                                                )}
                                            />
                                        </div>
                                        <div className="w-12 flex items-center justify-center">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => remove(index)}
                                                disabled={fields.length === 1}
                                                className="h-8 w-8 text-slate-400 hover:text-red-500"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}

                                <div className="p-3 cursor-pointer hover:bg-teal-50 text-teal-700 text-xs font-bold border-t border-slate-100" onClick={() => append({ categoryId: "", amount: 0 })}>
                                    + Add Ledger
                                </div>
                            </div>
                        ) : (
                            // --- BILL SETTLEMENT MODE ---
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-teal-900 dark:text-teal-400 w-32 text-right">Select Vendor :</span>
                                    <div className="w-[400px]">
                                        <SearchableSelect
                                            value={selectedVendorId}
                                            onChange={handleVendorSelect}
                                            onSearch={async (q) => searchSuppliers(q)}
                                            placeholder="Search Supplier Name..."
                                            className="bg-white border-b-2 border-teal-700/20 rounded-none focus:ring-0"
                                        />
                                    </div>
                                </div>

                                {bills.length > 0 && (
                                    <div className="border border-teal-700/30 bg-white dark:bg-slate-900 p-0 shadow-sm">
                                        <table className="w-full text-left">
                                            <thead className="bg-teal-50 text-teal-900 font-bold border-b border-teal-700/30 text-xs uppercase">
                                                <tr>
                                                    <th className="p-3">Bill #</th>
                                                    <th className="p-3">Date</th>
                                                    <th className="p-3 text-right">Bill Amount</th>
                                                    <th className="p-3 text-right">Due Amount</th>
                                                    <th className="p-3 text-right bg-yellow-50">Payment Allocation</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-sm">
                                                {bills.map(bill => (
                                                    <tr key={bill.id} className="border-b border-dashed border-slate-200 hover:bg-slate-50">
                                                        <td className="p-3 font-medium">{bill.number}</td>
                                                        <td className="p-3 text-slate-500">{new Date(bill.date).toLocaleDateString()}</td>
                                                        <td className="p-3 text-right font-mono">{bill.total.toLocaleString()}</td>
                                                        <td className="p-3 text-right font-mono font-bold text-red-500">{bill.outstanding.toLocaleString()}</td>
                                                        <td className="p-3 text-right bg-yellow-50/30">
                                                            <Input
                                                                type="number"
                                                                value={allocations[bill.id] || ''}
                                                                onChange={(e) => handleAllocationChange(bill.id, e.target.value)}
                                                                className="text-right h-8 w-32 ml-auto bg-white border-slate-300 font-bold"
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
                                    <div className="text-center p-8 text-slate-400 italic">No outstanding bills found for this vendor.</div>
                                )}
                            </div>
                        )}

                        {/* Total & Narration */}
                        <div className="flex flex-col gap-6 pt-6">
                            <div className="flex justify-end gap-16 pr-16 text-xl font-bold text-teal-900 border-t border-teal-700 w-full pt-4">
                                <span>Total Payment</span>
                                <span>₹ {mode === 'GENERAL' ? generalTotal.toFixed(2) : totalAllocated.toLocaleString()}</span>
                            </div>

                            <div className="flex items-start gap-4 p-4 bg-teal-50/50 border border-teal-100 rounded-lg">
                                <span className="font-bold text-teal-900 w-32 mt-2 text-right">Narration :</span>
                                <FormField
                                    control={form.control}
                                    name="narration"
                                    render={({ field }) => (
                                        <Textarea
                                            {...field}
                                            className="bg-white border-teal-700/30 font-mono text-sm min-h-[80px] flex-1 max-w-2xl"
                                            placeholder="Enter transaction details..."
                                        />
                                    )}
                                />
                            </div>
                        </div>
                    </form>
                </Form>
            </div>

            {/* Sticky Footer */}
            <div className="p-4 bg-teal-700 flex justify-end gap-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] shrink-0 z-50">
                {onClose && (
                    <Button variant="ghost" className="text-teal-100 hover:bg-teal-800 hover:text-white" onClick={onClose}>
                        Quit (Esc)
                    </Button>
                )}
                <Button onClick={form.handleSubmit(onSubmit)} disabled={loading} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold h-10 px-8">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Accept (Yes)
                </Button>
            </div>
        </div>
    );
}
