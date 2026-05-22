'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { upsertPayment } from '@/app/actions/accounting/payments';
import { searchPatients, searchJournals } from '@/app/actions/accounting/helpers';
import { getAccounts } from '@/app/actions/accounting/chart-of-accounts';
import {
    ArrowLeft, Save, Loader2, Calendar, CreditCard, User,
    Receipt, FileText, CheckCircle2, AlertCircle
} from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

import { TallyPaymentForm } from '@/components/accounting/tally-voucher-form';

export default function NewReceiptPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [classicMode, setClassicMode] = useState(false);

    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [partnerId, setPartnerId] = useState<string | null>(null);
    const [partnerName, setPartnerName] = useState('');
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('cash');
    const [reference, setReference] = useState('');
    const [memo, setMemo] = useState('');

    const handleSavePayload = async (payload: any) => {
        setIsSubmitting(true);
        const res = await upsertPayment(payload);

        if (res.error) {
            toast({ title: "Failed to Save", description: res.error, variant: "destructive" });
            setIsSubmitting(false);
            return false;
        } else {
            toast({
                title: "Receipt Saved",
                description: `Successfully recorded receipt for ₹${payload.amount}`,
                className: "bg-emerald-900 border-emerald-800 text-white"
            });

            if (!classicMode) {
                // Small delay for user to see success
                setTimeout(() => router.push('/hms/accounting/receipts'), 500);
            }
            return true;
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!partnerId) {
            toast({ title: "Missing Payer", description: "Please select who the receipt is from.", variant: "destructive" });
            return;
        }
        if (!amount || Number(amount) <= 0) {
            toast({ title: "Invalid Amount", description: "Please enter a positive amount.", variant: "destructive" });
            return;
        }

        const payload: any = {
            type: 'inbound',
            partner_id: partnerId,
            amount: Number(amount),
            method,
            reference,
            date: new Date(date),
            memo
        };

        await handleSavePayload(payload);
    };

    if (classicMode) {
        return (
            <TallyPaymentForm
                type="receipt"
                onSave={handleSavePayload}
                onCancel={() => setClassicMode(false)}
                patientsSearch={searchPatients}
                journalsSearch={searchJournals}
                accountsSearch={async (q: string) => {
                    const res = await getAccounts(q);
                    return res.success ? res.data : [];
                }}
                currency="₹"
            />
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans selection:bg-emerald-500/30 relative overflow-hidden">
            <Toaster />

            {/* Ambient Background Effects */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

            {/* Header */}
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="border-b border-white/5 bg-neutral-900/50 backdrop-blur-xl sticky top-0 z-40"
            >
                <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="h-10 w-10 rounded-full hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-all active:scale-95"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                                New Receipt
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono uppercase tracking-wider border border-emerald-500/20">
                                    Inbound
                                </span>
                            </h1>
                        </div>
                    </div>

                    <button
                        onClick={() => setClassicMode(true)}
                        className="px-4 py-2 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all text-emerald-400"
                    >
                        Classic ERP Mode
                    </button>
                </div>
            </motion.div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-6 py-12 relative z-10">
                <motion.form
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    onSubmit={handleSubmit}
                    className="space-y-6"
                >

                    {/* Main Card */}
                    <div className="bg-neutral-900/40 border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-md relative group">
                        {/* Subtle Border Gradient Highlight */}
                        <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-br from-emerald-500/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative">

                            {/* Left Col: Core Details */}
                            <div className="space-y-8">
                                {/* Payer Selection */}
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                                        <div className="h-5 w-5 rounded bg-blue-500/20 flex items-center justify-center text-blue-400">
                                            <User className="h-3 w-3" />
                                        </div>
                                        Received From
                                    </label>
                                    <div className="relative">
                                        <SearchableSelect
                                            value={partnerId}
                                            onChange={(id, opt) => { setPartnerId(id); setPartnerName(opt?.label || ''); }}
                                            onSearch={async (q) => searchPatients(q)}
                                            placeholder="Find Patient..."
                                            className="w-full h-12 bg-black/20 border border-white/10 rounded-xl text-base hover:border-white/20 focus:border-emerald-500/50 transition-all"
                                            isDark
                                        />
                                    </div>
                                    <p className="text-xs text-neutral-600 pl-1">Search by Name, Phone, or Patient ID</p>
                                </div>

                                {/* Amount - HERO */}
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-2">
                                        <div className="h-5 w-5 rounded bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                            <Receipt className="h-3 w-3" />
                                        </div>
                                        Total Amount
                                    </label>
                                    <div className="relative group/amount">
                                        <div className="absolute inset-0 bg-emerald-500/5 blur-2xl rounded-xl opacity-0 group-focus-within/amount:opacity-100 transition-opacity duration-500" />
                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-500 font-medium text-4xl">₹</span>
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder="0"
                                            className="w-full pl-12 pr-4 py-6 bg-black/20 border-2 border-white/5 rounded-2xl text-5xl font-bold text-white placeholder:text-neutral-800 focus:outline-none focus:border-emerald-500/50 focus:bg-black/40 transition-all font-mono tracking-tight"
                                            autoFocus
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Right Col: Meta Data */}
                            <div className="space-y-6 pt-2">
                                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-6">

                                    {/* Date */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                                            <Calendar className="h-3.5 w-3.5" /> Receipt Date
                                        </label>
                                        <input
                                            type="date"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="w-full px-4 py-3 bg-neutral-950/50 border border-white/10 rounded-xl text-sm text-neutral-200 focus:outline-none focus:border-emerald-500/50 transition-colors [color-scheme:dark]"
                                        />
                                    </div>

                                    {/* Method */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                                            <CreditCard className="h-3.5 w-3.5" /> Payment Method
                                        </label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['cash', 'upi', 'card'].map((m) => (
                                                <button
                                                    key={m}
                                                    type="button"
                                                    onClick={() => setMethod(m)}
                                                    className={cn(
                                                        "px-3 py-2 rounded-lg text-xs font-medium border transition-all capitalize",
                                                        method === m
                                                            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                                                            : "bg-transparent border-white/10 text-neutral-400 hover:bg-white/5"
                                                    )}
                                                >
                                                    {m}
                                                </button>
                                            ))}
                                        </div>
                                        {/* Fallback Select for others */}
                                        <select
                                            value={method}
                                            onChange={(e) => setMethod(e.target.value)}
                                            className="mt-2 w-full px-4 py-2.5 bg-neutral-950/50 border border-white/10 rounded-xl text-sm text-neutral-200 focus:outline-none focus:border-emerald-500/50 transition-colors appearance-none"
                                        >
                                            <option value="cash">Cash</option>
                                            <option value="bank_transfer">Bank Transfer</option>
                                            <option value="upi">UPI</option>
                                            <option value="card">Card</option>
                                            <option value="cheque">Cheque</option>
                                        </select>
                                    </div>

                                    {/* Reference */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Reference / Transaction ID</label>
                                        <input
                                            type="text"
                                            value={reference}
                                            onChange={(e) => setReference(e.target.value)}
                                            placeholder="e.g. UPI-998877"
                                            className="w-full px-4 py-3 bg-neutral-950/50 border border-white/10 rounded-xl text-sm text-neutral-200 focus:outline-none focus:border-emerald-500/50 transition-colors placeholder:text-neutral-700 font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Section: Memo */}
                        <div className="mt-8 pt-8 border-t border-white/5">
                            <div className="space-y-3">
                                <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                                    <FileText className="h-3.5 w-3.5" /> Memo / Notes
                                </label>
                                <textarea
                                    value={memo}
                                    onChange={(e) => setMemo(e.target.value)}
                                    placeholder="Add any internal notes about this receipt..."
                                    rows={2}
                                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-sm text-neutral-200 focus:outline-none focus:border-emerald-500/50 transition-colors placeholder:text-neutral-700 resize-none"
                                />
                            </div>
                        </div>

                    </div>

                    {/* Actions */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="flex items-center justify-between pt-4"
                    >
                        <div className="flex items-center gap-2 text-xs text-neutral-500">
                            <AlertCircle className="h-4 w-4" />
                            <span>This receipt will be saved as <strong>Draft</strong> initially.</span>
                        </div>

                        <div className="flex gap-4">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="px-6 py-3 rounded-xl text-sm font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition-all"
                            >
                                Discard
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={cn(
                                    "px-10 py-3 rounded-xl text-white text-sm font-bold shadow-xl transition-all flex items-center gap-2",
                                    isSubmitting
                                        ? "bg-neutral-800 cursor-not-allowed text-neutral-500"
                                        : "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-emerald-900/40 hover:shadow-emerald-900/60 hover:scale-105 active:scale-95"
                                )}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4" />
                                        Save Receipt
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>

                </motion.form>
            </div>
        </div>
    );
}
