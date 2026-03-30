'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
    CreditCard,
    Send,
    Printer,
    Download,
    Loader2,
    CheckCircle2,
    XCircle,
    Mail,
    MessageCircle
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import { recordPayment, updateInvoiceStatus, shareInvoiceWhatsapp } from '@/app/actions/billing';
import { useToast } from '@/components/ui/use-toast';
import { generateInvoicePDFBase64 } from '@/lib/utils/pdf-generator';

interface InvoiceControlPanelProps {
    invoiceId: string;
    currentStatus: string;
    outstandingAmount: number;
    patientEmail?: string | null;
    invoiceData?: any;
    autoOpenPayment?: boolean;
}

export function InvoiceControlPanel({
    invoiceId,
    currentStatus,
    outstandingAmount,
    patientEmail,
    invoiceData,
    autoOpenPayment = false
}: InvoiceControlPanelProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(autoOpenPayment && currentStatus === 'posted');

    // Payment State
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [paymentReference, setPaymentReference] = useState('');
    const [paymentAmount, setPaymentAmount] = useState(outstandingAmount);

    const router = useRouter();
    const { toast } = useToast();

    // Reset payment form when modal opens
    const openPaymentModal = () => {
        setPaymentMethod('cash');
        setPaymentReference('');
        setPaymentAmount(outstandingAmount);
        setIsPaymentModalOpen(true);
    };

    async function handleStatusChange(newStatus: 'posted' | 'paid') {
        setIsLoading(true);
        try {
            const res = await updateInvoiceStatus(invoiceId, newStatus);
            if (res.success) {
                toast({
                    title: "Status Updated",
                    description: `Invoice marked as ${newStatus}`,
                    variant: "default"
                });
                router.refresh();
            } else {
                toast({
                    title: "Action Failed",
                    description: res.error || "Could not update status",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }

    async function handlePaymentConfirm() {
        setIsLoading(true);
        try {
            const res = await recordPayment(invoiceId, {
                amount: Number(paymentAmount),
                method: paymentMethod,
                reference: paymentReference
            }, 'posted');

            if (res.success) {
                toast({
                    title: "Payment Recorded",
                    description: `Received ₹${paymentAmount} via ${paymentMethod.toUpperCase()}`,
                    variant: "default"
                });
                router.refresh();
                setIsPaymentModalOpen(false);
            } else {
                toast({
                    title: "Payment Failed",
                    description: res.error || "Could not record payment",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Transaction failed.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }

    const base64ToBlob = (base64: string, type: string) => {
        const binStr = atob(base64);
        const len = binStr.length;
        const arr = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            arr[i] = binStr.charCodeAt(i);
        }
        return new Blob([arr], { type });
    };

    const handlePrintPdf = async (mode?: 'standard' | 'letterhead') => {
        setIsLoading(true);
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        const searchParams = new URLSearchParams({ autoPrint: 'true' });
        if (mode) searchParams.append('mode', mode);
        
        iframe.src = `/api/billing/${invoiceId}/pdf?${searchParams.toString()}`;
        document.body.appendChild(iframe);
        
        setTimeout(() => {
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
            }
            setIsLoading(false);
        }, 10000); 
    };

    const handleDownloadPdf = async () => {
        setIsLoading(true);
        try {
            const b64 = await generateInvoicePDFBase64(invoiceData);
            const blob = base64ToBlob(b64, 'application/pdf');
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Invoice-${invoiceData?.invoice_number || invoiceId}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error(e);
            toast({ title: "PDF Generation Failed", description: "Could not generate PDF download.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    async function handleWhatsappShare() {
        setIsLoading(true);
        try {
            const res = await shareInvoiceWhatsapp(invoiceId) as any;
            if (res && res.success) {
                toast({
                    title: "WhatsApp",
                    description: res.message || "Invoice sent to patient.",
                });
            } else {
                toast({
                    title: "Share Failed",
                    description: (res && res.error) || "Could not send WhatsApp",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error(error);
            toast({
                title: "Error",
                description: "Failed to connect to WhatsApp service.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    }

    const balanceDifference = paymentAmount - outstandingAmount;

    return (
        <div className="flex flex-wrap items-center gap-3">
            {/* POST ACTION (If Draft) */}
            {currentStatus === 'draft' && (
                <Button
                    onClick={() => handleStatusChange('posted')}
                    disabled={isLoading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Post Invoice
                </Button>
            )}

            {/* COLLECT PAYMENT (If Posted or Draft) */}
            {['posted', 'draft'].includes(currentStatus) && (
                <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={openPaymentModal}>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Collect Payment
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Record Payment</DialogTitle>
                            <DialogDescription>
                                Enter the amount received. You can record partial payments (Credit) or advance payments.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex flex-col gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 mt-2">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Received Amount</label>
                                <div className="flex items-center gap-2 border-b border-slate-300 pb-1">
                                    <span className="text-2xl font-bold font-mono text-slate-400">₹</span>
                                    <input
                                        type="number"
                                        min="1"
                                        autoFocus
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(Number(e.target.value))}
                                        className="text-3xl font-bold font-mono text-slate-900 bg-transparent outline-none w-full placeholder:text-slate-300"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-between items-center text-xs font-medium pt-2 border-t border-slate-200">
                                <span className="text-slate-500">Invoice Due: <span className="font-bold text-slate-700">₹{outstandingAmount.toFixed(2)}</span></span>
                                {balanceDifference < 0 ? (
                                    <span className="text-orange-600 font-bold">Remaining Due: ₹{Math.abs(balanceDifference).toFixed(2)}</span>
                                ) : (
                                    <span className="text-emerald-600 font-bold">Change / Advance: ₹{balanceDifference.toFixed(2)}</span>
                                )}
                            </div>

                            {balanceDifference > 0 && (
                                <div className="bg-emerald-50 text-emerald-700 text-[10px] p-2 rounded border border-emerald-100 flex items-center gap-2">
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>Excess amount of ₹{balanceDifference.toFixed(2)} will be recorded as <strong>Advance Payment</strong>.</span>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {['cash', 'card', 'upi'].map((method) => (
                                <button
                                    key={method}
                                    onClick={() => setPaymentMethod(method)}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${paymentMethod === method
                                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                        : 'border-slate-100 hover:border-slate-200 text-slate-500 hover:bg-slate-50'
                                        }`}
                                >
                                    <div className="font-bold uppercase text-xs tracking-wider">{method}</div>
                                </button>
                            ))}
                        </div>

                        {(paymentMethod === 'card' || paymentMethod === 'upi') && (
                            <div className="space-y-2 animate-in slide-in-from-top-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Transaction Ref / Last 4 Digits</label>
                                <input
                                    type="text"
                                    value={paymentReference}
                                    onChange={(e) => setPaymentReference(e.target.value)}
                                    placeholder={paymentMethod === 'card' ? "e.g. 1234" : "e.g. UPI Ref ID"}
                                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                                />
                            </div>
                        )}
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)}>Cancel</Button>
                            <Button
                                onClick={handlePaymentConfirm}
                                disabled={isLoading}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200"
                            >
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                Confirm Receipt
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )
            }

            {/* PRINT & SHARE ACTIONS - Always Available */}
            {/* PRINT CHOICE DIALOG */}
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="outline" disabled={isLoading} className="border-indigo-200 hover:border-indigo-400">
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                        Print A4 Bill
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Printer className="h-5 w-5 text-indigo-600" />
                            Print Options
                        </DialogTitle>
                        <DialogDescription className="text-xs font-bold uppercase tracking-tight py-2 border-b border-slate-100">
                            Choose Layout for A4 Invoice
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-3 py-4">
                        <Button 
                            variant="outline" 
                            className="h-20 flex flex-col items-center justify-center gap-1 border-2 hover:border-indigo-500 hover:bg-slate-50 transition-all group"
                            onClick={() => handlePrintPdf('standard')}
                        >
                            <span className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 group-hover:text-indigo-600">Option 1</span>
                            <span className="font-bold text-slate-800 italic">Standard Full Print</span>
                        </Button>
                        <Button 
                            variant="outline" 
                            className="h-20 flex flex-col items-center justify-center gap-1 border-2 hover:border-indigo-500 hover:bg-slate-50 transition-all group"
                            onClick={() => handlePrintPdf('letterhead')}
                        >
                            <span className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 group-hover:text-indigo-600">Option 2</span>
                            <span className="font-bold text-slate-800 italic">Preprinted Letterhead</span>
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Button
                variant="outline"
                onClick={handleWhatsappShare}
                disabled={isLoading}
                className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
            >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
                WhatsApp
            </Button>
        </div >
    );
}
