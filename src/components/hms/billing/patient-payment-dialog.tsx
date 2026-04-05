'use client';

import { useState, useEffect, Suspense } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, DollarSign } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";




interface PatientPaymentDialogProps {
    patientId: string;
    patientName: string;
    onPaymentSuccess?: (invoiceData?: any) => void;
    onClose?: () => void;
    trigger?: React.ReactNode;
    fixedAmount?: number; // [NEW] Allow overriding balance for specific fee collection
    appointmentId?: string; // [RCM-CONTEXT] Link to appointment for better idempotency
    autoOpen?: boolean; // [AUTO] Automatically open the dialog on mount
    isRegistrationFee?: boolean; // [NEW] Explicit registration fee flag
}


export function PatientPaymentDialog({
    patientId,
    patientName,
    onPaymentSuccess,
    onClose,
    trigger,
    fixedAmount,
    appointmentId,
    autoOpen = false,
    isRegistrationFee = false
}: PatientPaymentDialogProps) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(autoOpen);

    // [STABILITY] Sync internal open state with parent prop (crucial for autoOpen triggers)
    useEffect(() => {
        if (autoOpen) setIsOpen(true);
    }, [autoOpen]);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open && onClose) onClose();
    };
    const [isLoading, setIsLoading] = useState(false);

    // Dependencies needed for CompactInvoiceEditor
    const [billableItems, setBillableItems] = useState<any[]>([]);
    const [taxConfig, setTaxConfig] = useState<any>({ defaultTax: null, taxRates: [] });
    const [uoms, setUoms] = useState<any[]>([]);
    const [patients, setPatients] = useState<any[]>([]); // Minimal necessary
    const [initialInvoice, setInitialInvoice] = useState<any>(null);

    // Fetch Dependencies when opened
    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            import('@/app/actions/billing').then(mod => {
                Promise.all([
                    mod.getBillableItems(),
                    mod.getTaxConfiguration(),
                    mod.getUoms(),
                    // [WORLD CLASS] Check for existing UNPAID registration invoice specifically
                    // If appointmentId is present, we prioritize that context
                    mod.getInitialInvoiceData(appointmentId || '').then((res: any) => (res.success && res.data) ? res : mod.getOpenRegistrationInvoice(patientId))
                ]).then(([itemsRes, taxRes, uomsRes, invRes]) => {
                    if (itemsRes.success) setBillableItems(itemsRes.data || []);
                    if (taxRes.success) setTaxConfig(taxRes.data || { defaultTax: null, taxRates: [] });
                    if (uomsRes.success) setUoms(uomsRes.data || []);

                    if ((invRes as any).success && (invRes as any).data) {
                        const inv = (invRes as any).data;
                        console.log(`[RCM] Resuming existing invoice: ${inv.invoice_number}`);
                        setInitialInvoice(inv);
                    }

                    // Mock patient object for the editor
                    setPatients([{ id: patientId, label: patientName }]);
                }).catch(err => {
                    console.error("Failed to load billing dependencies", err);
                    toast({
                        title: "Warning",
                        description: "Could not load some billing configurations. You can still proceed.",
                        variant: "destructive"
                    });
                }).finally(() => setIsLoading(false));
            });
        }
    }, [isOpen, patientId, patientName, appointmentId]);

    // Construct initial medicines/items based on fixedAmount (Registration Context)
    const initialMedicines = fixedAmount ? [{
        id: 'REG-FEE', // Pseudo-ID, will be matched by name
        name: 'Patient Registration Fee',
        price: fixedAmount,
        quantity: 1,
        type: 'service',
        description: 'Patient Registration Fee'
    }] : [];

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-lg shadow-emerald-200">
                        <DollarSign className="h-4 w-4 mr-2" />
                        Collect Payment
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
                className="max-w-[95vw] w-full h-[95vh] p-0 bg-transparent border-none shadow-none flex items-center justify-center z-[400] focus:outline-none"
            >
                <DialogTitle className="sr-only">Collect Payment for {patientName}</DialogTitle>
                <DialogDescription className="sr-only">Process insurance or cash payments using the hospital billing terminal.</DialogDescription>
                {isLoading ? (
                    <div className="bg-white p-8 rounded-3xl flex flex-col items-center gap-4 shadow-2xl">
                        <Loader2 className="h-12 w-12 text-emerald-600 animate-spin" />
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Loading Terminal...</p>
                    </div>
                ) : (
                <Suspense fallback={<div className="bg-white p-8 rounded-3xl flex flex-col items-center gap-4 shadow-2xl"><Loader2 className="h-12 w-12 text-emerald-600 animate-spin" /><p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Hydrating Terminal...</p></div>}>
                    <CompactInvoiceEditorWithNoSSR
                        patients={patients}
                        billableItems={billableItems}
                        uoms={uoms}
                        taxConfig={taxConfig}
                        initialPatientId={patientId}
                        appointmentId={appointmentId}
                        initialMedicines={initialMedicines}
                        initialInvoice={initialInvoice}
                        isRegistrationFee={isRegistrationFee || !!fixedAmount}
                        onClose={() => {
                            // [FIX] Call handleOpenChange so parent onClose is notified
                            handleOpenChange(false);
                        }}
                        onPaymentSuccess={(data) => {
                            onPaymentSuccess?.(data);
                        }}
                    />
                </Suspense>
                )}
            </DialogContent>
        </Dialog>
    );
}

// Wrapper for Dynamic Import
import dynamic from 'next/dynamic';
const CompactInvoiceEditorWithNoSSR = dynamic(
    () => import('@/components/billing/invoice-editor-compact').then(mod => mod.CompactInvoiceEditor),
    { ssr: false, loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div> }
);
