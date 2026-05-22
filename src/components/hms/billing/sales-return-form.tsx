'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { searchPatients } from '@/app/actions/patients';
import { getInvoicesByPatient, getInvoice } from '@/app/actions/billing';
import { createSalesReturn } from '@/app/actions/returns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, RotateCcw, User, FileText, CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from '@/components/ui/searchable-select';

export default function SalesReturnForm() {
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Patient, 2: Invoice, 3: Items

    const [patient, setPatient] = useState<any>(null);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
    const [returnItems, setReturnItems] = useState<any[]>([]);
    const [reason, setReason] = useState('');
    const [refundMethod, setRefundMethod] = useState<'credit_note' | 'cash'>('credit_note');

    // Step 1: Select Patient
    const handlePatientSelect = async (pId: string) => {
        setIsLoading(true);
        try {
            // In a real app, searchPatients returns a list. Here we assume we have a way to get one.
            // For now, let's just set the ID and move on to fetching invoices.
            const invs = await getInvoicesByPatient(pId) as any;
            if (invs.success) {
                setInvoices(invs.data);
                setPatient({ id: pId }); // Simplified
                setStep(2);
            } else {
                toast({ title: "Error", description: "Failed to load patient invoices", variant: "destructive" });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    // Step 2: Select Invoice
    const handleInvoiceSelect = async (invId: string) => {
        setIsLoading(true);
        try {
            const res = await getInvoice(invId) as any;
            if (res) {
                setSelectedInvoice(res);
                setReturnItems(res.hms_invoice_lines.map((l: any) => ({
                    invoiceLineId: l.id,
                    productId: l.product_id,
                    description: l.hms_product?.name || l.description || 'Item',
                    soldQty: Number(l.quantity),
                    returnQty: 0,
                    unitPrice: Number(l.unit_price)
                })));
                setStep(3);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleQtyChange = (idx: number, qty: number) => {
        const newItems = [...returnItems];
        const soldQty = newItems[idx].soldQty;
        newItems[idx].returnQty = Math.min(Math.max(0, qty), soldQty);
        setItems(newItems);
    };

    const [items, setItems] = useState<any[]>([]);
    useEffect(() => {
        if (returnItems.length > 0) setItems(returnItems);
    }, [returnItems]);

    const totalRefund = items.reduce((acc, i) => acc + (i.returnQty * i.unitPrice), 0);

    const handleSubmit = async () => {
        const itemsToReturn = items.filter(i => i.returnQty > 0);
        if (itemsToReturn.length === 0) {
            toast({ title: "Validation Error", description: "Please enter at least one item to return.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            const res = await createSalesReturn({
                invoiceId: selectedInvoice.id,
                patientId: selectedInvoice.patient_id || '',
                reason,
                refundMethod,
                items: itemsToReturn
            });

            if (res.success) {
                toast({ title: "Success", description: "Sales return processed and stock updated." });
                router.push(`/hms/billing/returns/${(res.data as any).id}`);
            } else {
                toast({ title: "Error", description: res.error, variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "Failed to process return", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => step > 1 ? setStep(step - 1) : router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">New Sales Return</h1>
                </div>
                <div className="flex items-center gap-2">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className={`h-2 w-12 rounded-full transition-all duration-500 ${step >= s ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                    ))}
                </div>
            </div>

            {step === 1 && (
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6">
                    <div className="flex items-center gap-3 text-emerald-600 mb-2">
                        <User className="h-6 w-6" />
                        <h2 className="text-xl font-bold">Select Patient</h2>
                    </div>
                    <p className="text-slate-500">Search for the patient who is returning the items.</p>
                    <div className="max-w-md">
                         <SearchableSelect
                            placeholder="Type patient name or ID..."
                            onChange={(id) => id && handlePatientSelect(id)}
                            onSearch={async (q) => {
                                const res = await searchPatients(q);
                                return res.map(p => ({ id: p.id, label: `${p.first_name} ${p.last_name} (${p.patient_number})` }));
                            }}
                        />
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center gap-3 text-emerald-600 mb-2">
                        <FileText className="h-6 w-6" />
                        <h2 className="text-xl font-bold">Select Original Invoice</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {invoices.length > 0 ? invoices.map((inv) => (
                            <button
                                key={inv.id}
                                onClick={() => handleInvoiceSelect(inv.id)}
                                className="flex flex-col p-6 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-emerald-300 hover:shadow-lg transition-all text-left group"
                            >
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400 group-hover:text-emerald-500 transition-colors">{inv.invoice_number}</span>
                                <span className="text-lg font-bold text-slate-900 mt-1">₹{Number(inv.total).toFixed(2)}</span>
                                <span className="text-sm text-slate-500 mt-2">{new Date(inv.created_at).toLocaleDateString()}</span>
                            </button>
                        )) : (
                            <div className="col-span-2 p-12 text-center border-2 border-dashed border-slate-200 rounded-3xl">
                                <p className="text-slate-400">No invoices found for this patient.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in zoom-in-95 duration-300">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                    <RotateCcw className="h-5 w-5 text-emerald-500" /> Items Entry
                                </h3>
                                <span className="text-xs font-mono bg-slate-200 px-2 py-1 rounded">{selectedInvoice?.invoice_number}</span>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/50 border-b border-slate-100">
                                        <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            <th className="px-6 py-4">Item Description</th>
                                            <th className="px-6 py-4 text-center">Sold</th>
                                            <th className="px-6 py-4 text-center w-32">Return Qty</th>
                                            <th className="px-6 py-4 text-right">Refund</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {items.map((item, idx) => (
                                            <tr key={idx} className={item.returnQty > 0 ? 'bg-emerald-50/30' : ''}>
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-slate-900">{item.description}</p>
                                                    <p className="text-[10px] font-mono text-slate-400">₹{item.unitPrice.toFixed(2)} / unit</p>
                                                </td>
                                                <td className="px-6 py-4 text-center font-mono text-slate-600">{item.soldQty}</td>
                                                <td className="px-6 py-4">
                                                    <Input
                                                        type="number"
                                                        value={item.returnQty || ''}
                                                        onChange={(e) => handleQtyChange(idx, parseInt(e.target.value) || 0)}
                                                        className="h-10 text-center font-bold border-slate-200 rounded-xl focus:ring-emerald-500"
                                                        placeholder="0"
                                                    />
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-slate-900">
                                                    ₹{(item.returnQty * item.unitPrice).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-2xl space-y-6 relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-8 opacity-10">
                                <RotateCcw className="h-24 w-24" />
                            </div>
                            
                            <div className="space-y-2">
                                <Label className="text-slate-400 text-xs font-black uppercase tracking-widest">Total Refund</Label>
                                <div className="text-5xl font-black tracking-tighter">₹{totalRefund.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-white/10">
                                <div className="space-y-2">
                                    <Label className="text-white/60 text-xs font-bold uppercase">Return Reason</Label>
                                    <Input 
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        placeholder="e.g. Expired, Damaged, Wrong Item..."
                                        className="bg-white/10 border-white/20 text-white placeholder:text-white/30 h-12 rounded-xl"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-white/60 text-xs font-bold uppercase">Refund Method</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setRefundMethod('credit_note')}
                                            className={`py-3 rounded-xl text-sm font-bold transition-all ${refundMethod === 'credit_note' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                                        >
                                            Credit Note
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRefundMethod('cash')}
                                            className={`py-3 rounded-xl text-sm font-bold transition-all ${refundMethod === 'cash' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                                        >
                                            Cash Refund
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <Button 
                                onClick={handleSubmit}
                                disabled={isLoading || totalRefund === 0}
                                className="w-full h-14 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-lg rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                            >
                                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Post Return & Restock"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
