'use client'

import { useState, useEffect } from "react"
import { getHMSSettings } from "@/app/actions/settings"
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

    useEffect(() => {
        if (!isOpen) return;
        getHMSSettings().then(res => {
            if (res.success) {
                setHmsSettings(res.settings)
                if (res.settings?.opSlipPreprintedLetterhead && defaultPrintMode === 'standard') {
                    setPrintMode('letterhead')
                }
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
                            <span>T-ID: #${tokenNumber}</span>
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
                            .token { font-size: 20pt; font-weight: 900; margin: 2mm 0; }
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
                                font-family: 'Outfit', sans-serif; 
                                margin: 0;
                                padding: 0;
                                color: #1e293b;
                                background: white;
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }

                            .page {
                                width: 210mm;
                                height: 297mm;
                                padding: ${showHeader ? '15mm' : `${headerHeight}cm 15mm 15mm 15mm`};
                                position: relative;
                            }

                            /* --- HEADER SECTION --- */
                            .hospital-header {
                                display: ${showHeader ? 'flex' : 'none'};
                                align-items: center;
                                justify-content: center;
                                margin-bottom: 20px;
                                position: relative;
                                border-bottom: 2px solid #334155;
                                padding-bottom: 20px;
                            }
                            
                            .logo-container {
                                position: absolute;
                                left: 0;
                                height: 100px;
                                width: 100px;
                            }
                            
                            .logo-container img {
                                height: 100%;
                                width: 100%;
                                object-fit: contain;
                            }

                            .header-content {
                                text-align: center;
                                max-width: 65%;
                            }

                            .hospital-name {
                                font-size: 28pt;
                                font-weight: 900;
                                color: #1e3a8a;
                                text-transform: uppercase;
                                margin: 0;
                                letter-spacing: -1px;
                            }

                            .dept-name {
                                font-size: 14pt;
                                font-weight: 700;
                                color: #475569;
                                margin: 5px 0;
                                text-transform: uppercase;
                            }

                            .hospital-meta {
                                font-size: 9pt;
                                color: #64748b;
                                font-weight: 500;
                                margin-top: 5px;
                            }

                            /* --- PATIENT SECTION --- */
                            .info-strip {
                                display: grid;
                                grid-template-cols: 1.5fr 1fr;
                                gap: 40px;
                                margin-top: 10px;
                                border-bottom: 1.5px solid #e2e8f0;
                                padding-bottom: 15px;
                                margin-bottom: 20px;
                            }

                            .patient-details h2 {
                                font-size: 10pt;
                                color: #64748b;
                                margin: 0 0 8px 0;
                                text-transform: uppercase;
                                font-weight: 800;
                                letter-spacing: 1px;
                            }

                            .p-name { font-size: 16pt; font-weight: 900; color: #0f172a; text-transform: uppercase; line-height: 1.1; }
                            .p-addr { font-size: 10pt; color: #475569; margin: 3px 0; font-weight: 600; }
                            .p-meta { font-size: 11pt; font-weight: 700; color: #1e293b; margin-top: 8px; }

                            .visit-details {
                                text-align: right;
                                display: grid;
                                grid-template-cols: 1fr 1fr;
                                font-size: 10.5pt;
                                gap: 2px 15px;
                            }
                            
                            .v-label { font-weight: 800; color: #64748b; text-transform: uppercase; font-size: 9pt; text-align: right; }
                            .v-value { font-weight: 700; color: #0f172a; text-align: left; }

                            /* --- MAIN BODY & SIDEBAR --- */
                            .main-layout {
                                display: grid;
                                grid-template-cols: 1fr 65mm;
                                gap: 30px;
                                height: 16.5cm;
                            }

                            .doctor-notes {
                                border-right: 1.5px dashed #e2e8f0;
                                position: relative;
                            }
                            
                            .rx-watermark {
                                font-size: 60pt;
                                color: #f8fafc;
                                font-weight: 900;
                                position: absolute;
                                top: 40px;
                                left: 0;
                                z-index: -1;
                            }

                            .clinical-sidebar {
                                padding-left: 0px;
                            }

                            .vitals-sec {
                                margin-bottom: 30px;
                            }

                            .vital-row {
                                display: flex;
                                justify-content: space-between;
                                align-items: flex-end;
                                margin-bottom: 12px;
                            }

                            .vital-label { font-size: 10pt; font-weight: 900; color: #475569; width: 60px; text-transform: uppercase; }
                            .vital-box { 
                                flex: 1; 
                                border-bottom: 1px dotted #cbd5e1; 
                                height: 18px; 
                                margin-bottom: 2px;
                            }

                            /* --- TEST CHECKLIST --- */
                            .labs-sec {
                                border-top: 1px solid #f1f5f9;
                                pt: 15px;
                            }
                            
                            .lab-item {
                                display: flex;
                                align-items: center;
                                justify-content: space-between;
                                margin-bottom: 8px;
                            }
                            
                            .lab-name { font-size: 9pt; font-weight: 800; color: #1e293b; text-transform: uppercase; }
                            .lab-check { 
                                width: 14pt; 
                                height: 14pt; 
                                border: 1.5pt solid #334155; 
                                border-radius: 2pt;
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
                            <div class="hospital-header">
                                <div class="logo-container">
                                    ${hospitalInfo?.logo_url ? `<img src="${hospitalInfo.logo_url}" />` : '<div style="background: #f1f5f9; width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #cbd5e1;">LOGO</div>'}
                                </div>
                                <div class="header-content">
                                    <h1 class="hospital-name">${hospitalInfo?.name || 'GLOBAL MEDICARE HOSPITAL'}</h1>
                                    <div class="dept-name">${appointment.clinician?.metadata?.department || hospitalInfo?.metadata?.department || 'SMART EMERGENCY DEPARTMENT'}</div>
                                    <div class="hospital-meta">
                                        📍 ${hospitalInfo?.metadata?.address || 'MEDICAL PLAZA, SECTOR 4'} &nbsp;
                                        ☎️ ${hospitalInfo?.metadata?.phone || '0495-2520588'} <br/>
                                        📧 ${hospitalInfo?.metadata?.email || 'hospital@gmail.com'} &nbsp;
                                        🌐 ${hospitalInfo?.metadata?.website || 'www.globalmedicare.com'}
                                    </div>
                                </div>
                            </div>

                            <!-- PATIENT & VISIT STRIP -->
                            <div class="info-strip">
                                <div class="patient-details">
                                    <h2>Patient Details :</h2>
                                    <div class="p-name">${patientName}</div>
                                    <div class="p-addr">${appointment.patient?.address || 'LOCAL ADDRESS NOT SPECIFIED'}</div>
                                    <div class="p-meta">
                                        ${appointment.patient?.contact_no || 'NO CONTACT'} &nbsp;|&nbsp;
                                        Sex : ${appointment.patient?.gender || 'N/A'} &nbsp;|&nbsp;
                                        Age : ${appointment.patient?.age || (appointment.patient?.dob ? (new Date().getFullYear() - new Date(appointment.patient.dob).getFullYear()) : 'N/A')}
                                    </div>
                                </div>
                                <div class="visit-details">
                                    <span class="v-label">No</span><span class="v-value">: ${appointment.patient?.patient_number || '38822'}</span>
                                    <span class="v-label">Date</span><span class="v-value">: ${date}</span>
                                    <span class="v-label">Renew Date</span><span class="v-value">: ${new Date(new Date(appointment.start_time).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
                                    <span class="v-label">Token No</span><span class="v-value">: ${tokenNumber}</span>
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
