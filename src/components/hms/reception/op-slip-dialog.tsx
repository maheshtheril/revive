'use client'

import { useState, useEffect } from "react"
import { getHMSSettings } from "@/app/actions/settings"
import { getAppointmentBillingStatus } from "@/app/actions/billing"
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogTrigger, DialogFooter,
    DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
    Printer, FileText, Layout, X, Check,
    CreditCard, Receipt, Fingerprint, Activity,
    Stethoscope, Clock, ShieldCheck, Zap,
    ChevronRight, Loader2
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
interface OpSlipDialogProps {
    appointment: any
    trigger?: React.ReactNode
    defaultPrintMode?: 'standard' | 'letterhead' | 'thermal' | 'label'
    hospitalInfo?: any
    initialTab?: 'voucher' | 'invoice'
    autoOpen?: boolean
}

export function OpSlipDialog({
    appointment: initialApt,
    trigger,
    defaultPrintMode = 'standard',
    hospitalInfo,
    initialTab = 'voucher',
    autoOpen = false
}: OpSlipDialogProps) {
    const [isOpen, setIsOpen] = useState(autoOpen)
    const [printMode, setPrintMode] = useState<'standard' | 'letterhead' | 'thermal' | 'label'>(defaultPrintMode)
    const [hmsSettings, setHmsSettings] = useState<any>(null)
    const [billingData, setBillingData] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<'voucher' | 'invoice'>(initialTab)

    // [DATA NORMALIZATION] Core data extraction for both UI and Printing
    const activeApt = billingData?.appointment || initialApt;
    const patient = activeApt.hms_patient || activeApt.patient;
    const clinician = activeApt.hms_clinician || activeApt.clinician;

    // [ELITE SYNC] Fetch real-time billing and setting data when opened
    useEffect(() => {
        if (!isOpen) return;

        setIsLoading(true);
        Promise.all([
            getHMSSettings(),
            getAppointmentBillingStatus(initialApt.id)
        ]).then(([settingsRes, billingRes]) => {
            if (settingsRes.success) {
                setHmsSettings(settingsRes.settings)
                if (settingsRes.settings?.opSlipPreprintedLetterhead && defaultPrintMode === 'standard') {
                    setPrintMode('letterhead')
                }
            }
            if (billingRes.success) {
                setBillingData(billingRes.data)
                // Auto-switch to invoice if it's already paid and that's likely what they want
                if (billingRes.data.status === 'paid') {
                    setActiveTab('invoice')
                }
            }
        }).catch(err => {
            console.error("Print Sync Error", err);
        }).finally(() => {
            setIsLoading(false);
        })
    }, [isOpen, initialApt.id, defaultPrintMode])

    const handlePrint = (modeOverride?: string) => {
        const mode = modeOverride || printMode;
        const printWindow = window.open('', '_blank')
        if (!printWindow) return

        const patientName = `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim() || 'Patient'
        const doctorName = `Dr. ${clinician?.first_name || ''} ${clinician?.last_name || ''}`.trim() || 'Consultant'
        const calculateAge = (dobString?: string) => {
            if (!dobString) return 'N/A';
            const dob = new Date(dobString);
            const today = new Date();
            let age = today.getFullYear() - dob.getFullYear();
            const m = today.getMonth() - dob.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
            return age;
        };

        const patientAge = patient?.age || calculateAge(patient?.dob);
        const dateRaw = activeApt.start_time || activeApt.starts_at || activeApt.date
        const date = dateRaw ? new Date(dateRaw).toLocaleDateString() : 'Today'
        const time = dateRaw ? new Date(dateRaw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'
        const tokenNumber = activeApt.token_number || activeApt.id?.split('-')[0].toUpperCase() || 'N/A'

        let html = ''

        if (activeTab === 'voucher') {
            // [VOUCHER MODES]
            if (mode === 'label') {
                html = `
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <title>Label - ${patientName}</title>
                            <style>
                                @page { margin: 0; size: 50mm 25mm; }
                                body { font-family: 'Arial', sans-serif; width: 46mm; margin: 0 auto; color: black; font-size: 8pt; }
                                .name { font-weight: 900; font-size: 10pt; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                                .id { font-weight: bold; border-bottom: 1px solid black; padding-bottom: 2px; margin-bottom: 2px; }
                                .meta { font-size: 7pt; display: flex; justify-content: space-between; }
                            </style>
                        </head>
                        <body>
                            <div class="name">${patientName}</div>
                            <div class="id">ID: ${patient?.patient_number || ''}</div>
                            <div class="meta">
                                <span>${patient?.gender || 'N/A'} | ${patient?.age || ''}</span>
                                <span>${date}</span>
                            </div>
                            <div class="meta" style="margin-top: 2px;">
                                <span>T-ID: #${tokenNumber}</span>
                                <span style="font-weight: bold;">${doctorName.slice(0, 15)}</span>
                            </div>
                            <script>window.onload = () => { window.print(); window.close(); };</script>
                        </body>
                    </html>
                `
            } else if (mode === 'thermal') {
                html = `
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <title>OP Slip - ${patientName}</title>
                            <style>
                                @page { margin: 0; size: 80mm 200mm; }
                                body { font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; padding: 5mm; color: black; font-size: 9pt; }
                                .center { text-align: center; }
                                .bold { font-weight: 900; }
                                .line { border-top: 1px dashed black; margin: 5mm 0; }
                                .token { font-size: 24pt; font-weight: 900; margin: 2mm 0; }
                                .row { display: flex; justify-content: space-between; margin-bottom: 1mm; }
                            </style>
                        </head>
                        <body>
                            <div class="center bold" style="font-size: 14pt;">${hospitalInfo?.name || 'MEDICAL CENTER'}</div>
                            <div class="center" style="font-size: 8pt;">Outpatient Department</div>
                            <div class="line"></div>
                            <div class="center" font-size: 8pt;">OP TOKEN</div>
                            <div class="center token">#${tokenNumber}</div>
                            <div class="line"></div>
                            <div class="row"><span>Patient:</span><span class="bold">${patientName}</span></div>
                            <div class="row"><span>Doctor:</span><span class="bold">${doctorName}</span></div>
                            <div class="row"><span>Time:</span><span class="bold">${date} ${time}</span></div>
                            <div class="line"></div>
                            <div class="center" style="font-size: 7pt;">V10-THERMAL-SLIP</div>
                            <script>window.onload = () => { window.print(); window.close(); };</script>
                        </body>
                    </html>
                `
            } else {
                // A4 Standard / Letterhead
                const showHeader = mode !== 'letterhead';
                const headerHeight = (hmsSettings?.opSlipHeaderHeight || '4.5') + 'cm';

                const showVitals = hmsSettings?.opSlipShowVitals !== false;
                const vitalsOnLeft = hmsSettings?.opSlipVitalsPosition === 'left';
                const vitalsList = hmsSettings?.opSlipVitalsList || ['BP', 'Temp', 'SPO2', 'Pulse'];
                const rxStyle = hmsSettings?.opSlipRxStyle || 'centered_small';

                html = `
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <title>OP Slip - ${patientName}</title>
                            <style>
                                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
                                @page { size: A4; margin: 0; }
                                body { font-family: 'Outfit', sans-serif; margin: 0; padding: 0; }
                                .page { width: 210mm; height: 297mm; padding: ${showHeader ? '15mm' : `${headerHeight} 15mm 15mm 15mm`}; position: relative; box-sizing: border-box; }
                                .header { display: ${showHeader ? 'flex' : 'none'}; justify-content: center; align-items: center; border-bottom: 2px solid #1e293b; padding-bottom: 20px; margin-bottom: 20px; }
                                .h-name { font-size: 24pt; font-weight: 900; color: #1e3a8a; }
                                .strip { display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; }
                                .grid-container { display: grid; grid-template-columns: ${!showVitals ? '1fr' : (vitalsOnLeft ? '60mm 1fr' : '1fr 60mm')}; gap: 20px; }
                                .rx-box { height: 18cm; ${vitalsOnLeft ? 'border-left: 1px dashed #e2e8f0; padding-left: 20px;' : 'border-right: 1px dashed #e2e8f0;'} position: relative; }
                                .rx-mark { 
                                    font-weight: 900; 
                                    position: absolute; 
                                    color: #000;
                                    opacity: 0.05;
                                    ${rxStyle === 'centered_small'
                        ? 'font-size: 40pt; top: 50%; left: 50%; transform: translate(-50%, -50%);'
                        : 'font-size: 60pt; top: 0; left: 0;'
                    } 
                                }
                                .vitals-box { display: ${showVitals ? 'block' : 'none'}; }
                                .vital-line { border-bottom: 1px dotted #e2e8f0; height: 32px; margin-bottom: 10px; font-size: 9pt; font-weight: 900; color: #1e293b; display: flex; align-items: end; padding-bottom: 4px; }
                                .vital-label { color: #94a3b8; font-size: 8pt; margin-right: 5px; }
                                footer { position: absolute; bottom: 15mm; left: 15mm; right: 15mm; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 8pt; }
                            </style>
                        </head>
                        <body>
                            <div class="page">
                                <div class="header">
                                    <div style="text-align: center;">
                                        <div class="h-name">${hospitalInfo?.name || 'ZIONA MEDICAL'}</div>
                                        <div style="font-size: 10pt; color: #64748b;">${hospitalInfo?.metadata?.address || ''}</div>
                                    </div>
                                </div>
                                <div class="strip">
                                    <div>
                                        <div style="font-size: 16pt; font-weight: 900; color: #0f172a;">${patientName}</div>
                                        <div style="font-size: 10pt; color: #475569;">${patient?.gender || 'N/A'} / ${patientAge} Y | ID: ${patient?.patient_number || 'N/A'}</div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 14pt; font-weight: 900;">TOKEN: #${tokenNumber}</div>
                                        <div style="font-size: 10pt; color: #475569;">${date} | ${doctorName}</div>
                                    </div>
                                </div>
                                <div class="grid-container">
                                    ${vitalsOnLeft && showVitals ? `
                                        <div class="vitals-box">
                                            <div style="font-weight: 900; font-size: 8pt; color: #475569; margin-bottom: 15px; letter-spacing: 0.1em;">TRIAGE/VITALS</div>
                                            ${vitalsList.map((v: string) => `<div class="vital-line"><span class="vital-label">${v}:</span></div>`).join('')}
                                        </div>
                                    ` : ''}
                                    
                                    <div class="rx-box" style="${!showVitals ? 'border: none;' : ''}">
                                        <div class="rx-mark">℞</div>
                                    </div>

                                    ${!vitalsOnLeft && showVitals ? `
                                        <div class="vitals-box">
                                            <div style="font-weight: 900; font-size: 8pt; color: #475569; margin-bottom: 15px; letter-spacing: 0.1em;">TRIAGE/VITALS</div>
                                            ${vitalsList.map((v: string) => `<div class="vital-line"><span class="vital-label">${v}:</span></div>`).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                                <footer>ZIONA PRO PRINT PROTOCOL V5.0</footer>
                            </div>
                            <script>window.onload = () => { window.print(); window.close(); };</script>
                        </body>
                    </html>
                `
            }
        } else {
            // [INVOICE MODES]
            const inv = billingData?.invoice;
            if (!inv) {
                printWindow.close()
                toast({
                    title: "Bill Not Found",
                    description: "Financial registration is incomplete. Cannot print invoice yet.",
                    variant: "destructive"
                })
                return;
            }

            const lines = inv.hms_invoice_lines || [];
            const total = Number(inv.total).toFixed(2);

            const showHeader = mode !== 'letterhead';
            const headerHeight = (hmsSettings?.billHeaderHeight || '4.5') + 'cm';

            html = `
                <!DOCTYPE html>
                <html>
                    <head>
                        <title>Bill - ${inv.invoice_number}</title>
                        <style>
                            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
                            @page { size: A4; margin: 0; }
                            body { font-family: 'Outfit', sans-serif; margin: 0; padding: 0; }
                            .page { width: 210mm; min-height: 297mm; padding: ${showHeader ? '20mm' : `${headerHeight} 20mm 20mm 20mm`}; box-sizing: border-box; }
                            .h-name { font-size: 20pt; font-weight: 900; color: #1e3a8a; }
                            .inv-head { display: ${showHeader ? 'flex' : 'none'}; justify-content: space-between; border-bottom: 3px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 30px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th { text-align: left; background: #f8fafc; padding: 12px; font-weight: 900; font-size: 9pt; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
                            td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 10pt; }
                            .total-row { background: #f8fafc; font-weight: 900; font-size: 12pt; }
                        </style>
                    </head>
                    <body>
                        <div class="page">
                            <div class="inv-head">
                                <div>
                                    <div class="h-name">${hospitalInfo?.name || 'ZIONA MEDICAL'}</div>
                                    <div style="font-size: 9pt; color: #64748b;">${hospitalInfo?.metadata?.address || ''}</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 18pt; font-weight: 900; color: #0f172a;">BILL INVOICE</div>
                                    <div style="font-size: 10pt; font-weight: 700;"># ${inv.invoice_number}</div>
                                    <div style="font-size: 9pt;">Date: ${new Date(inv.created_at).toLocaleDateString()}</div>
                                </div>
                            </div>
                            <div style="margin-bottom: 30px;">
                                <div style="font-weight: 900; font-size: 8pt; color: #94a3b8; margin-bottom: 5px;">BILLING TO:</div>
                                <div style="font-size: 14pt; font-weight: 900;">${patientName}</div>
                                <div style="font-size: 10pt;">ID: ${patient?.patient_number}</div>
                            </div>
                            <table>
                                <thead>
                                    <tr><th>Service / Item</th><th>Qty</th><th>Unit Price</th><th style="text-align: right;">Total</th></tr>
                                </thead>
                                <tbody>
                                    ${lines.map((l: any) => `
                                        <tr>
                                            <td>${l.description}</td>
                                            <td>${Number(l.quantity)}</td>
                                            <td>${Number(l.unit_price).toFixed(2)}</td>
                                            <td style="text-align: right;">${(Number(l.net_amount || 0) + Number(l.tax_amount || 0)).toFixed(2)}</td>
                                        </tr>
                                    `).join('')}
                                    <tr class="total-row">
                                        <td colspan="3" style="text-align: right; padding-right: 20px;">GRAND TOTAL</td>
                                        <td style="text-align: right;">₹${total}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <div style="margin-top: 50px; text-align: right;">
                                <div style="border-top: 1px solid #1e293b; width: 200px; display: inline-block; padding-top: 5px; font-weight: 900;">AUTHORISED SIGNATORY</div>
                            </div>
                        </div>
                        <script>window.onload = () => { window.print(); window.close(); };</script>
                    </body>
                </html>
            `
        }

        printWindow.document.write(html)
        printWindow.document.close()
        setIsOpen(false)
    }

    const hasPaidInvoice = billingData?.status === 'paid' || billingData?.invoice?.status === 'paid';

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="h-8 gap-2 border-slate-200">
                        <Printer className="h-3.5 w-3.5" />
                        Print Terminal
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-4xl rounded-[2.5rem] p-0 border-none shadow-[0_50px_200px_rgba(0,0,0,0.3)] overflow-hidden bg-slate-50 dark:bg-slate-950">
                <DialogTitle className="sr-only">Elite Print Terminal</DialogTitle>
                <DialogDescription className="sr-only">Select Clinical Voucher or Financial Bill for multi-format high-speed re-printing.</DialogDescription>
                <div className="flex h-[600px]">
                    {/* LEFT SIDEBAR: Patient Profile (Elite) */}
                    <div className="w-[300px] bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-white/5 p-8 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-8">
                                <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                                    <Printer className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight uppercase italic tracking-tighter">
                                        Print <span className="text-indigo-600">Elite</span>
                                    </h2>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Multiplex Output Terminal</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Target Patient</p>
                                    <p className="font-black text-slate-900 dark:text-white uppercase truncate">{patient?.first_name} {patient?.last_name}</p>
                                    <code className="text-[10px] font-bold text-indigo-500 font-mono">ID-{patient?.patient_number}</code>
                                </div>

                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Consulting Doctor</p>
                                    <p className="font-bold text-slate-700 dark:text-slate-200">Dr. {clinician?.first_name} {clinician?.last_name}</p>
                                </div>

                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Document Audit</span>
                                    </div>
                                    <p className="text-[9px] text-slate-400 leading-relaxed italic">
                                        Generated on: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest text-center border-t pt-6 border-slate-100 dark:border-white/5">
                            Elite Ziona HMS Framework v16.2
                        </div>
                    </div>

                    {/* MAIN CONTENT: Tabs & Modes */}
                    <div className="flex-1 p-10 overflow-y-auto">
                        {isLoading ? (
                            <div className="h-full flex flex-col items-center justify-center gap-4">
                                <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
                                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Syncing Document Nodes...</p>
                            </div>
                        ) : (
                            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
                                <div className="flex items-center justify-between mb-8">
                                    <TabsList className="bg-slate-100 dark:bg-slate-900 rounded-2xl p-1 h-12">
                                        <TabsTrigger value="voucher" className="rounded-xl px-6 font-black uppercase text-xs tracking-widest data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-lg dark:data-[state=active]:bg-slate-800">
                                            <FileText className="h-4 w-4 mr-2" />
                                            Voucher
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="invoice"
                                            disabled={!billingData?.invoice}
                                            className="rounded-xl px-6 font-black uppercase text-xs tracking-widest data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-lg dark:data-[state=active]:bg-slate-800 disabled:opacity-30"
                                        >
                                            <Receipt className="h-4 w-4 mr-2" />
                                            Invoice
                                        </TabsTrigger>
                                    </TabsList>

                                    {billingData?.invoice && (
                                        <Badge variant="outline" className={`py-1.5 px-3 rounded-full font-black text-[10px] uppercase tracking-widest ${hasPaidInvoice ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                                            {billingData.status === 'paid' ? 'Paid & Clear' : 'Unpaid Entry'}
                                        </Badge>
                                    )}
                                </div>

                                <TabsContent value="voucher" className="m-0 space-y-6 animate-in fade-in slide-in-from-bottom-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        {[
                                            { id: 'standard', label: 'Standard A4', desc: 'Full Hospital Letterhead', icon: Layout, hidden: activeTab === 'invoice' ? !!hmsSettings?.billPreprintedLetterhead : !!hmsSettings?.opSlipPreprintedLetterhead },
                                            { id: 'letterhead', label: 'Preprinted', desc: 'Space for Official Header', icon: FileText, hidden: activeTab === 'invoice' ? !hmsSettings?.billPreprintedLetterhead : !hmsSettings?.opSlipPreprintedLetterhead },
                                            { id: 'thermal', label: 'Thermal Slip', desc: '80mm Fast Response', icon: Zap },
                                            { id: 'label', label: 'ID Sticker', desc: 'Sample / File Sample', icon: Fingerprint, hidden: activeTab === 'invoice' },
                                        ].filter(m => !m.hidden).map((m) => (
                                            <button
                                                key={m.id}
                                                onClick={() => setPrintMode(m.id as any)}
                                                className={`p-6 rounded-3xl border-2 transition-all flex flex-col gap-4 text-left group ${printMode === m.id ? 'bg-white dark:bg-slate-900 border-indigo-600 shadow-xl shadow-indigo-200/20' : 'bg-slate-50 dark:bg-slate-900/50 border-transparent hover:border-slate-200'}`}
                                            >
                                                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${printMode === m.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-white/5'}`}>
                                                    <m.icon className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center justify-between">
                                                        <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">{m.label}</p>
                                                        {printMode === m.id && <Check className="h-4 w-4 text-indigo-600" />}
                                                    </div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 group-hover:text-slate-500">{m.desc}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="pt-6 border-t border-slate-100 dark:border-white/5 flex gap-4">
                                        <Button
                                            onClick={() => handlePrint()}
                                            disabled={activeTab === 'invoice' && !billingData?.invoice}
                                            className="w-full h-20 rounded-[2rem] bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-sm tracking-[0.2em] shadow-2xl shadow-indigo-200 dark:shadow-none group disabled:opacity-50 disabled:grayscale"
                                        >
                                            <Printer className="mr-3 h-5 w-5 group-hover:scale-110 transition-transform" />
                                            {activeTab === 'invoice' && !billingData?.invoice ? 'Save Bill to Print' : 'Print Selected OP Slip'}
                                        </Button>
                                    </div>
                                </TabsContent>

                                <TabsContent value="invoice" className="m-0 space-y-6 animate-in fade-in slide-in-from-bottom-4">
                                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-white/5 p-8 shadow-sm">
                                        <div className="flex items-center justify-between mb-8 pb-8 border-b border-slate-50 dark:border-white/5">
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Invoice No.</p>
                                                <h3 className="text-2xl font-black text-slate-900 dark:text-white italic tracking-tighter">
                                                    {billingData?.invoice?.invoice_number}
                                                </h3>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Amount Due</p>
                                                <h3 className="text-2xl font-black text-emerald-600 italic tracking-tighter">
                                                    ₹{Number(billingData?.invoice?.total || 0).toLocaleString()}
                                                </h3>
                                            </div>
                                        </div>

                                        <div className="space-y-4 mb-10">
                                            {billingData?.invoice?.hms_invoice_lines?.slice(0, 3).map((l: any) => (
                                                <div key={l.id} className="flex items-center justify-between py-2 text-sm">
                                                    <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">{l.description}</span>
                                                    <span className="font-black text-slate-900 dark:text-white font-mono">₹{(Number(l.net_amount || 0) + Number(l.tax_amount || 0)).toFixed(2)}</span>
                                                </div>
                                            ))}
                                            {(billingData?.invoice?.hms_invoice_lines?.length || 0) > 3 && (
                                                <p className="text-[9px] font-black text-slate-300 uppercase italic">... + other clinical items</p>
                                            )}
                                        </div>

                                        <div className="flex gap-4">
                                            <Button
                                                variant="outline"
                                                onClick={() => handlePrint(hmsSettings?.billPreprintedLetterhead ? 'letterhead' : 'standard')}
                                                className="flex-1 h-16 rounded-2xl border-2 border-emerald-100 dark:border-emerald-900/30 font-black uppercase text-xs tracking-widest text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                            >
                                                <Printer className="mr-2 h-4 w-4" />
                                                Print A4 Bill {hmsSettings?.billPreprintedLetterhead ? '(L/H)' : ''}
                                            </Button>
                                            <Button
                                                onClick={() => handlePrint('thermal')}
                                                className="flex-1 h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-200 dark:shadow-none"
                                            >
                                                <Zap className="mr-2 h-4 w-4" />
                                                Thermal Bill
                                            </Button>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
