'use client'

import { useState, useEffect } from "react"
import { getHMSSettings, getPDFSettings } from "@/app/actions/settings"
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogTrigger, DialogFooter,
    DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer, FileText, Layout, X, Check } from "lucide-react"

interface OpSlipDialogProps {
    appointment: any
    trigger?: React.ReactNode
    defaultPrintMode?: 'standard' | 'letterhead' | 'thermal' | 'label'
    hospitalInfo?: any
}

export function OpSlipDialog({ appointment, trigger, defaultPrintMode = 'standard', hospitalInfo }: OpSlipDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [printMode, setPrintMode] = useState<'standard' | 'letterhead' | 'thermal' | 'label'>(defaultPrintMode)
    const [hmsSettings, setHmsSettings] = useState<any>(null)
    const [pdfConfig, setPdfConfig] = useState<any>(null)

    useEffect(() => {
        if (!isOpen) return;
        Promise.all([
            getHMSSettings(),
            getPDFSettings(undefined, undefined)
        ]).then(([hmsRes, pdfRes]) => {
            if (hmsRes.success) {
                setHmsSettings(hmsRes.settings)
                if (hmsRes.settings?.opSlipPreprintedLetterhead && defaultPrintMode === 'standard') {
                    setPrintMode('letterhead')
                }
            }
            if (pdfRes.success) {
                setPdfConfig(pdfRes.settings)
            }
        }).catch(() => {})
    }, [isOpen, defaultPrintMode])

    const handlePrint = () => {
        const printWindow = window.open('', '_blank')
        if (!printWindow) return

        const patientName = `${appointment.patient?.first_name} ${appointment.patient?.last_name || ''}`
        const doctorName = `Dr. ${appointment.clinician?.first_name} ${appointment.clinician?.last_name || ''}`
        const date = new Date(appointment.start_time).toLocaleDateString()
        const time = new Date(appointment.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const tokenNumber = appointment.id.split('-')[0].toUpperCase()

        let html = ''

        if (printMode === 'label') {
            html = `
                <!DOCTYPE html>
                <html>
                    <head>
                        <title>Label - ${patientName}</title>
                        <style>
                            @page { margin: 0; size: 50mm 25mm; }
                            body { 
                                font-family: 'Arial', sans-serif; 
                                width: 46mm; 
                                margin: 0 auto; 
                                padding: 2mm 0;
                                color: black;
                                background: white;
                                font-size: 8pt;
                                overflow: hidden;
                            }
                            .name { font-weight: 900; font-size: 10pt; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                            .id { font-weight: bold; border-bottom: 1px solid black; padding-bottom: 1px; margin-bottom: 2px; }
                            .meta { font-size: 7pt; display: flex; justify-content: space-between; }
                        </style>
                    </head>
                    <body>
                        <div class="name">${patientName}</div>
                        <div class="id">ID: ${appointment.patient?.patient_number}</div>
                        <div class="meta">
                            <span>${appointment.patient?.gender || 'N/A'} | ${appointment.patient?.age || ''}</span>
                            <span>${date}</span>
                        </div>
                        <div class="meta" style="margin-top: 2px;">
                            <span style="font-weight: 900; font-size: 10pt;">T-ID: #${tokenNumber}</span>
                            <span style="font-weight: bold;">${doctorName.slice(0, 15)}</span>
                        </div>
                        <script>window.onload = () => { window.print(); window.close(); };</script>
                    </body>
                </html>
            `
        } else if (printMode === 'thermal') {
            html = `
                <!DOCTYPE html>
                <html>
                    <head>
                        <title>OP Slip - ${patientName}</title>
                        <style>
                            @page { margin: 0; size: 80mm auto; }
                            body { 
                                font-family: 'Courier New', Courier, monospace; 
                                width: 72mm; 
                                margin: 0 auto; 
                                padding: 5mm 0;
                                color: black;
                                background: white;
                                font-size: 10pt;
                            }
                            .center { text-align: center; }
                            .bold { font-weight: bold; }
                            .line { border-top: 1px dashed black; margin: 2mm 0; }
                            .token { font-size: 14pt; font-weight: 900; margin: 2mm 0; }
                            .row { display: flex; justify-content: space-between; margin-bottom: 1mm; }
                            .label { font-size: 8pt; }
                            .value { font-weight: bold; }
                        </style>
                    </head>
                    <body>
                        <div class="center bold" style="font-size: 14pt;">ZIONA MEDICAL CENTER</div>
                        <div class="center" style="font-size: 8pt;">Outpatient Department</div>
                        <div class="line"></div>
                        <div class="center label">OP TOKEN</div>
                        <div class="center token">#${tokenNumber}</div>
                        <div class="line"></div>
                        <div class="row">
                            <span class="label">Patient:</span>
                            <span class="value">${patientName}</span>
                        </div>
                        <div class="row">
                            <span class="label">ID:</span>
                            <span class="value">${appointment.patient?.patient_number}</span>
                        </div>
                        <div class="row">
                            <span class="label">Doctor:</span>
                            <span class="value">${doctorName}</span>
                        </div>
                        <div class="row">
                            <span class="label">Date:</span>
                            <span class="value">${date}</span>
                        </div>
                        <div class="row">
                            <span class="label">Time:</span>
                            <span class="value">${time}</span>
                        </div>
                        <div class="line"></div>
                        <div class="center bold" style="font-size: 8pt;">Vitals / Symptoms</div>
                        <div style="height: 15mm;"></div>
                        <div class="line"></div>
                        <div class="center" style="font-size: 7pt;">Please wait for your turn.</div>
                        <div class="center" style="font-size: 7pt;">V10-THERMAL-SLIP</div>
                        <script>window.onload = () => { window.print(); window.close(); };</script>
                    </body>
                </html>
            `
        } else {
            // A4 Professional OP Slip (Standard or Letterhead)
            const showHeader = printMode !== 'letterhead';
            const headerHeight = hmsSettings?.opSlipHeaderHeight || '4.5';
            
            html = `
                <!DOCTYPE html>
                <html>
                    <head>
                        <title>OP Slip - ${patientName}</title>
                        <style>
                            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
                            
                            * { box-sizing: border-box; }
                            
                            @page { 
                                size: A4; 
                                margin: 0; 
                            }
                            
                            body { 
                                font-family: ${pdfConfig?.fontFamily === 'times' ? 'serif' : (pdfConfig?.fontFamily === 'courier' ? 'monospace' : "'Outfit', sans-serif")}; 
                                margin: 0;
                                padding: 0;
                                color: #1e293b;
                                background: white;
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }

                            /* --- NEW CARD DESIGN (MATCHING IMAGE) --- */
                            .op-card {
                                border: 1px solid #e2e8f0;
                                border-radius: 12px;
                                margin-top: 20px;
                                display: grid;
                                grid-template-columns: 1fr 1fr;
                                overflow: hidden;
                            }

                            .card-section {
                                padding: 15px 20px;
                                border-bottom: 1px solid #f1f5f9;
                            }
                            
                            .card-section:nth-child(odd) {
                                border-right: 1px solid #f1f5f9;
                            }

                            .card-label {
                                font-size: 8pt;
                                font-weight: 800;
                                color: #64748b;
                                text-transform: uppercase;
                                letter-spacing: 0.5px;
                                margin-bottom: 4px;
                            }

                            .card-value-large {
                                font-size: 14pt; /* MATCHING SIZE */
                                font-weight: 900;
                                color: #0f172a;
                                line-height: 1.1;
                            }

                            .card-value-token {
                                font-size: 14pt; /* MATCHING SIZE */
                                font-weight: 900;
                                color: #1e3a8a;
                                text-align: right;
                            }

                            .card-meta {
                                font-size: 9pt;
                                color: #475569;
                                font-weight: 600;
                                margin-top: 4px;
                            }

                            .token-container {
                                display: flex;
                                flex-direction: column;
                                align-items: flex-end;
                            }

                            /* --- FOOTER --- */
                            .footer {
                                position: absolute;
                                bottom: 20mm;
                                left: 15mm;
                                right: 15mm;
                                display: flex;
                                justify-content: space-between;
                                align-items: flex-end;
                                border-top: 1.5px solid #e2e8f0;
                                padding-top: 15px;
                            }
                            
                            .f-legal { font-size: 8pt; font-weight: 600; color: #94a3b8; }
                            .f-sig { text-align: center; }
                            .sig-line { width: 180px; border-top: 1.5px solid #0f172a; margin-bottom: 5px; }
                            .sig-text { font-size: 9pt; font-weight: 900; color: #0f172a; text-transform: uppercase; }

                        </style>
                    </head>
                    <body>
                        <div class="page">
                            <!-- HOSPITAL HEADER -->
                            <div class="hospital-header" style="justify-content: ${pdfConfig?.headerAlignment === 'center' ? 'center' : (pdfConfig?.headerAlignment === 'left' ? 'flex-start' : 'flex-end')}; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px; display: flex; text-align: ${pdfConfig?.headerAlignment};">
                                <div style="display: flex; flex-direction: ${pdfConfig?.headerAlignment === 'center' ? 'column' : (pdfConfig?.headerAlignment === 'right' ? 'row-reverse' : 'row')}; align-items: center; gap: 15px; width: 100%;">
                                    ${pdfConfig?.showLogo !== false ? `
                                        <div class="logo-container" style="position: static; height: 70px; width: 70px; flex-shrink: 0;">
                                            ${hospitalInfo?.logo_url ? `<img src="${hospitalInfo.logo_url}" />` : '<div style="background: #f1f5f9; width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #cbd5e1;">LOGO</div>'}
                                        </div>
                                    ` : ''}
                                    <div style="flex-grow: 1;">
                                        <div style="font-size: ${pdfConfig?.hospitalNameSize || 18}pt; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">${hospitalInfo?.name || 'GLOBAL MEDICARE'}</div>
                                        ${pdfConfig?.showContactInfo !== false ? `
                                            <div style="font-size: ${pdfConfig?.addressSize || 9}pt; color: #64748b; font-weight: 600;">${hospitalInfo?.address || 'Hospital Address'}</div>
                                            <div style="font-size: ${pdfConfig?.addressSize || 9}pt; color: #64748b; font-weight: 600;">${hospitalInfo?.phone || '+91 000-0000'} | ${hospitalInfo?.metadata?.email || 'hms@live.com'}</div>
                                        ` : ''}
                                    </div>
                                    <div style="text-align: right; min-width: 150px;">
                                        <div style="font-size: 9pt; font-weight: 800; color: #64748b; letter-spacing: 0.5px; text-transform: uppercase;">OP VISIT SLIP</div>
                                        <div style="font-size: 10pt; font-weight: 900; color: #0f172a; margin-top: 2px;">${date.toUpperCase()}</div>
                                    </div>
                                </div>
                            </div>

                            <!-- MAIN DATA CARD (MATCHING IMAGE) -->
                            <div class="op-card">
                                <!-- ROW 1: PATIENT & TOKEN -->
                                <div class="card-section">
                                    <div class="card-label">Patient Details</div>
                                    <div class="card-value-large">${patientName}</div>
                                    <div class="card-meta">
                                        ID: ${appointment.patient?.patient_number || 'PAT-785651'} | 
                                        ${appointment.patient?.gender || 'male'} | 
                                        Age: ${appointment.patient?.age || 'N/A'}
                                    </div>
                                </div>
                                <div class="card-section token-container">
                                    <div class="card-label">Token No</div>
                                    <div class="card-value-token">#${tokenNumber}</div>
                                </div>

                                <!-- ROW 2: CLINICIAN & TIME -->
                                <div class="card-section">
                                    <div class="card-label">Consulting Clinician</div>
                                    <div style="font-size: 11pt; font-weight: 800; color: #0f172a;">${doctorName}</div>
                                </div>
                                <div class="card-section" style="text-align: right;">
                                    <div class="card-label">Encounter Time</div>
                                    <div style="font-size: 11pt; font-weight: 800; color: #0f172a;">${time}</div>
                                </div>
                            </div>

                            <!-- CLINICAL WORKSPACE (REST OF THE PAGE) -->
                            <div style="margin-top: 30px; display: grid; grid-template-cols: 1fr 200px; gap: 40px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                                <div style="min-height: 500px; position: relative;">
                                    <div style="font-size: 40pt; font-weight: 900; color: #f8fafc; position: absolute; top: 0; left: 0;">℞</div>
                                    <!-- HANDWRITTEN AREA -->
                                </div>
                                <div>
                                    <div style="font-size: 8pt; font-weight: 900; color: #cbd5e1; margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px;">VITALS</div>
                                    ${['BP', 'SPO2', 'PR', 'RR', 'WT', 'TEMP'].map(v => `
                                        <div style="display: flex; justify-content: space-between; border-bottom: 1px dotted #f1f5f9; padding: 6px 0;">
                                            <span style="font-size: 8pt; font-weight: 800; color: #94a3b8;">${v}</span>
                                            <span style="width: 80px; height: 12px; border-bottom: 1px solid #f1f5f9;"></span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <!-- FOOTER -->
                            <div class="footer">
                                <div class="f-legal">
                                    ${hospitalInfo?.name || 'GLOBAL MEDICARE'} - OP SLIP PROTOCOL V4.2 <br/>
                                    ${appointment.clinician?.official_hospital_email ? `<span style="color: #6366f1;">${appointment.clinician.official_hospital_email}</span> | ` : ''}
                                    ID: ${appointment.id.slice(0, 8)} | AUTH: ${crypto.randomUUID().slice(0, 4).toUpperCase()}
                                </div>
                                <div class="f-sig">
                                    <div class="sig-line"></div>
                                    <div class="sig-text">${doctorName.toUpperCase()}</div>
                                </div>
                            </div>
                        </div>

                            <!-- CLINICAL LAYOUT -->
                            <div class="main-layout">
                                <div class="doctor-notes">
                                    <div class="rx-watermark">℞</div>
                                    <!-- This area is left blank for handwriting as shown in image -->
                                </div>
                                
                                <div class="clinical-sidebar">
                                    <!-- VITALS -->
                                    <div class="vitals-sec">
                                        <div class="vital-row">
                                            <span class="vital-label">BP</span>
                                            <div class="vital-box" style="display: flex; align-items: center; padding-left: 5px; font-weight: 700;">
                                                ${appointment.vitals?.systolic ? `${Math.round(appointment.vitals.systolic)} / ${Math.round(appointment.vitals.diastolic)}` : ''}
                                            </div>
                                        </div>
                                        <div class="vital-row">
                                            <span class="vital-label">SPO2</span>
                                            <div class="vital-box" style="display: flex; align-items: center; padding-left: 5px; font-weight: 700;">
                                                ${appointment.vitals?.spo2 ? `${Math.round(appointment.vitals.spo2)}%` : ''}
                                            </div>
                                        </div>
                                        <div class="vital-row">
                                            <span class="vital-label">PR</span>
                                            <div class="vital-box" style="display: flex; align-items: center; padding-left: 5px; font-weight: 700;">
                                                ${appointment.vitals?.pulse ? `${Math.round(appointment.vitals.pulse)} bpm` : ''}
                                            </div>
                                        </div>
                                        <div class="vital-row">
                                            <span class="vital-label">RR</span>
                                            <div class="vital-box" style="display: flex; align-items: center; padding-left: 5px; font-weight: 700;">
                                                ${appointment.vitals?.respiration ? `${Math.round(appointment.vitals.respiration)} /min` : ''}
                                            </div>
                                        </div>
                                        <div class="vital-row">
                                            <span class="vital-label">WT</span>
                                            <div class="vital-box" style="display: flex; align-items: center; padding-left: 5px; font-weight: 700;">
                                                ${appointment.vitals?.weight ? `${appointment.vitals.weight} kg` : ''}
                                            </div>
                                        </div>
                                        <div class="vital-row">
                                            <span class="vital-label">TEMP</span>
                                            <div class="vital-box" style="display: flex; align-items: center; padding-left: 5px; font-weight: 700;">
                                                ${appointment.vitals?.temperature ? `${appointment.vitals.temperature}°F` : ''}
                                            </div>
                                        </div>
                                        <div class="vital-row">
                                            <span class="vital-label">B_GRP</span>
                                            <div class="vital-box" style="display: flex; align-items: center; padding-left: 5px; font-weight: 900; color: #dc2626;">
                                                ${appointment.patient?.blood_group || ''}
                                            </div>
                                        </div>
                                    </div>

                                    <!-- LAB TEST CHECKBOXES -->
                                    <div class="labs-sec">
                                        <div style="font-size: 8pt; font-weight: 900; color: #94a3b8; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9;">ORDER INVESTIGATION</div>
                                        ${['CBC', 'ESR', 'CRP', 'LFT', 'RFT', 'TROPI', 'TSH / TFT', 'HBA1C', 'D-DIAMER', 'DENGUECARD TEST', 'URE', 'URINE C/S', 'X-RAY', 'MRI', 'CT'].map(test => `
                                            <div class="lab-item">
                                                <span class="lab-name">${test}</span>
                                                <div class="lab-check"></div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>

                            <!-- FOOTER -->
                            <div class="footer">
                                <div class="f-legal">
                                    ZIONA HMS - OP SLIP PROTOCOL V4.2 <br/>
                                    GEN: ${new Date().toLocaleString()} | ID: ${appointment.id.slice(0, 8)}
                                </div>
                                <div class="f-sig">
                                    <div class="sig-line"></div>
                                    <div class="sig-text">${appointment.clinician?.first_name ? 'Dr. ' + appointment.clinician.first_name.toUpperCase() : 'CONSULTING DOCTOR'}</div>
                                </div>
                            </div>
                        </div>

                        <script>
                            window.onload = () => {
                                window.print();
                                window.close();
                            };
                        </script>
                    </body>
                </html>
            `
        }

        printWindow.document.write(html)
        printWindow.document.close()
        setIsOpen(false)
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="h-8 gap-2 border-slate-200">
                        <Printer className="h-3.5 w-3.5" />
                        Print OP Slip
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-[2rem] p-0 border-none shadow-2xl overflow-hidden bg-slate-50">
                <div className="p-8">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
                            <FileText className="h-7 w-7 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 leading-tight uppercase italic tracking-tighter">
                                OP Slip <span className="text-indigo-600">Protocol</span>
                            </h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Print Configuration</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <button
                            onClick={() => setPrintMode('standard')}
                            className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between group ${printMode === 'standard' ? 'bg-white border-indigo-600 shadow-xl shadow-indigo-50' : 'bg-white/50 border-transparent hover:border-slate-200'}`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${printMode === 'standard' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <Layout className="h-5 w-5" />
                                </div>
                                <div className="text-left">
                                    <p className="font-black text-slate-800 uppercase tracking-tight text-sm">Full Standard Print (A4)</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Includes Hospital Header & Info</p>
                                </div>
                            </div>
                            {printMode === 'standard' && <Check className="h-5 w-5 text-indigo-600" />}
                        </button>

                        <button
                            onClick={() => setPrintMode('letterhead')}
                            className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between group ${printMode === 'letterhead' ? 'bg-white border-indigo-600 shadow-xl shadow-indigo-50' : 'bg-white/50 border-transparent hover:border-slate-200'}`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${printMode === 'letterhead' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <Layout className="h-5 w-5" />
                                </div>
                                <div className="text-left">
                                    <p className="font-black text-slate-800 uppercase tracking-tight text-sm">Letterhead Optimized (A4)</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Leaves 10cm space for pre-printed paper</p>
                                </div>
                            </div>
                            {printMode === 'letterhead' && <Check className="h-5 w-5 text-indigo-600" />}
                        </button>

                        <button
                            onClick={() => setPrintMode('thermal')}
                            className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between group ${printMode === 'thermal' ? 'bg-white border-indigo-600 shadow-xl shadow-indigo-50' : 'bg-white/50 border-transparent hover:border-slate-200'}`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${printMode === 'thermal' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <Printer className="h-5 w-5" />
                                </div>
                                <div className="text-left">
                                    <p className="font-black text-slate-800 uppercase tracking-tight text-sm">Thermal Slip (80mm)</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Optimized for point-of-sale printers</p>
                                </div>
                            </div>
                            {printMode === 'thermal' && <Check className="h-5 w-5 text-indigo-600" />}
                        </button>

                        <button
                            onClick={() => setPrintMode('label')}
                            className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between group ${printMode === 'label' ? 'bg-white border-indigo-600 shadow-xl shadow-indigo-50' : 'bg-white/50 border-transparent hover:border-slate-200'}`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${printMode === 'label' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <Printer className="h-5 w-5" />
                                </div>
                                <div className="text-left">
                                    <p className="font-black text-slate-800 uppercase tracking-tight text-sm">Patient Label (50x25mm)</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Concise sticky label for files/samples</p>
                                </div>
                            </div>
                            {printMode === 'label' && <Check className="h-5 w-5 text-indigo-600" />}
                        </button>
                    </div>

                    <div className="mt-8 flex gap-3">
                        <Button
                            variant="ghost"
                            onClick={() => setIsOpen(false)}
                            className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handlePrint}
                            className="flex-[2] h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center gap-2"
                        >
                            <Printer className="h-5 w-5" />
                            Launch Print
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
