'use client'

import React from "react"
import { Button } from "@/components/ui/button"
import { Printer, Eye } from "lucide-react"

interface OpSlipDialogProps {
    appointment: any
    trigger?: React.ReactNode
    hospitalInfo?: any
    initialTab?: 'voucher' | 'invoice'
    directPrint?: boolean
    defaultPrintMode?: 'standard' | 'label'
}

/**
 * CLINICAL PRINT WRAPPER
 * Printer Icon = Direct OS print dialog (raw PDF, autoPrint embedded by jsPDF)
 * Eye Icon     = Full preview page
 */
export function OpSlipDialog({
    appointment: initialApt,
    trigger,
    initialTab = 'voucher',
    directPrint = false,
    defaultPrintMode = 'standard'
}: OpSlipDialogProps) {

    const isInvoice = initialTab === 'invoice';
    const docType = isInvoice ? 'sale_bill' : 'appointment';
    const docId = isInvoice
        ? (initialApt?.invoice_id || initialApt?.hms_invoice?.[0]?.id || initialApt?.id)
        : initialApt?.id;

    // PRINTER: opens raw PDF — jsPDF autoPrint triggers OS print dialog immediately
    const handleDirectPrint = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(`/api/print/${docType}/${docId}?autoPrint=true`, '_blank');
    };

    // EYE: opens full preview page with controls
    const handlePreview = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const printId = isInvoice ? docId : initialApt?.id;
        const searchParams = new URLSearchParams({ type: docType, mode: 'standard' });
        window.open(`/hms/billing/${printId}/print?${searchParams.toString()}`, '_blank');
    };

    return (
        <div
            onClick={directPrint ? handleDirectPrint : handlePreview}
            className="cursor-pointer flex items-center"
        >
            {trigger || (
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${directPrint ? 'text-indigo-500 hover:bg-indigo-50' : 'text-slate-400 hover:bg-slate-100'}`}
                    title={directPrint ? "Print (OS Dialog)" : "Preview"}
                >
                    {directPrint ? <Printer className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
            )}
        </div>
    );
}
