'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Printer, Plus, Trash2, Copy, Eraser, Clock, Zap, X, Save, Thermometer, Brain, Heart, Activity as ActivityIcon, MessageCircle, FileText, Share2, Loader2, User, Pill, CheckCircle2, Search, AlertCircle, PenTool, Edit3, MapPin, Phone, Mail, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/components/ui/use-toast'
import { sharePrescriptionWhatsapp } from '@/app/actions/prescription'
import { getLabReportForAppointment } from '@/app/actions/lab'
import { getPDFSettings, getHMSSettings } from '@/app/actions/settings'
import { getCompanyDetails } from '@/app/actions/purchase'

interface PrescriptionEditorProps {
    isModal?: boolean
    onClose?: () => void
}

export function PrescriptionEditor({ isModal = false, onClose }: PrescriptionEditorProps) {
    const router = useRouter()
    const { toast } = useToast()
    const searchParams = useSearchParams()
    const patientId = searchParams.get('patientId')
    const appointmentId = searchParams.get('appointmentId')
    const prescriptionId = searchParams.get('prescriptionId')

    const [patientInfo, setPatientInfo] = useState<any>(null)
    const [resolvedPatientId, setResolvedPatientId] = useState<string | null>(patientId)
    const [medicines, setMedicines] = useState<any[]>([])
    const [selectedMedicines, setSelectedMedicines] = useState<any[]>([])

    // Lab Report State
    const [labReportUrl, setLabReportUrl] = useState<string | null>(null)

    // Medicine search & modal
    const [medicineSearch, setMedicineSearch] = useState('')
    const [filteredMedicines, setFilteredMedicines] = useState<any[]>([])
    const [showMedicineDropdown, setShowMedicineDropdown] = useState(false)
    const [showMedicineModal, setShowMedicineModal] = useState(false)
    const [currentMedicine, setCurrentMedicine] = useState<any>(null)
    const [editingIndex, setEditingIndex] = useState<number | null>(null)

    // Medicine config in modal
    const [modalDosage, setModalDosage] = useState('1-0-1')
    const [modalDays, setModalDays] = useState('5')
    const [modalTiming, setModalTiming] = useState('After Food')

    // SCRIBBLE / HANDWRITING MODAL STATE
    const [scribbleModalOpen, setScribbleModalOpen] = useState(false)
    const [scribbleTarget, setScribbleTarget] = useState<keyof typeof convertedText | null>(null)
    const [isConvertingScribble, setIsConvertingScribble] = useState(false)
    const scribbleCanvasRef = useRef<HTMLCanvasElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)

    const [isSaving, setIsSaving] = useState(false)
    const [isSharing, setIsSharing] = useState(false)
    const [lastSavedId, setLastSavedId] = useState<string | null>(null)
    const [pdfConfig, setPdfConfig] = useState<any>(null)
    const [companyDetails, setCompanyDetails] = useState<any>(null)
    const [hmsSettings, setHmsSettings] = useState<any>(null)

    // Clinical Text Fields
    const [convertedText, setConvertedText] = useState({
        // Vitals are separate now, stored for legacy/save compatibility if needed, but display is changing
        vitals: '',
        diagnosis: '',
        complaint: '',

        examination: '',
        plan: ''
    })

    const [drawings, setDrawings] = useState<{ [key: string]: string }>({})
    const [typingSections, setTypingSections] = useState<{ [key: string]: boolean }>({})


    // Structured Vitals State
    const [vitalsData, setVitalsData] = useState<any>(null)

    const [selectedLabs, setSelectedLabs] = useState<any[]>([])
    const [labSearch, setLabSearch] = useState('')
    const [filteredLabs, setFilteredLabs] = useState<any[]>([])
    const [showLabDropdown, setShowLabDropdown] = useState(false)
    const [isSearchingLabs, setIsSearchingLabs] = useState(false)

    // Dynamic Masters from Database
    const [dbTemplates, setDbTemplates] = useState<any[]>([])
    const [loadingTemplates, setLoadingTemplates] = useState(true)
    const [loadingPrevious, setLoadingPrevious] = useState(false)

    // Helper to get icon for a template
    const getTemplateIcon = (name: string) => {
        const lower = name.toLowerCase()
        if (lower.includes('fever') || lower.includes('cold')) return <Thermometer className="h-3 w-3" />
        if (lower.includes('heart') || lower.includes('tension')) return <Heart className="h-3 w-3" />
        if (lower.includes('brain') || lower.includes('migraine')) return <Brain className="h-3 w-3" />
        if (lower.includes('diabetes') || lower.includes('sugar')) return <ActivityIcon className="h-3 w-3" />
        return <Zap className="h-3 w-3" />
    }

    // Fetch master templates
    useEffect(() => {
        fetch('/api/prescriptions/templates')
            .then(res => res.json())
            .then(data => {
                if (data.success) setDbTemplates(data.templates)
            })
            .catch(err => console.error('Error fetching templates:', err))
            .finally(() => setLoadingTemplates(false))
    }, [])

    // Fetch patient data
    useEffect(() => {
        if (!patientId) return;
        fetch(`/api/patients/${patientId}`)
            .then(res => res.json())
            .then(data => {
                if (data.patient) setPatientInfo(data.patient)
            })
            .catch(err => console.error(err))
    }, [patientId])

    // If no patientId but have appointmentId, fetch appointment to get patientId
    useEffect(() => {
        let isMounted = true;
        if (patientId || !appointmentId) return;

        fetch(`/api/appointments/${appointmentId}`)
            .then(res => res.json())
            .then(data => {
                if (isMounted && data.appointment?.patient_id) {
                    setResolvedPatientId(data.appointment.patient_id);
                    fetch(`/api/patients/${data.appointment.patient_id}`)
                        .then(res => res.json())
                        .then(pData => {
                            if (isMounted && pData.patient) setPatientInfo(pData.patient)
                        });
                }
            })
            .catch(err => console.error('Error fetching appointment for patient info:', err));
        return () => { isMounted = false; };
    }, [appointmentId, patientId]);

    useEffect(() => {
        let isMounted = true;
        if (appointmentId) {
            getLabReportForAppointment(appointmentId).then(res => {
                if (isMounted && res.success && res.reportUrl) {
                    setLabReportUrl(res.reportUrl)
                }
            })
        }
        return () => { isMounted = false; };
    }, [appointmentId])

    // Fetch existing prescription and nurse vitals
    useEffect(() => {
        let isMounted = true;
        if (!appointmentId && !prescriptionId && !patientId) return;

        const endpoint = prescriptionId
            ? `/api/prescriptions/${prescriptionId}`
            : `/api/prescriptions/by-appointment/${appointmentId}`;

        fetch(endpoint)
            .then(res => res.json())
            .then(data => {
                if (!isMounted) return;
                if (data.success) {
                    const pr = data.prescription;
                    const vt = data.vitals;

                    if (vt) {
                        setVitalsData(vt);
                        const vitalsStr = `T: ${vt.temperature || '-'}°F, P: ${vt.pulse || '-'}bpm, BP: ${vt.systolic || '-'}/${vt.diastolic || '-'}mmHg, SpO2: ${vt.spo2 || '-'}%, Wt: ${vt.weight || '-'}kg`.trim();
                        setConvertedText(prev => ({ ...prev, vitals: vitalsStr }));
                    }

                    if (pr) {
                        setConvertedText({
                            vitals: pr.vitals || (vt ? `T: ${vt.temperature || '-'}°F, P: ${vt.pulse || '-'}bpm, BP: ${vt.systolic || '-'}/${vt.diastolic || '-'}mmHg, SpO2: ${vt.spo2 || '-'}%, Wt: ${vt.weight || '-'}kg` : ''),
                            diagnosis: pr.diagnosis || '',
                            complaint: pr.complaint || '',
                            examination: pr.examination || '',
                            plan: pr.plan || ''
                        });
                        setSelectedMedicines(pr.medicines || []);
                        setSelectedLabs(Array.isArray(pr.labTests) ? pr.labTests : []);

                        if (!patientId && pr.patient_id) {
                            setResolvedPatientId(pr.patient_id);
                            fetch(`/api/patients/${pr.patient_id}`)
                                .then(res => res.json())
                                .then(pData => {
                                    if (isMounted && pData.patient) setPatientInfo(pData.patient)
                                });
                        }
                    }
                }
            })
            .catch(err => console.error('Error fetching existing data:', err));

        return () => { isMounted = false; };
    }, [appointmentId, prescriptionId, patientId]);

    useEffect(() => {
        let isMounted = true;
        fetch('/api/medicines')
            .then(res => res.json())
            .then(data => {
                if (isMounted && data.medicines) setMedicines(data.medicines)
            })
            .catch(err => console.error(err))
        return () => { isMounted = false; };
    }, [])

    // Fetch lab tests
    useEffect(() => {
        let isMounted = true;
        const timer = setTimeout(() => {
            if (labSearch.trim()) {
                setIsSearchingLabs(true)
                fetch(`/api/hms/lab-tests?q=${encodeURIComponent(labSearch)}`)
                    .then(res => res.json())
                    .then(data => {
                        if (isMounted && data.success) {
                            setFilteredLabs(data.tests)
                            setShowLabDropdown(true)
                        }
                    })
                    .finally(() => { if (isMounted) setIsSearchingLabs(false) })
            } else {
                setFilteredLabs([])
                setShowLabDropdown(false)
            }
        }, 300)
        return () => {
            isMounted = false;
            clearTimeout(timer);
        }
    }, [labSearch])

    const addLabTest = (test: any) => {
        if (!selectedLabs.find(l => l.id === test.id)) {
            setSelectedLabs(prev => [...prev, test])
        }
        setLabSearch('')
        // setFilteredLabs([]) // Don't clear immediately if we want to add more? 
        // Actually best is to clear search but maybe keep dropdown open if it was a list? 
        // For custom input/search, clearing is standard.
        // Let's add a focus restore maybe?
        const input = document.getElementById('lab-search-input');
        if (input) input.focus();
    }

    const handleLabKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && labSearch.trim()) {
            addLabTest({ name: labSearch.trim(), id: crypto.randomUUID() });
        }
    }

    const removeLabTest = (id: string) => {
        setSelectedLabs(selectedLabs.filter(l => l.id !== id))
    }

    // Keyboard Navigation State
    const [selectedIndex, setSelectedIndex] = useState(0)

    // Filter medicines as user types
    useEffect(() => {
        if (medicineSearch.length >= 1) {
            const filtered = medicines.filter(m =>
                m.name.toLowerCase().includes(medicineSearch.toLowerCase())
            ).slice(0, 10)
            setFilteredMedicines(filtered)
            setShowMedicineDropdown(true)
            setSelectedIndex(0) // Reset selection
        } else {
            setShowMedicineDropdown(false)
            setSelectedIndex(0)
        }
    }, [medicineSearch, medicines])

    const handleMedicineKeyDown = (e: React.KeyboardEvent) => {
        if (!showMedicineDropdown) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < filteredMedicines.length + (medicineSearch ? 1 : 0) - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredMedicines.length > 0 && selectedIndex < filteredMedicines.length) {
                openMedicineModal(filteredMedicines[selectedIndex]);
            } else if (medicineSearch.trim()) {
                // If Custom is selected (last index usually) or just enter in general
                openMedicineModal({ name: medicineSearch.trim() });
            }
        } else if (e.key === 'Escape') {
            setShowMedicineDropdown(false);
        }
    }


    // ------------------------------------------------------------------------
    // SCRIBBLE / DRAWING LOGIC (Now in a modal context)
    // ------------------------------------------------------------------------

    const openScribbleModal = (target: keyof typeof convertedText) => {
        setScribbleTarget(target)
        setScribbleModalOpen(true)
        // Reset canvas after modal opens (need a small delay or effect, handled in useEffect typically, 
        // but here we'll just ensure it's clear when we access it)
    }

    useEffect(() => {
        if (scribbleModalOpen && scribbleCanvasRef.current) {
            const canvas = scribbleCanvasRef.current
            const ctx = canvas.getContext('2d')
            if (ctx) {
                ctx.fillStyle = '#ffffff'
                ctx.fillRect(0, 0, canvas.width, canvas.height)
            }
        }
    }, [scribbleModalOpen])

    const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = scribbleCanvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Set pointer capture to handle drawing outside the canvas
        canvas.setPointerCapture(e.pointerId)

        setIsDrawing(true)
        const rect = canvas.getBoundingClientRect()
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height

        const x = (e.clientX - rect.left) * scaleX
        const y = (e.clientY - rect.top) * scaleY

        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineWidth = 4
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = '#000'

            // Save initial point
            ; (canvas as any).lastLineX = x
            ; (canvas as any).lastLineY = y
    }

    const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !scribbleCanvasRef.current) return
        const canvas = scribbleCanvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const rect = canvas.getBoundingClientRect()
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height

        const x = (e.clientX - rect.left) * scaleX
        const y = (e.clientY - rect.top) * scaleY

        // Use quadratic curve for smoothing
        const lastX = (canvas as any).lastLineX
        const lastY = (canvas as any).lastLineY

        const midX = (lastX + x) / 2
        const midY = (lastY + y) / 2

        ctx.quadraticCurveTo(lastX, lastY, midX, midY)
        ctx.stroke()

            ; (canvas as any).lastLineX = x
            ; (canvas as any).lastLineY = y
    }

    const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return
        setIsDrawing(false)
        if (scribbleCanvasRef.current) {
            scribbleCanvasRef.current.releasePointerCapture(e.pointerId)
        }
    }

    const clearScribbleCanvas = () => {
        const canvas = scribbleCanvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    const saveScribble = async () => {
        if (!scribbleCanvasRef.current || !scribbleTarget) return

        // Just save image locally
        const dataUrl = scribbleCanvasRef.current.toDataURL('image/jpeg', 0.8)
        setDrawings(prev => ({ ...prev, [scribbleTarget]: dataUrl }))
        setScribbleModalOpen(false)
    }


    const loadLastPrescription = async () => {
        if (!patientId) return
        setLoadingPrevious(true)
        try {
            const res = await fetch(`/api/prescriptions/last?patientId=${patientId}`)
            const data = await res.json()
            if (data.success && data.data) {
                if (data.data.medicines && data.data.medicines.length > 0) {
                    setSelectedMedicines(data.data.medicines.map((m: any) => ({
                        id: m.id,
                        name: m.name,
                        dosage: m.dosage || '0-0-0',
                        days: m.days,
                        timing: m.timing || 'After Food'
                    })))
                }

                if (data.data.labTests && data.data.labTests.length > 0) {
                    setSelectedLabs(data.data.labTests);
                }

                alert(`✅ Loaded prescription from ${new Date(data.date).toLocaleDateString()}!`)
            } else {
                alert('ℹ️ No previous prescription found')
            }
        } catch (error) {
            console.error('Error:', error)
            alert('❌ Failed to load')
        } finally {
            setLoadingPrevious(false)
        }
    }

    const applyTemplate = (template: any) => {
        // Handle both older format and DB format
        const templateMeds = Array.isArray(template.medicines) ? template.medicines : template.meds;

        setSelectedMedicines(templateMeds.map((m: any) => ({
            id: m.id || m.medicineId || '',
            name: m.name,
            dosage: m.dosage,
            days: m.days || 5,
            timing: m.timing || 'After Food'
        })))

        // Populate clinical fields if present
        if (template.diagnosis || template.plan || template.complaint || template.examination || template.vitals) {
            setConvertedText(prev => ({
                ...prev,
                // vitals: template.vitals || prev.vitals, // Don't overwrite nurse vitals with template vitals usually
                diagnosis: template.diagnosis || prev.diagnosis,
                complaint: template.complaint || prev.complaint,
                examination: template.examination || prev.examination,
                plan: template.plan || prev.plan
            }))
        }
    }

    const saveCurrentAsTemplate = async () => {
        const name = prompt("Enter Master Template Name (e.g., 'Hypertension Protocol'):")
        if (!name) return;

        try {
            const res = await fetch('/api/prescriptions/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    medicines: selectedMedicines,
                    vitals: convertedText.vitals,
                    diagnosis: convertedText.diagnosis,
                    complaint: convertedText.complaint,
                    examination: convertedText.examination,
                    plan: convertedText.plan
                })
            })
            const data = await res.json()
            if (data.success) {
                alert('✅ Saved to Master Protocols!')
                setDbTemplates(prev => [...prev, data.template])
            } else {
                alert('❌ Failed: ' + data.error)
            }
        } catch (err) {
            console.error(err)
            alert('❌ Connection error')
        }
    }

    const openMedicineModal = (med: any, editIdx: number | null = null) => {
        setCurrentMedicine(med)
        setEditingIndex(editIdx)
        if (editIdx !== null) {
            const existing = selectedMedicines[editIdx]
            setModalDosage(existing.dosage)
            setModalDays(existing.days)
            setModalTiming(existing.timing || 'After Food')
        } else {
            setModalDosage('1-0-1')
            setModalDays('5')
            setModalTiming('After Food')
        }
        setShowMedicineModal(true)
        setMedicineSearch('')
        setShowMedicineDropdown(false)
    }

    const saveMedicineFromModal = () => {
        const medicineData = {
            id: currentMedicine?.id || '',
            name: currentMedicine?.name || '',
            dosage: modalDosage,
            days: modalDays,
            timing: modalTiming
        }

        if (editingIndex !== null) {
            const updated = [...selectedMedicines]
            updated[editingIndex] = medicineData
            setSelectedMedicines(updated)
        } else {
            setSelectedMedicines([...selectedMedicines, medicineData])
        }

        setShowMedicineModal(false)
        setCurrentMedicine(null)
        setEditingIndex(null)
    }

    const removeMedicine = (index: number) => {
        setSelectedMedicines(selectedMedicines.filter((_, i) => i !== index))
    }

    const processDrawingsAndSave = async (isPrint = false, isShareData = false) => {
        setIsSaving(true);
        try {
            // 1. Convert all drawings to text first
            let finalTexts: any = { ...convertedText };
            const keysToProcess = Object.keys(drawings).filter(key => drawings[key]);

            if (keysToProcess.length > 0) {
                toast({ title: "Processing Handwriting...", description: `Converting ${keysToProcess.length} handwritten notes to text.` });

                for (const key of keysToProcess) {
                    try {
                        // Fetch blob from data URL
                        const res = await fetch(drawings[key]);
                        const blob = await res.blob();

                        const formData = new FormData()
                        formData.append('image', blob, `${key}.jpg`)

                        const apiRes = await fetch('/api/recognize-handwriting', { method: 'POST', body: formData });
                        const data = await apiRes.json();

                        if (data.text) {
                            finalTexts[key] = (finalTexts[key] ? finalTexts[key] + '\n' : '') + data.text;
                        }
                    } catch (e) {
                        console.error(`Failed to convert ${key}`, e);
                    }
                }

                // Update state with converted text and clear drawings
                setConvertedText(finalTexts);
                setDrawings({});

                // Small delay to let React update state (important for Print)
                await new Promise(r => setTimeout(r, 500));
            }

            // 2. Save to DB
            const response = await fetch('/api/prescriptions/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patientId: resolvedPatientId,
                    appointmentId,
                    vitals: finalTexts.vitals || '',
                    diagnosis: finalTexts.diagnosis || '',
                    complaint: finalTexts.complaint || '',
                    examination: finalTexts.examination || '',
                    plan: finalTexts.plan || '',
                    medicines: selectedMedicines,
                    labTests: selectedLabs
                })
            })

            const data = await response.json()

            if (response.ok && data.success) {
                setLastSavedId(data.prescriptionId)
                if (isShareData) {
                    setIsSaving(false);
                    return data.prescriptionId;
                }

                if (!isPrint) {
                    toast({
                        title: "Prescription Saved",
                        description: "Your changes have been saved successfully.",
                    })
                    router.refresh()
                } else {
                    // Trigger Print
                    window.print();
                }
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (error: any) {
            console.error('Save error:', error)
            alert(`❌ Failed to save: ${error.message}`)
            return null;
        } finally {
            setIsSaving(false)
        }
    }

    const savePrescription = async (redirectToBill = false) => {
        // Redirect to bill logic needs separate handling if we reuse processDrawingsAndSave, 
        // but for now let's keep simple save logic separate or integrated.
        // Actually simplest is to reuse the new function for the actual saving part.

        await processDrawingsAndSave(false);
        // Note: The redirect logic from original savePrescription is skipped here for simplicity in this refactor step,
        // but normally we should preserve it. Re-adding minimal redirect support:
        if (redirectToBill && appointmentId && selectedMedicines.length > 0) {
            const medicineParams = encodeURIComponent(JSON.stringify(selectedMedicines))
            router.push(`/hms/billing/new?patientId=${resolvedPatientId}&medicines=${medicineParams}&appointmentId=${appointmentId}`)
        }
    }

    const handleWhatsappShare = async () => {
        setIsSharing(true);
        // Use processDrawingsAndSave to get ID
        const pId = await processDrawingsAndSave(false, true);

        if (!pId) {
            setIsSharing(false);
            return;
        }

        try {
            const res = await sharePrescriptionWhatsapp(pId!);
            if (res.success) {
                toast({
                    title: "WhatsApp",
                    description: String(res.message || "Sent successfully."),
                });
            } else {
                toast({
                    title: "Share Failed",
                    description: String(res.error || "Could not share prescription"),
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error(error);
            toast({
                title: "Error",
                description: "An unexpected error occurred",
                variant: "destructive"
            });
        } finally {
            setIsSharing(false);
        }
    }

    const content = (
        <div className={`flex flex-col h-full bg-slate-50/50 relative overflow-hidden ${isModal ? 'rounded-3xl shadow-2xl border border-white/20' : 'h-[92vh] max-w-[98vw] mx-auto border border-slate-200/60 rounded-2xl shadow-xl'}`}
             style={{ fontFamily: pdfConfig?.fontFamily === 'times' ? 'serif' : (pdfConfig?.fontFamily === 'courier' ? 'monospace' : 'inherit') }}>

            {/* PRINT-ONLY PROFESSIONAL HEADER (PRESCRIPTION PAD LOOK) */}
            <div className={`hidden print:flex flex-col w-full mb-10 pb-8 border-b-2 border-slate-900 
                ${hmsSettings?.opSlipPreprintedLetterhead ? 'opacity-0' : 'opacity-100'}
            `} style={{ height: hmsSettings?.opSlipPreprintedLetterhead ? `${hmsSettings.opSlipHeaderHeight || 4.5}cm` : 'auto' }}>
                {!hmsSettings?.opSlipPreprintedLetterhead && (
                    <div className={`flex flex-col gap-6 w-full ${pdfConfig?.headerAlignment === 'center' ? 'items-center text-center' : (pdfConfig?.headerAlignment === 'left' ? 'items-start text-left' : 'items-end text-right')}`}>
                        <div className={`flex items-center gap-6 ${pdfConfig?.headerAlignment === 'center' ? 'flex-col' : (pdfConfig?.headerAlignment === 'right' ? 'flex-row-reverse' : '')}`}>
                            {pdfConfig?.showLogo !== false && (
                                <div className="h-20 w-20 bg-slate-900 rounded-3xl flex items-center justify-center text-white font-black text-4xl shadow-2xl shadow-slate-900/20">
                                    {companyDetails?.company_name?.[0] || 'Z'}
                                </div>
                            )}
                            <div>
                                <h1 className="font-black tracking-tighter text-slate-900 leading-tight uppercase"
                                    style={{ fontSize: (pdfConfig?.hospitalNameSize || 16) * 2 }}>
                                    {companyDetails?.company_name || 'Hospital Name'}
                                </h1>
                                <p className="text-sm font-black text-slate-500 tracking-[0.2em] uppercase mt-2">Certified Clinical Consultation Pad</p>
                            </div>
                        </div>
                        {pdfConfig?.showContactInfo !== false && (
                            <div className="grid grid-cols-2 gap-x-12 text-slate-500 font-bold leading-relaxed max-w-2xl"
                                 style={{ fontSize: (pdfConfig?.addressSize || 10) }}>
                                <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {companyDetails?.address?.split('\n')[0] || 'Hospital Address'}</p>
                                <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {companyDetails?.phone || '+91 000-000-0000'}</p>
                                <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {companyDetails?.email || 'contact@hospital.com'}</p>
                                <p className="flex items-center gap-2"><Globe className="h-4 w-4" /> {companyDetails?.website || 'www.hospital.com'}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* PRINT-ONLY PATIENT BAR */}
            <div className="hidden print:grid grid-cols-3 gap-8 p-6 bg-slate-50 rounded-[2rem] mb-10 border border-slate-200">
                <div className="col-span-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Patient Subject</p>
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
                        {patientInfo?.first_name} {patientInfo?.last_name || ''}
                    </h2>
                    <p className="text-sm font-bold text-slate-500 mt-1">
                        {patientInfo?.age || '--'}Y • {patientInfo?.gender || '--'} • ID: {patientInfo?.patient_number || 'N/A'}
                    </p>
                </div>
                <div className="text-right flex flex-col justify-end">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Visit Date</p>
                    <p className="text-xl font-black text-slate-900">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                </div>
            </div>

            {/* Background Ambient Glow */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none" />
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 p-4 lg:p-6 flex justify-between items-center shrink-0 supports-[backdrop-filter]:bg-white/60 print:hidden">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                        <Stethoscope className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight">New Prescription</h1>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Clinical Workspace</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {labReportUrl && (
                        <a
                            href={labReportUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden md:flex items-center gap-2 px-4 py-2 bg-violet-100 text-violet-700 rounded-full text-xs font-bold hover:bg-violet-200 transition-colors border border-violet-200 animate-pulse"
                        >
                            <FileText className="h-4 w-4" />
                            View Lab Report
                        </a>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => processDrawingsAndSave(true)}
                        className="rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 print:hidden"
                        title="Print Prescription"
                    >
                        <Printer className="h-5 w-5" />
                    </Button>
                    {!isModal && (
                        <div className="hidden lg:flex items-center gap-2 text-sm text-slate-500 bg-slate-100/50 px-3 py-1.5 rounded-full border border-slate-200/50">
                            <Clock className="h-3.5 w-3.5" />
                            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </div>
                    )}
                    {isModal && (
                        <button
                            onClick={onClose || (() => router.back())}
                            className="h-10 w-10 flex items-center justify-center hover:bg-slate-100 rounded-full transition-all text-slate-400 hover:text-slate-600 hover:rotate-90"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    )}
                </div>
            </header>

            {/* Scrollable Content - 3 Column Grid */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 scroll-smooth custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1600px] mx-auto pb-24">

                    {/* LEFT COLUMN: Patient Info & Templates (Col Span 3) */}
                    <div className="lg:col-span-3 space-y-6 print:hidden">
                        {/* Patient Card */}
                        <div className="bg-white/70 backdrop-blur-md rounded-3xl p-5 border border-white/60 shadow-lg shadow-slate-200/50 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-purple-50/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="relative z-10">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <User className="h-3 w-3" /> Patient Details
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xl font-black text-slate-900 leading-tight">
                                            {patientInfo ? `${patientInfo.first_name} ${patientInfo.last_name || ''}` : 'Loading...'}
                                        </p>
                                        <p className="text-sm font-medium text-slate-500 mt-1">
                                            {patientInfo?.age ? `${patientInfo.age} Y` : '--'} • {patientInfo?.gender || '--'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                        <span className="px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-500 font-mono">
                                            {patientId?.substring(0, 8) || '####'}...
                                        </span>
                                        <span className="px-2 py-1 bg-green-50 text-green-700 rounded-lg text-[10px] font-bold border border-green-100">
                                            Active Visit
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Tools / Templates */}
                        <div className="bg-white/70 backdrop-blur-md rounded-3xl p-5 border border-white/60 shadow-lg shadow-slate-200/50">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Zap className="h-3 w-3" /> Quick Protocols
                            </h3>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={loadLastPrescription}
                                disabled={loadingPrevious}
                                className="w-full justify-start mb-3 bg-orange-50/50 text-orange-700 border-orange-200/50 hover:bg-orange-100 font-bold h-11 rounded-xl"
                            >
                                <Clock className="mr-2 h-4 w-4" />
                                {loadingPrevious ? 'Loading...' : 'Copy Last Rx'}
                            </Button>

                            <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto pr-1">
                                {dbTemplates.map((template, idx) => (
                                    <Button
                                        key={template.id || idx}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => applyTemplate(template)}
                                        className="w-full justify-start bg-indigo-50/50 text-indigo-700 border-indigo-100/50 hover:bg-indigo-100 font-bold h-10 rounded-xl transition-all"
                                    >
                                        {getTemplateIcon(template.name)}
                                        <span className="ml-2 truncate">{template.name}</span>
                                    </Button>
                                ))}
                                {dbTemplates.length === 0 && !loadingTemplates && (
                                    <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <p className="text-xs text-slate-400 font-medium">No master protocols.</p>
                                    </div>
                                )}
                            </div>
                            <button onClick={saveCurrentAsTemplate} className="w-full mt-3 py-2 text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-1">
                                <Plus className="h-3 w-3" /> Save findings as Protocol
                            </button>
                        </div>
                    </div>

                    {/* CENTER COLUMN: Clinical Canvas (Col Span 5) */}
                    <div className="lg:col-span-6 space-y-6">

                        {/* VITALS DISPLAY (ReadOnly / Nurse Entered) */}
                        <div className="bg-white/70 backdrop-blur-md rounded-3xl p-4 border border-white/60 shadow-sm relative overflow-hidden">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <ActivityIcon className="h-3 w-3" /> Latest Vitals (By Nurse)
                            </h3>
                            <div className="flex flex-wrap gap-3">
                                <div className="bg-red-50 text-red-700 px-3 py-2 rounded-xl border border-red-100 shadow-sm min-w-[80px]">
                                    <span className="text-[10px] uppercase font-bold text-red-400 block">Pulse</span>
                                    <span className="text-lg font-black">{vitalsData?.pulse || '--'} <span className="text-xs font-medium opacity-70">bpm</span></span>
                                </div>
                                <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-xl border border-blue-100 shadow-sm min-w-[80px]">
                                    <span className="text-[10px] uppercase font-bold text-blue-400 block">BP</span>
                                    <span className="text-lg font-black">{vitalsData?.systolic || '--'}/{vitalsData?.diastolic || '--'}</span>
                                </div>
                                <div className="bg-orange-50 text-orange-700 px-3 py-2 rounded-xl border border-orange-100 shadow-sm min-w-[80px]">
                                    <span className="text-[10px] uppercase font-bold text-orange-400 block">Temp</span>
                                    <span className="text-lg font-black">{vitalsData?.temperature || '--'} <span className="text-xs font-medium opacity-70">°F</span></span>
                                </div>
                                <div className="bg-teal-50 text-teal-700 px-3 py-2 rounded-xl border border-teal-100 shadow-sm min-w-[80px]">
                                    <span className="text-[10px] uppercase font-bold text-teal-400 block">SpO2</span>
                                    <span className="text-lg font-black">{vitalsData?.spo2 || '--'} <span className="text-xs font-medium opacity-70">%</span></span>
                                </div>
                                <div className="bg-slate-50 text-slate-700 px-3 py-2 rounded-xl border border-slate-200 shadow-sm min-w-[80px]">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Weight</span>
                                    <span className="text-lg font-black">{vitalsData?.weight || '--'} <span className="text-xs font-medium opacity-70">kg</span></span>
                                </div>
                            </div>
                        </div>

                        {/* CLINICAL SECTIONS (Text + Scribble Popup) */}
                        <div className="space-y-4">
                            {[
                                { title: 'DIAGNOSIS', height: 80, key: 'diagnosis' as keyof typeof convertedText, icon: Brain },
                                { title: 'PRESENTING COMPLAINT', height: 100, key: 'complaint' as keyof typeof convertedText, icon: AlertCircle },
                                { title: 'GENERAL EXAMINATION', height: 120, key: 'examination' as keyof typeof convertedText, icon: Search },
                                { title: 'PLAN', height: 80, key: 'plan' as keyof typeof convertedText, icon: FileText }
                            ].map((section, idx) => (
                                <div key={idx} className="bg-white rounded-3xl p-1 border border-slate-100 shadow-sm hover:shadow-md transition-shadow group relative">
                                    <div className="px-4 py-2 flex items-center justify-between border-b border-slate-50 mb-1">
                                        <div className="flex items-center gap-2">
                                            <section.icon className="h-3 w-3 text-slate-400" />
                                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{section.title}</h3>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setTypingSections(prev => ({ ...prev, [section.key]: !prev[section.key] }))}
                                                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${typingSections[section.key] ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600'}`}
                                                title={typingSections[section.key] ? "Switch to Scribble" : "Switch to Typing"}
                                            >
                                                <Edit3 className="h-3 w-3" /> {typingSections[section.key] ? 'Scribble Mode' : 'Type'}
                                            </button>
                                            {!typingSections[section.key] && (
                                                <button
                                                    onClick={() => openScribbleModal(section.key)}
                                                    className="bg-slate-100 hover:bg-blue-50 text-slate-400 hover:text-blue-600 p-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
                                                    title="Click to Scribble"
                                                >
                                                    <PenTool className="h-3 w-3" /> Scribble
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Content Area: Either Textarea or Scribble Trigger */}
                                    <div className="rounded-b-2xl overflow-hidden">
                                        {typingSections[section.key] ? (
                                            <textarea
                                                value={convertedText[section.key]}
                                                onChange={(e) => setConvertedText(prev => ({ ...prev, [section.key]: e.target.value }))}
                                                placeholder={`Type ${section.title.toLowerCase()}...`}
                                                className="w-full p-4 bg-transparent outline-none text-slate-700 text-sm leading-relaxed font-medium resize-none border-0 focus:ring-0"
                                                style={{ minHeight: section.height }}
                                            />
                                        ) : (
                                            <div
                                                onClick={() => openScribbleModal(section.key)}
                                                className="w-full min-h-[80px] p-4 bg-transparent cursor-pointer text-slate-700 text-sm leading-relaxed font-medium hover:bg-slate-50/50 transition-colors"
                                                style={{ minHeight: section.height }}
                                            >
                                                {drawings[section.key] ? (
                                                    <div className="relative w-full h-full">
                                                        <img src={drawings[section.key]} alt="Handwritten notes" className="max-w-full h-auto max-h-[120px] object-contain mix-blend-multiply opacity-80" />
                                                        <div className="absolute top-0 right-0 bg-yellow-100 text-yellow-800 text-[9px] px-1.5 py-0.5 rounded font-bold border border-yellow-200">
                                                            PENDING CONVERSION
                                                        </div>
                                                    </div>
                                                ) : convertedText[section.key] ? (
                                                    convertedText[section.key]
                                                ) : (
                                                    <span className="text-slate-400 italic">Tap to write {section.title.toLowerCase()}...</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Medicines & Labs (Col Span 3) */}
                    <div className="lg:col-span-3 space-y-6">

                        {/* Medicines Card */}
                        <div className="bg-white/70 backdrop-blur-md rounded-3xl p-5 border border-white/60 shadow-lg shadow-blue-100/20">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Pill className="h-3 w-3" /> Prescription
                            </h3>

                            {/* Search - Enhanced & Prominent */}
                            <div className="relative print:hidden group mb-6 z-50">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-blue-500">
                                    <Search className="h-6 w-6" />
                                </div>
                                <input
                                    type="text"
                                    value={medicineSearch}
                                    onChange={(e) => setMedicineSearch(e.target.value)}
                                    onKeyDown={handleMedicineKeyDown}
                                    placeholder="Search medicine (e.g. Paracetamol)..."
                                    className="w-full pl-12 pr-4 py-4 text-lg font-bold border-2 border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-sm placeholder-slate-300 text-slate-800"
                                    autoComplete="off"
                                />
                                {showMedicineDropdown && (
                                    <div className="absolute top-[calc(100%+8px)] left-0 z-[60] w-full bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-[350px] overflow-y-auto p-2 animate-in fade-in zoom-in-95 duration-100">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2">
                                            Found {filteredMedicines.length} results
                                        </div>
                                        {filteredMedicines.map((med, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => openMedicineModal(med)}
                                                onMouseEnter={() => setSelectedIndex(idx)}
                                                className={`p-3.5 cursor-pointer rounded-xl flex items-center justify-between transition-all group ${selectedIndex === idx ? 'bg-blue-600 shadow-md shadow-blue-200 scale-[1.01]' : 'hover:bg-slate-50'}`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className={`font-black text-base ${selectedIndex === idx ? 'text-white' : 'text-slate-800'}`}>{med.name}</span>
                                                    {med.genericName && (
                                                        <span className={`text-xs ${selectedIndex === idx ? 'text-blue-200' : 'text-slate-400'}`}>{med.genericName}</span>
                                                    )}
                                                </div>
                                                <Plus className={`h-5 w-5 ${selectedIndex === idx ? 'text-white' : 'text-slate-300'}`} />
                                            </div>
                                        ))}
                                        {medicineSearch.trim() && (
                                            <>
                                                <div className="h-px bg-slate-100 my-2" />
                                                <div
                                                    onClick={() => openMedicineModal({ name: medicineSearch.trim() })}
                                                    onMouseEnter={() => setSelectedIndex(filteredMedicines.length)}
                                                    className={`p-3.5 cursor-pointer rounded-xl flex items-center gap-3 transition-colors ${selectedIndex === filteredMedicines.length ? 'bg-indigo-600 shadow-md shadow-indigo-200' : 'bg-indigo-50/50 hover:bg-indigo-100'}`}
                                                >
                                                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${selectedIndex === filteredMedicines.length ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                                                        <Plus className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <span className={`font-bold block ${selectedIndex === filteredMedicines.length ? 'text-white' : 'text-indigo-900'}`}>Add Custom Medicine</span>
                                                        <span className={`text-xs font-semibold ${selectedIndex === filteredMedicines.length ? 'text-indigo-200' : 'text-indigo-600'}`}>"{medicineSearch}"</span>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Rx List */}
                            <div className="space-y-3 min-h-[200px]">
                                {selectedMedicines.length === 0 ? (
                                    <div className="text-center py-8 opacity-50">
                                        <Pill className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                                        <p className="text-xs text-slate-400 font-bold">No medicines added</p>
                                    </div>
                                ) : (
                                    selectedMedicines.map((med, idx) => (
                                        <div key={idx} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-colors group relative">
                                            <div onClick={() => openMedicineModal(med, idx)} className="cursor-pointer">
                                                <p className="font-black text-slate-800 text-sm">{med.name}</p>
                                                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium">
                                                    <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md">{med.dosage}</span>
                                                    <span>• {med.days} days</span>
                                                    <span>• {med.timing}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeMedicine(idx)}
                                                className="absolute top-3 right-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Labs Card */}
                        <div className="bg-white/70 backdrop-blur-md rounded-3xl p-5 border border-white/60 shadow-lg shadow-violet-100/20">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <ActivityIcon className="h-3 w-3" /> Lab Orders
                            </h3>

                            {/* Search */}
                            <div className="relative group mb-4 print:hidden">
                                <input
                                    id="lab-search-input"
                                    type="text"
                                    value={labSearch}
                                    onChange={(e) => setLabSearch(e.target.value)}
                                    onKeyDown={handleLabKeyDown}
                                    placeholder="Add Lab Tests (Type & Enter)..."
                                    className="w-full pl-4 pr-3 py-3 text-sm font-bold border border-slate-200 rounded-xl focus:border-violet-500 focus:ring-2 focus:ring-violet-100 outline-none transition-all shadow-sm"
                                />
                                {isSearchingLabs && <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-slate-400" />}
                                {showLabDropdown && (
                                    <div className="absolute z-[60] w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto p-2">
                                        {filteredLabs.map((test, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => {
                                                    addLabTest(test); // Keeps focus via logic update or just keeps it open if we change logic
                                                    // For now, let's just add it. The input is effectively cleared.
                                                    // To allow rapid entry, we should probably refucs the input.
                                                    // But standard behavior is to close.
                                                    // Let's rely on the input ref to keep it speedy?
                                                    // No, let's just make it easy to click multiple if we change UI, 
                                                    // but here the dropdown sits on top.
                                                    // actually, the user wants "easy input multiple".
                                                }}
                                                className="p-2.5 hover:bg-violet-50 cursor-pointer rounded-xl flex items-center justify-between text-sm"
                                            >
                                                <span className="font-bold text-slate-700">{test.name}</span>
                                                <Plus className="h-3 w-3 text-slate-300" />
                                            </div>
                                        ))}
                                        {labSearch.trim() && (
                                            <div
                                                onClick={() => addLabTest({ name: labSearch.trim(), id: crypto.randomUUID() })}
                                                className="p-2.5 bg-violet-50/50 hover:bg-violet-100 cursor-pointer rounded-xl flex items-center gap-2 mt-1"
                                            >
                                                <Plus className="h-3 w-3 text-violet-600" />
                                                <span className="font-bold text-violet-700 text-xs">Add Custom: {labSearch}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Lab List */}
                            <div className="flex flex-wrap gap-2">
                                {selectedLabs.map((lab, idx) => (
                                    <div key={idx} className="bg-violet-50 border border-violet-100 pl-3 pr-2 py-1.5 rounded-xl flex items-center gap-2">
                                        <span className="text-xs font-bold text-violet-700">{lab.name}</span>
                                        <button onClick={() => removeLabTest(lab.id)} className="hover:bg-violet-200/50 rounded-full p-0.5 text-violet-400 hover:text-violet-700 transition-colors print:hidden">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                                {selectedLabs.length === 0 && (
                                    <p className="text-xs text-slate-400 text-center w-full font-medium italic py-2">No labs ordered</p>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="sticky bottom-0 z-40 bg-white/80 backdrop-blur-md border-t border-slate-200/50 p-4 flex justify-between items-center print:hidden">
                <Button
                    variant="ghost"
                    onClick={onClose || (() => router.back())}
                    className="text-slate-500 font-bold hover:bg-slate-100 rounded-xl"
                >
                    Cancel
                </Button>

                <div className="flex gap-3">
                    <Button
                        onClick={handleWhatsappShare}
                        disabled={isSharing}
                        variant="outline"
                        className="border-green-200 bg-green-50 text-green-700 hover:bg-green-100 font-bold rounded-xl shadow-sm"
                    >
                        {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4 mr-2" />}
                        WhatsApp
                    </Button>
                    <Button
                        onClick={() => savePrescription(false)}
                        disabled={isSaving}
                        className="bg-slate-900 text-white hover:bg-slate-800 font-bold rounded-xl shadow-lg shadow-slate-900/20 px-6"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Prescription
                    </Button>
                    <Button
                        onClick={() => savePrescription(true)}
                        disabled={isSaving}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 px-8 flex items-center gap-2"
                    >
                        <Save className="h-4 w-4" />
                        Save
                    </Button>
                </div>
            </div>

            {/* SCRIBBLE MODAL */}
            <AnimatePresence>
                {scribbleModalOpen && (
                    <div className="absolute inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white rounded-3xl w-full max-w-4xl h-[70vh] flex flex-col shadow-2xl border border-white/40 overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                    <PenTool className="h-5 w-5 text-indigo-600" />
                                    Scribble Notes
                                    <span className="text-xs font-bold text-slate-400 uppercase bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                                        {scribbleTarget?.toUpperCase()}
                                    </span>
                                </h3>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={clearScribbleCanvas}
                                        className="text-slate-500 hover:text-red-500 border-slate-200"
                                    >
                                        <Eraser className="h-4 w-4 mr-1" /> Clear
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setScribbleModalOpen(false)}
                                    >
                                        <X className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-1 bg-white relative cursor-crosshair overflow-hidden group touch-none">
                                {/* Grid Pattern */}
                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                                    style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                                </div>
                                <canvas
                                    ref={scribbleCanvasRef}
                                    width={1000}
                                    height={600}
                                    className="w-full h-full touch-none"
                                    onPointerDown={(e) => startDrawing(e)}
                                    onPointerMove={draw}
                                    onPointerUp={stopDrawing}
                                    onPointerLeave={stopDrawing}
                                    onPointerCancel={stopDrawing}
                                />
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none opacity-50 text-xs font-medium text-slate-400 bg-white/80 px-3 py-1 rounded-full border border-slate-100 shadow-sm">
                                    Draw your thoughts freely
                                </div>
                            </div>

                            <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
                                <Button
                                    onClick={() => setScribbleModalOpen(false)}
                                    variant="ghost"
                                    className="font-bold text-slate-500"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={saveScribble}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 font-bold px-8"
                                >
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Done
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Medicine Modal - Maximized */}
            <AnimatePresence>
                {showMedicineModal && (
                    <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-3xl w-full max-w-6xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                        <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                            <Pill className="h-6 w-6" />
                                        </div>
                                        {currentMedicine?.name || 'Add Medicine'}
                                    </h3>
                                    <p className="text-sm text-slate-500 font-medium ml-[52px]">Configure dosage regimen and instructions</p>
                                </div>
                                <button
                                    onClick={() => setShowMedicineModal(false)}
                                    className="h-10 w-10 hover:bg-slate-200 rounded-full flex items-center justify-center transition-colors"
                                >
                                    <X className="h-6 w-6 text-slate-400" />
                                </button>
                            </div>

                            {/* Modal Body - Scrollable */}
                            <div className="flex-1 overflow-y-auto p-8">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

                                    {/* LEFT COLUMN: DOSAGE & FREQUENCY */}
                                    <div className="lg:col-span-7 space-y-8">

                                        {/* Standard Frequencies */}
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-4 flex items-center gap-2">
                                                <ActivityIcon className="h-4 w-4" /> Standard Regimens (Morning - Afternoon - Evening - Night)
                                            </label>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                                {['1-0-1', '1-0-0', '0-0-1', '1-1-1', '1-0-0-1', '1-1-1-1'].map(d => (
                                                    <button
                                                        key={d}
                                                        onClick={() => setModalDosage(d)}
                                                        className={`h-16 rounded-2xl text-lg font-black border-2 transition-all flex items-center justify-center gap-2 ${modalDosage === d
                                                            ? 'bg-blue-600 text-white border-blue-600 shadow-xl shadow-blue-200 scale-105'
                                                            : 'bg-white text-slate-600 border-slate-100 hover:border-blue-200 hover:bg-blue-50'}`}
                                                    >
                                                        {d.split('-').map((val, i) => (
                                                            <span key={i} className={`flex flex-col items-center ${val === '1' ? 'opacity-100' : 'opacity-30'}`}>
                                                                <span className="text-[8px] uppercase font-bold text-current opacity-60">
                                                                    {['M', 'A', 'E', 'N'][i]}
                                                                </span>
                                                                <span className="text-xl leading-none">{val}</span>
                                                            </span>
                                                        ))}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Manual Input */}
                                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3">Custom Pattern</label>
                                            <div className="flex items-center gap-4">
                                                <input
                                                    value={modalDosage}
                                                    onChange={e => setModalDosage(e.target.value)}
                                                    className="flex-1 p-5 bg-white border-2 border-slate-200 rounded-2xl font-black text-slate-900 text-center tracking-[0.5em] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all text-3xl"
                                                    placeholder="0-0-0-0"
                                                />
                                                <div className="text-slate-400 text-sm font-medium max-w-[150px] leading-tight">
                                                    Enter dosage format like <strong>1-0-1</strong> or <strong>1/2-0-1/2</strong>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* RIGHT COLUMN: TIMING & DURATION */}
                                    <div className="lg:col-span-5 space-y-8">

                                        {/* Duration */}
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-4 flex items-center gap-2">
                                                <Clock className="h-4 w-4" /> Duration
                                            </label>
                                            <div className="flex items-center gap-4">
                                                <div className="flex-1 relative">
                                                    <input
                                                        type="number"
                                                        value={modalDays}
                                                        onChange={e => setModalDays(e.target.value)}
                                                        className="w-full p-5 bg-white border-2 border-slate-200 rounded-2xl font-black text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all text-3xl pl-6"
                                                    />
                                                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">Days</span>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <button onClick={() => setModalDays('3')} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 text-sm">3 D</button>
                                                    <button onClick={() => setModalDays('5')} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 text-sm">5 D</button>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <button onClick={() => setModalDays('7')} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 text-sm">1 W</button>
                                                    <button onClick={() => setModalDays('30')} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 text-sm">1 M</button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Timing */}
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-4 flex items-center gap-2">
                                                <Zap className="h-4 w-4" /> Instruction / Timing
                                            </label>
                                            <div className="grid grid-cols-1 gap-3">
                                                {['After Food', 'Before Food', 'With Food', 'Bedtime'].map(t => (
                                                    <button
                                                        key={t}
                                                        onClick={() => setModalTiming(t)}
                                                        className={`p-4 rounded-xl text-left font-bold border-2 transition-all flex items-center justify-between group ${modalTiming === t
                                                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                                                            : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200'}`}
                                                    >
                                                        <span>{t}</span>
                                                        {modalTiming === t && <CheckCircle2 className="h-5 w-5 text-indigo-600" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-4">
                                <Button onClick={() => setShowMedicineModal(false)} variant="ghost" className="h-14 px-8 rounded-2xl font-bold text-slate-500 hover:bg-slate-200 text-base">Cancel</Button>
                                <Button onClick={saveMedicineFromModal} className="h-14 px-10 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-xl shadow-blue-200 text-lg flex items-center gap-3">
                                    <CheckCircle2 className="h-6 w-6" /> Save Medicine
                                </Button>
                            </div>

                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )

    if (isModal) {
        return (
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4"
                    onClick={() => router.back()}
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 20, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.9, y: 20, opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="w-[98vw] h-[95vh] rounded-3xl shadow-2xl overflow-hidden bg-white"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {content}
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        )
    }

    // Fetch branding and settings
    useEffect(() => {
        async function loadSettings() {
            const [pdfRes, compRes, hmsRes] = await Promise.all([
                getPDFSettings(undefined, undefined),
                getCompanyDetails(),
                getHMSSettings()
            ])
            if (pdfRes.success) setPdfConfig(pdfRes.settings)
            if (compRes) setCompanyDetails(compRes)
            if (hmsRes.success) setHmsSettings(hmsRes.settings)
        }
        loadSettings()
    }, [])

    return content
}

function Stethoscope(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M4.8 2.3A.3.3 0 1 0 5 2a.3.3 0 1 0-.2.3Z" />
            <path d="M10 2v2" />
            <path d="M14 2v2" />
            <path d="M3 10v2a2 2 0 0 0 2 2h2" />
            <path d="M17 14h2a2 2 0 0 0 2-2v-2" />
            <path d="M12 14v6" />
            <path d="M7 20h10" />
            <path d="M3 6h18" />
        </svg>
    )
}

function Receipt(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M4 2v20l2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2V2l-2 2-2-2-2 2-2-2-2 2-2-2-2 2-2-2Z" />
            <path d="M16 8h-9" />
            <path d="M16 12h-9" />
            <path d="M15 16h-8" />
        </svg>
    )
}
