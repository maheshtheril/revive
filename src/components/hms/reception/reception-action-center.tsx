'use client'

import { cn } from "@/lib/utils"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    UserPlus, CalendarPlus, LogIn, CreditCard,
    PhoneIncoming, IdCard, Users, Search,
    Clock, Stethoscope, ChevronRight, Filter, ChevronDown, CheckCircle, Smartphone, MoreVertical, Edit, Activity, IndianRupee,
    Printer, Wallet, Banknote, Fingerprint, Receipt, LayoutDashboard, Kanban, AlertTriangle, Syringe, Zap, Eye, EyeOff, Wifi, Bed as BedIcon,
    RotateCcw, ShieldAlert, Trash2, Loader2, History
} from "lucide-react"
import { ExpenseDialog } from "./expense-dialog"
import { PettyCashVoucher } from "./petty-cash-voucher"
import { ShiftManager } from "./shift-manager"
import PunchWidget from "@/components/attendance/punch-widget"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal } from "@/components/ui/dropdown-menu"
import { CreatePatientForm } from "@/components/hms/create-patient-form"
import { AppointmentForm } from "@/components/appointments/appointment-form"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { updateAppointmentStatus } from "@/app/actions/appointment"
import { searchPatients } from "@/app/actions/patient-search"
import { getInitialInvoiceData, voidPayment } from "@/app/actions/billing"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import { VisitTypeBadge } from "../visit-type-badge"
import { MessageSquare } from "lucide-react"
import { AdmissionDialog } from "@/components/hms/patients/admission-dialog"
import { OpSlipDialog } from "./op-slip-dialog"
import { WardManager } from "@/components/wards/ward-manager"
import { CompactInvoiceEditor } from "@/components/billing/invoice-editor-compact"

interface ReceptionActionCenterProps {
    todayAppointments: any[]
    patients: any[]
    doctors: any[]
    dailyCollection: number
    collectionBreakdown: Record<string, number>
    todayPayments?: any[]
    todayExpenses?: any[]
    totalExpenses?: number
    draftCount?: number
    availableBeds?: number
    branches?: any[]
    isAdmin?: boolean
    billableItems?: any[]
    taxConfig?: any
    uoms?: any[]
    currency?: string
    hospitalInfo?: any
}

import { DashboardDateFilter } from "../dashboard-date-filter"

export function ReceptionActionCenter({
    todayAppointments,
    patients,
    doctors,
    dailyCollection = 0,
    collectionBreakdown = {},
    todayPayments = [],
    todayExpenses = [],
    totalExpenses = 0,
    draftCount = 0,
    availableBeds = 0,
    branches = [],
    isAdmin = false,
    billableItems = [],
    taxConfig = { defaultTax: null, taxRates: [] },
    uoms = [],
    currency = '₹',
    hospitalInfo = null
}: ReceptionActionCenterProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [viewMode, setViewMode] = useState<'board' | 'list'>('list')
    const [isPrivacyMode, setIsPrivacyMode] = useState(false)
    const [currentTime, setCurrentTime] = useState(new Date())
    const [activeModal, setActiveModal] = useState<string | null>(null)
    const [editingAppointment, setEditingAppointment] = useState<any>(null)
    const [selectedDoctor, setSelectedDoctor] = useState<string>("all")
    const [selectedStatus, setSelectedStatus] = useState<string>("all")
    const [searchQuery, setSearchQuery] = useState("")
    const [patientSearchQuery, setPatientSearchQuery] = useState("")
    const [statusLoading, setStatusLoading] = useState<string | null>(null)
    const [viewingPayment, setViewingPayment] = useState<any>(null)
    const [isTerminalMinimized, setIsTerminalMinimized] = useState(false)
    const [selectedAptForBilling, setSelectedAptForBilling] = useState<any>(null)
    const [isPaymentsOpen, setIsPaymentsOpen] = useState(false)
    const [voidingId, setVoidingId] = useState<string | null>(null)
    const [livePatients, setLivePatients] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)

    // Live Search for Master Registry
    useEffect(() => {
        if (!patientSearchQuery || patientSearchQuery.length < 1) {
            setLivePatients([])
            return
        }

        const timer = setTimeout(async () => {
            setIsSearching(true)
            try {
                const results = await searchPatients(patientSearchQuery)
                setLivePatients(results)
            } finally {
                setIsSearching(false)
            }
        }, 500)

        return () => clearTimeout(timer)
    }, [patientSearchQuery])

    // Update time every minute for aging timers
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000)
        return () => clearInterval(timer)
    }, [])

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+N or Cmd+N - New Patient
            if ((e.ctrlKey || e.metaKey || e.altKey) && e.key === 'n') {
                e.preventDefault()
                if (activeModal === 'appointment' || activeModal === 'edit-appointment') {
                    // Handled inside form
                } else {
                    router.push('/hms/patients/new')
                    toast({
                        title: "Opening New Patient Form",
                        description: "Shortcut: Alt+N",
                    })
                }
            }

            // Ctrl+A or Cmd+A - New Appointment
            if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !activeModal) {
                e.preventDefault()
                setEditingAppointment(null)
                setActiveModal('appointment')
                toast({
                    title: "Opening New Appointment",
                    description: "Shortcut: Ctrl+A",
                })
            }

            // Ctrl+B or Cmd+B - Billing
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault()
                router.push('/hms/billing')
                toast({
                    title: "Opening Billing",
                    description: "Shortcut: Ctrl+B",
                })
            }

            // Ctrl+Shift+B - Bed Management
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'B') {
                e.preventDefault()
                setActiveModal('beds')
                toast({
                    title: "Opening Bed Management",
                    description: "Shortcut: Ctrl+Shift+B",
                })
            }

            // Escape - Close Modal
            if (e.key === 'Escape' && activeModal) {
                setActiveModal(null)
                setEditingAppointment(null)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [activeModal, router, toast])

    const handleEditClick = (apt: any) => {
        setEditingAppointment(apt)
        setActiveModal('edit-appointment')
    }

    const handleAction = (actionId: string) => {
        if (actionId === 'voucher') {
            router.push('/hms/reception/registration-voucher')
            return
        }
        if (actionId === 'billing') {
            router.push('/hms/billing')
            return
        }
        if (actionId === 'beds') {
            setActiveModal('beds')
            return
        }
        if (actionId === 'appointment') {
            setEditingAppointment(null)
        }
        setActiveModal(actionId as any)
    }

    // Filter Logic for Appointments
    // Filter Logic for Appointments
    const filteredAppointments = todayAppointments.filter(apt => {
        const matchesDoctor = selectedDoctor === 'all' || apt.clinician?.id === selectedDoctor
        const matchesStatus = selectedStatus === 'all' || apt.status === selectedStatus

        const q = searchQuery.toLowerCase();
        const contact = apt.patient?.contact || {};
        const phone = contact.phone || contact.mobile || "";

        const matchesSearch = q === '' ||
            `${apt.patient?.first_name} ${apt.patient?.last_name}`.toLowerCase().includes(q) ||
            apt.patient?.patient_number?.toLowerCase().includes(q) ||
            phone.includes(q)

        return matchesDoctor && matchesStatus && matchesSearch
    })

    // Filter Logic for Patients
    const filteredPatients = (() => {
        const q = patientSearchQuery.toLowerCase()
        if (!q) return patients.slice(0, 10) // Show recent patients if no query

        // Start with local patients
        let filtered = patients.filter(p => {
            const fullName = `${p.first_name} ${p.last_name}`.toLowerCase()
            const contact = p.contact || {}
            const phone = contact.phone || contact.mobile || ""
            return fullName.includes(q) || p.patient_number?.toLowerCase().includes(q) || phone.includes(q)
        })

        // Add live results that aren't already in filtered
        const localIds = new Set(filtered.map(p => p.id))
        livePatients.forEach(p => {
            if (!localIds.has(p.id)) {
                filtered.push(p)
            }
        })

        return filtered
    })()

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        setStatusLoading(id)
        const result = await updateAppointmentStatus(id, newStatus)
        setStatusLoading(null)

        if (result.success) {
            toast({ title: "Status Updated", description: `Appointment marked as ${newStatus}` })
            router.refresh()
        } else {
            toast({ title: "Error", description: "Failed to update status", variant: "destructive" })
        }
    }

    const handleVoidPayment = async (paymentId: string) => {
        if (!confirm("Are you sure you want to VOID this payment? This will reopen the invoice and revert registration status if applicable.")) return;

        setVoidingId(paymentId);
        try {
            const res: any = await voidPayment(paymentId, "Voided from Reception Dashboard");
            if (res.success) {
                toast({ title: "Payment Voided", description: "Invoice reopened and patient status updated." });
                router.refresh();
            } else {
                toast({ title: "Void Failed", description: res.error || "Unknown error", variant: "destructive" });
            }
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setVoidingId(null);
        }
    }

    const maskName = (str: string) => {
        if (!str || !isPrivacyMode) return str;
        if (str.length <= 2) return str[0] + "*";
        return str[0] + "*".repeat(str.length - 2) + str[str.length - 1];
    };

    const doctorOptions = [
        { id: 'all', label: 'All Doctors', subLabel: 'Show full schedule' },
        ...doctors.map(d => ({
            id: d.id,
            label: `${d.salutation || 'Dr.'} ${d.first_name} ${d.last_name || ''}`.trim() + (doctors.filter(doc => doc.first_name === d.first_name && doc.last_name === d.last_name).length > 1 ? ` (${d.id.slice(-4)})` : ''),
            subLabel: d.hms_specializations?.[0]?.name || d.role || 'Institutional Personnel'
        }))
    ]

    const actions = [
        { id: 'voucher', title: 'Reg Voucher', icon: CreditCard, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-100 dark:border-orange-800' },
        { id: 'appointment', title: 'OP/IP Registration', icon: CalendarPlus, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-100 dark:border-blue-800' },
        { id: 'billing', title: 'IP/OP Billing', icon: CreditCard, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-100 dark:border-violet-800' },
        { id: 'beds', title: 'Bed Units', icon: BedIcon, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-100 dark:border-indigo-800' },
        { id: 'expense', title: 'Expense', icon: Wallet, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-800' },
        { id: 'shift', title: 'Cash Counter', icon: Banknote, color: 'text-slate-600', bg: 'bg-slate-50 dark:bg-slate-800/50', border: 'border-slate-200 dark:border-slate-700' },
    ]

    const [isMounted, setIsMounted] = useState(false)
    useEffect(() => { setIsMounted(true) }, [])

    if (!isMounted) return (
        <div className="flex-1 space-y-6 pt-6 p-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
            <div className="flex items-center gap-4 px-6">
                <div className="h-10 w-48 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-2xl" />
                <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-2xl" />
            </div>
            <div className="px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-32 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-[2.5rem]" />
                ))}
            </div>
        </div>
    )

    return (
        <div className="flex-1 space-y-6 pt-6 overflow-x-hidden animate-in fade-in duration-500 relative">
            {/* GLOBAL DATE HUB & LIVE PULSE */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Front <span className="text-indigo-600">Office</span></h1>
                        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 shadow-sm shrink-0">
                            <div className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-tighter text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <Wifi className="h-2.5 w-2.5" /> LIVE PULSE
                            </span>
                        </div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Daily Operations Hub • World Standard Triage</p>
                </div>

                <div className="w-full md:w-auto flex justify-end">
                    <DashboardDateFilter />
                </div>
            </div>

            {/* TOP STATS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/20 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expected</p>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white">{todayAppointments.length}</h3>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                        <Users className="h-5 w-5 text-indigo-500" />
                    </div>
                </Card>
                <Card className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/20 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">In Waiting</p>
                        <h3 className="text-xl font-black text-blue-600">{todayAppointments.filter(a => ['arrived', 'checked_in'].includes(a.status)).length}</h3>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-blue-500" />
                    </div>
                </Card>
                <Link href="/hms/billing?status=draft" className="block cursor-pointer">
                    <Card className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/20 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:shadow-md transition-all hover:ring-2 hover:ring-orange-500/20">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Draft Bills</p>
                            <h3 className="text-xl font-black text-orange-600">{draftCount}</h3>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                            <Activity className="h-5 w-5 text-orange-500" />
                        </div>
                    </Card>
                </Link>
                <div onClick={() => setActiveModal('beds')} className="block cursor-pointer">
                    <Card className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/20 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:shadow-md transition-all hover:ring-2 hover:ring-indigo-500/20">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Beds Vacant</p>
                            <h3 className="text-xl font-black text-indigo-600">{availableBeds}</h3>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                            <BedIcon className="h-5 w-5 text-indigo-500" />
                        </div>
                    </Card>
                </div>
                <Link href="/hms/billing?status=pending" className="block cursor-pointer">
                    <Card className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800 shadow-sm flex items-center justify-between group hover:shadow-md transition-all hover:ring-2 hover:ring-emerald-500/20">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Awaiting Billing</p>
                            <h3 className="text-xl font-black text-emerald-700 dark:text-emerald-400">
                                {todayAppointments.filter(a => (a.status === 'completed' || a.hasPrescription) && a.invoiceStatus !== 'paid').length}
                            </h3>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                            <IndianRupee className="h-5 w-5 text-emerald-600" />
                        </div>
                    </Card>
                </Link>
            </div>

            {/* BILLING HUB - IMMEDIATE ACTION (NEW) */}
            {todayAppointments.some(a => (a.status === 'completed' || a.hasPrescription) && a.invoiceStatus !== 'paid') && (
                <div className="bg-gradient-to-r from-orange-500 to-amber-600 rounded-3xl p-1 shadow-xl shadow-orange-200/50 animate-in slide-in-from-top-4 duration-500">
                    <div className="bg-white dark:bg-slate-950 rounded-[1.4rem] p-5 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                            <div className="h-16 w-16 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 shrink-0">
                                <CreditCard className="h-8 w-8 animate-bounce" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">
                                    Billing <span className="text-orange-600">Action Required</span>
                                </h2>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                                    {todayAppointments.filter(a => (a.status === 'completed' || a.hasPrescription) && a.invoiceStatus !== 'paid').length} Patients finished consultation & waiting for checkout
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {todayAppointments
                                .filter(a => (a.status === 'completed' || a.hasPrescription) && a.invoiceStatus !== 'paid')
                                .slice(0, 3)
                                .map(apt => (
                                    <Button
                                        key={apt.id}
                                        variant="outline"
                                        size="lg"
                                        onClick={() => router.push(`/hms/billing/new?appointmentId=${apt.id}&patientId=${apt.patient.id}`)}
                                        className="h-14 px-6 rounded-2xl border-2 border-orange-100 hover:border-orange-500 hover:bg-orange-50 transition-all flex items-center gap-3 group"
                                    >
                                        <Avatar className="h-8 w-8 border-2 border-white">
                                            <AvatarFallback className="text-[10px] font-bold bg-orange-100 text-orange-600">
                                                {apt.patient?.first_name?.[0]}{apt.patient?.last_name?.[0]}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="text-left">
                                            <p className="text-xs font-black text-slate-800 uppercase leading-none">{apt.patient?.first_name}</p>
                                            <p className="text-[9px] font-bold text-orange-500 mt-1">COLLECT FEES</p>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-orange-300 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                ))}
                            {todayAppointments.filter(a => a.status === 'completed' && a.invoiceStatus !== 'paid').length > 3 && (
                                <Button
                                    variant="ghost"
                                    onClick={() => router.push('/hms/billing?status=pending')}
                                    className="h-14 px-6 rounded-2xl font-black text-xs text-orange-500 hover:text-orange-700 uppercase tracking-widest"
                                >
                                    View All +{todayAppointments.filter(a => (a.status === 'completed' || a.hasPrescription) && a.invoiceStatus !== 'paid').length - 3}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* DRAFT ALERT */}
            {draftCount > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-orange-50/50 dark:bg-orange-950/30 backdrop-blur-md border border-orange-100 dark:border-orange-900/50 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm"
                >
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center shrink-0">
                            <CreditCard className="h-6 w-6 text-orange-600" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white">Action Required: {draftCount} Draft Invoices</h4>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">You have pending draft invoices that need to be finalized and printed for patients.</p>
                        </div>
                    </div>
                    <Button
                        asChild
                        className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl px-6"
                    >
                        <Link href="/hms/billing?status=draft">Process Drafts</Link>
                    </Button>
                </motion.div>
            )}



            {/* MAIN CONTENT AREA */}
            <div className="flex flex-col xl:flex-row gap-8 min-h-[700px]">
                {/* LEFT: FLOW & LIST */}
                <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-600/20 dark:shadow-indigo-500/10 text-white">
                                <Clock className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic flex items-center gap-2">
                                    Patient Flow Monitor
                                    <Badge className="bg-amber-500 text-white border-none text-[8px] animate-pulse">ELITE ENGINE</Badge>
                                </h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">World Standard Triage</p>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsPrivacyMode(!isPrivacyMode)}
                                className={`p-2 rounded-lg border transition-all flex items-center gap-2 ${isPrivacyMode ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-slate-200 text-slate-400'}`}
                            >
                                {isPrivacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                <span className="text-[10px] font-black uppercase">Privacy</span>
                            </button>

                            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-1 flex items-center">
                                <button onClick={() => setViewMode('board')} className={`p-1.5 rounded-md transition-all ${viewMode === 'board' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                                    <Kanban className="h-4 w-4" />
                                </button>
                                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                                    <LayoutDashboard className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                                    <SelectTrigger className="h-9 w-[180px] bg-white dark:bg-slate-800 border-none shadow-none text-xs font-bold text-slate-900 dark:text-slate-100">
                                        <SelectValue placeholder="All Doctors" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                        {doctorOptions.map(d => (
                                            <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                    <SelectTrigger className="h-9 w-[130px] bg-white dark:bg-slate-800 border-none shadow-none text-xs font-bold text-slate-900 dark:text-slate-100">
                                        <SelectValue placeholder="All Status" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                        <SelectItem value="all">All Flows</SelectItem>
                                        <SelectItem value="scheduled">Upcoming</SelectItem>
                                        <SelectItem value="arrived">Waiting</SelectItem>
                                        <SelectItem value="checked_in">Checked In</SelectItem>
                                        <SelectItem value="confirmed">Sent In</SelectItem>
                                        <SelectItem value="in_progress">Consulting</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Quick Search..."
                                    className="pl-9 h-9 w-[180px] text-xs bg-slate-100 dark:bg-slate-800 border-none shadow-none focus-visible:ring-1 focus-visible:ring-indigo-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {viewMode === 'board' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full min-h-[600px] overflow-x-auto pb-4">
                            {/* COL 1: WAITING */}
                            <div className="flex flex-col gap-3 min-w-[280px]">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                                        1. OP Waiting / Triage
                                    </h3>
                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500">
                                        {filteredAppointments.filter(a => ['scheduled', 'arrived', 'checked_in'].includes(a.status)).length}
                                    </Badge>
                                </div>
                                <div className="flex-1 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-2 space-y-3 overflow-y-auto max-h-[700px] custom-scrollbar">
                                    {filteredAppointments
                                        .filter(a => ['scheduled', 'arrived', 'checked_in'].includes(a.status))
                                        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                                        .map(apt => (
                                            <PatientCard
                                                key={apt.id}
                                                apt={apt}
                                                type="waiting"
                                                isPrivacyMode={isPrivacyMode}
                                                currentTime={currentTime}
                                                router={router}
                                                handleStatusUpdate={handleStatusUpdate}
                                                statusLoading={statusLoading}
                                                hospitalInfo={hospitalInfo}
                                                onAction={() => handleStatusUpdate(apt.id, apt.status === 'scheduled' ? 'arrived' : 'confirmed')}
                                                onEdit={() => handleEditClick(apt)}
                                            />
                                        ))}
                                </div>
                            </div>

                            {/* COL 2: CONSULTATION / LABS */}
                            <div className="flex flex-col gap-3 min-w-[280px]">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-indigo-500 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce"></div>
                                        2. Clinical Consultation
                                    </h3>
                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600">
                                        {filteredAppointments.filter(a => ['confirmed', 'in_progress'].includes(a.status) || (a.status === 'completed' && a.labStatus === 'pending')).length}
                                    </Badge>
                                </div>
                                <div className="flex-1 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30 p-2 space-y-3 overflow-y-auto max-h-[700px] custom-scrollbar">
                                    {filteredAppointments
                                        .filter(a => ['confirmed', 'in_progress'].includes(a.status) || (a.status === 'completed' && a.labStatus === 'pending'))
                                        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                                        .map(apt => (
                                            <PatientCard
                                                key={apt.id}
                                                apt={apt}
                                                type="running"
                                                isPrivacyMode={isPrivacyMode}
                                                currentTime={currentTime}
                                                router={router}
                                                handleStatusUpdate={handleStatusUpdate}
                                                statusLoading={statusLoading}
                                                hospitalInfo={hospitalInfo}
                                                onAction={() => { }}
                                                onEdit={() => handleEditClick(apt)}
                                                onBill={() => setSelectedAptForBilling(apt)}
                                            />
                                        ))}
                                </div>
                            </div>

                            {/* COL 3: BILLING PENDING */}
                            <div className="flex flex-col gap-3 min-w-[280px]">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-orange-500 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                                        3. Billing / Discharge
                                    </h3>
                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-orange-50 dark:bg-orange-900/30 text-orange-600">
                                        {filteredAppointments.filter(a => (a.status === 'completed' || a.hasPrescription) && a.invoiceStatus !== 'paid').length}
                                    </Badge>
                                </div>
                                <div className="flex-1 bg-orange-50/30 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/30 p-2 space-y-3 overflow-y-auto max-h-[700px] custom-scrollbar">
                                    {filteredAppointments
                                        .filter(a => (a.status === 'completed' || a.hasPrescription) && a.invoiceStatus !== 'paid')
                                        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                                        .map(apt => (
                                            <PatientCard
                                                key={apt.id}
                                                apt={apt}
                                                type="billing"
                                                isPrivacyMode={isPrivacyMode}
                                                currentTime={currentTime}
                                                router={router}
                                                handleStatusUpdate={handleStatusUpdate}
                                                statusLoading={statusLoading}
                                                hospitalInfo={hospitalInfo}
                                                onAction={() => setSelectedAptForBilling(apt)}
                                                onEdit={() => handleEditClick(apt)}
                                                onBill={() => setSelectedAptForBilling(apt)}
                                            />
                                        ))}
                                </div>
                            </div>

                            {/* COL 4: COMPLETED */}
                            <div className="flex flex-col gap-3 min-w-[280px]">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                                        4. Past / Discharged
                                    </h3>
                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600">
                                        {filteredAppointments.filter(a => a.status === 'completed' && a.invoiceStatus === 'paid').length}
                                    </Badge>
                                </div>
                                <div className="flex-1 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-2 space-y-3 overflow-y-auto max-h-[700px] custom-scrollbar">
                                    {filteredAppointments.filter(a => a.status === 'completed' && a.invoiceStatus === 'paid').map(apt => (
                                        <PatientCard
                                            key={apt.id}
                                            apt={apt}
                                            type="completed"
                                            isPrivacyMode={isPrivacyMode}
                                            currentTime={currentTime}
                                            router={router}
                                            handleStatusUpdate={handleStatusUpdate}
                                            statusLoading={statusLoading}
                                            hospitalInfo={hospitalInfo}
                                            onAction={() => { }}
                                            onEdit={() => handleEditClick(apt)}
                                            onBill={() => setSelectedAptForBilling(apt)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <Card className="border border-slate-100 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900 overflow-hidden flex-1 h-full">
                            <div className="overflow-y-auto max-h-[700px] custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 bg-slate-50/90 dark:bg-slate-800/90 backdrop-blur-md z-10">
                                        <tr className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest border-b border-slate-100 dark:border-slate-800">
                                            <th className="px-6 py-4">Time</th>
                                            <th className="px-6 py-4">Patient</th>
                                            <th className="px-6 py-4">Type</th>
                                            <th className="px-6 py-4">Doctor</th>
                                            <th className="px-6 py-4">Bed Unit</th>
                                            <th className="px-6 py-4 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {filteredAppointments.map((apt) => {
                                            const isEmergency = apt.type === 'emergency' || apt.tags?.includes('EMERGENCY');
                                            const isUrgent = apt.priority === 'urgent';
                                            const isHigh = apt.priority === 'high';
                                            const isCritical = isEmergency || isUrgent || isHigh || apt.tags?.some((t: string) => ['ACCIDENT', 'SUICIDE_ATTEMPT', 'MLC'].includes(t));

                                            const isPendingBilling = apt.status === 'completed' && apt.invoiceStatus !== 'paid';
                                            const isPaid = apt.invoiceStatus === 'paid';

                                            let rowColor = 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50';
                                            if (isEmergency) rowColor = 'bg-red-100/60 hover:bg-red-200/60 dark:bg-red-950/40 dark:hover:bg-red-900/40 border-l-4 border-l-red-600';
                                            else if (isUrgent) rowColor = 'bg-orange-50/60 hover:bg-orange-100/60 dark:bg-orange-950/20 dark:hover:bg-orange-900/20 border-l-4 border-l-orange-500';
                                            else if (isHigh) rowColor = 'bg-amber-50/40 hover:bg-amber-100/40 dark:bg-amber-950/10 dark:hover:bg-amber-900/10 border-l-4 border-l-amber-400';
                                            else if (isPendingBilling) rowColor = 'bg-yellow-50/80 hover:bg-yellow-100/80 dark:bg-amber-900/20 dark:hover:bg-amber-800/30 border-l-4 border-l-yellow-500';
                                            else if (isPaid) rowColor = 'bg-emerald-50/60 hover:bg-emerald-100/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/20 border-l-4 border-l-emerald-500';

                                            return (
                                                <tr key={apt.id} className={`group transition-colors ${rowColor}`}>
                                                    <td className="px-6 py-5">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                                                {new Date(apt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                            {apt.token_number && (
                                                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 mt-1 uppercase">
                                                                    #Token {apt.token_number}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-9 w-9 border-2 border-white dark:border-slate-800">
                                                                <AvatarFallback className="text-xs font-bold">
                                                                    {isPrivacyMode ? '**' : `${apt.patient?.first_name?.[0]}${apt.patient?.last_name?.[0]}`}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <div className="text-sm font-bold">{maskName(apt.patient?.first_name)} {maskName(apt.patient?.last_name)}</div>
                                                                <div className="text-[10px] text-slate-500">{apt.patient?.patient_number}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex flex-col gap-1">
                                                            <VisitTypeBadge type={apt.type || 'consultation'} />
                                                            {isUrgent && <Badge className="text-[8px] bg-orange-500 text-white w-fit px-1 h-3 label uppercase">Urgent</Badge>}
                                                            {isHigh && <Badge className="text-[8px] bg-amber-500 text-white w-fit px-1 h-3 label uppercase">High</Badge>}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                            <Stethoscope className="h-3 w-3" />
                                                            <span>Dr. {apt.clinician?.first_name} {apt.clinician?.last_name?.[0]}.</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        {apt.assigned_bed ? (
                                                            <div className="flex items-center gap-1.5 p-1.5 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50 w-fit">
                                                                <BedIcon className="h-3.5 w-3.5" />
                                                                <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                                                                    {apt.assigned_ward} / {apt.assigned_bed}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-300 italic font-medium uppercase tracking-widest">Out Patient</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-5 text-right relative">
                                                        <div className="flex justify-end gap-2 items-center">
                                                            <div className="flex items-center gap-2">                                                                 <AdmissionDialog
                                                                patientId={apt.patient.id}
                                                                patientName={`${apt.patient.first_name} ${apt.patient.last_name}`}
                                                                trigger={
                                                                    <Button variant="outline" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600">
                                                                        <BedIcon className="h-4 w-4" />
                                                                    </Button>
                                                                }
                                                            />
                                                                {/* 🖨️ ELITE MULTI-PRINT HUB: SEPARATE ONE-SHOT BUTTONS */}
                                                                <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200/50">
                                                                    {/* 1. Standard Clinical OP Slip */}
                                                                    <OpSlipDialog
                                                                        appointment={apt}
                                                                        hospitalInfo={hospitalInfo}
                                                                        defaultPrintMode="standard"
                                                                        initialTab="voucher"
                                                                        trigger={
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/30" title="Print OP Slip (Standard)">
                                                                                <Printer className="h-4 w-4" />
                                                                            </Button>
                                                                        }
                                                                    />
                                                                    {/* 2. Token / Identity Label (Thermal) */}
                                                                    <OpSlipDialog
                                                                        appointment={apt}
                                                                        hospitalInfo={hospitalInfo}
                                                                        defaultPrintMode="label"
                                                                        initialTab="voucher"
                                                                        trigger={
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/30" title="Print Token Slip (Label)">
                                                                                <Fingerprint className="h-4 w-4" />
                                                                            </Button>
                                                                        }
                                                                    />
                                                                    {/* 3. Financial Bill / Receipt (Direct to Invoice Tab) */}
                                                                    <OpSlipDialog
                                                                        appointment={apt}
                                                                        hospitalInfo={hospitalInfo}
                                                                        defaultPrintMode="standard"
                                                                        initialTab="invoice"
                                                                        trigger={
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className={`h-8 w-8 ${apt.invoiceStatus === 'paid' ? 'text-amber-500 hover:bg-amber-100' : 'text-slate-300 hover:bg-slate-100'}`}
                                                                                title="Print Bill / Receipt"
                                                                            >
                                                                                <Receipt className="h-4 w-4" />
                                                                            </Button>
                                                                        }
                                                                    />
                                                                </div>

                                                                <StatusBadge apt={apt} />
                                                                {((apt.status === 'completed' || apt.hasPrescription) && apt.invoiceStatus !== 'paid') && (
                                                                    <Button
                                                                        size="sm"
                                                                        disabled={(apt as any).pendingConsumablesCount > 0}
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            setSelectedAptForBilling(apt);
                                                                        }}
                                                                        className={cn(
                                                                            "font-black h-8 px-4 text-[10px] rounded-lg shadow-lg flex items-center gap-1 active:scale-95 transition-all uppercase tracking-widest",
                                                                            (apt as any).pendingConsumablesCount > 0
                                                                                ? "bg-amber-100 text-amber-700 border border-amber-200 cursor-not-allowed shadow-none"
                                                                                : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                        )}
                                                                    >
                                                                        {(apt as any).pendingConsumablesCount > 0 ? (
                                                                            <><Clock className="h-3 w-3 animate-pulse" /> PENDING (CLINICAL)</>
                                                                        ) : (
                                                                            <><CreditCard className="h-3 w-3" /> COLLECT</>
                                                                        )}
                                                                    </Button>
                                                                )}
                                                            </div>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                        <MoreVertical className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem onClick={() => handleEditClick(apt)}>Edit</DropdownMenuItem>
                                                                    {(getSmartStatus(apt).label === 'Billing / Checkout' && (apt as any).pendingConsumablesCount === 0) && (
                                                                        <DropdownMenuItem onClick={() => router.push(`/hms/billing/new?appointmentId=${apt.id}&patientId=${apt.patient.id}`)}>
                                                                            Process Billing
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    <DropdownMenuItem disabled={statusLoading === apt.id} onClick={() => handleStatusUpdate(apt.id, 'cancelled')} className="text-red-600">
                                                                        {statusLoading === apt.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                                                        Cancel
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )
                    }
                </div >

                {/* RIGHT SIDEBAR */}
                < div className="w-full xl:w-96 space-y-6" >
                    <Card className="p-6 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white border-none shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-4 text-indigo-100">Quick Actions</h3>
                        <div className="grid grid-cols-2 gap-3 relative z-10">
                            {actions.map((action) => (
                                <button
                                    key={action.id}
                                    onClick={() => handleAction(action.id)}
                                    className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/10 hover:bg-white/20 transition-all border border-white/20 group"
                                >
                                    <div className={`p-2 rounded-xl bg-white mb-2 ${action.color}`}>
                                        <action.icon className="h-5 w-5" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest">{action.title}</span>
                                </button>
                            ))}
                        </div>
                    </Card>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Master Registry</h3>
                            <button onClick={() => router.push('/hms/patients')} className="text-[10px] font-bold text-indigo-500">VIEW ALL</button>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search patients..."
                                value={patientSearchQuery}
                                onChange={(e) => setPatientSearchQuery(e.target.value)}
                                className="pl-9 h-9 text-xs"
                            />
                            {isSearching && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 text-indigo-500 animate-spin" />}
                        </div>
                        <div className="max-h-[300px] overflow-y-auto space-y-2 custom-scrollbar">
                            {filteredPatients.slice(0, 5).map(p => (
                                <div key={p.id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback className="text-[10px] font-bold">{p.first_name?.[0]}{p.last_name?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="text-xs font-bold">{p.first_name} {p.last_name}</div>
                                            <div className="text-[9px] text-slate-400">{p.patient_number}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {todayAppointments.find(a => a.patient_id === p.id && a.status === 'completed' && a.invoiceStatus !== 'paid') && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className={cn(
                                                    "h-7 px-2 text-[9px] font-black border uppercase tracking-tighter",
                                                    todayAppointments.find(a => a.patient_id === p.id && a.status === 'completed' && a.invoiceStatus !== 'paid')?.pendingConsumablesCount > 0
                                                        ? "bg-amber-50 text-amber-700 border-amber-100"
                                                        : "bg-orange-50 text-orange-600 hover:bg-orange-100 hover:text-orange-700 border-orange-100 transition-all"
                                                )}
                                                disabled={todayAppointments.find(a => a.patient_id === p.id && a.status === 'completed' && a.invoiceStatus !== 'paid')?.pendingConsumablesCount > 0}
                                                onClick={() => {
                                                    const apt = todayAppointments.find(a => a.patient_id === p.id && a.status === 'completed' && a.invoiceStatus !== 'paid');
                                                    setSelectedAptForBilling(apt);
                                                }}
                                            >
                                                {todayAppointments.find(a => a.patient_id === p.id && a.status === 'completed' && a.invoiceStatus !== 'paid')?.pendingConsumablesCount > 0 ? (
                                                    <div className="flex items-center gap-1"><Clock className="h-3 w-3 animate-pulse" /> NURSING PENDING</div>
                                                ) : (
                                                    <div className="flex items-center gap-1"><CreditCard className="h-3 w-3 mr-1" /> Bill Pending</div>
                                                )}
                                            </Button>
                                        )}
                                        <AdmissionDialog
                                            patientId={p.id}
                                            patientName={`${p.first_name} ${p.last_name}`}
                                        />
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.push(`/hms/patients/${p.id}`)}>
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Revenue Pulse</h3>
                        </div>
                        <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 relative group">
                            <IndianRupee className="h-5 w-5 text-emerald-600 mb-2" />
                            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">₹{dailyCollection.toLocaleString()}</div>
                            <div className="text-[10px] font-bold text-emerald-600/60 uppercase">Today's Total</div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsPaymentsOpen(true)}
                                className="absolute top-2 right-2 text-[8px] font-black uppercase tracking-widest text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                View Details
                            </Button>
                        </div>
                    </div>
                </div >
            </div >

            {/* MODALS */}

            {/* ELITE CLINICAL TERMINAL - PERSISTENT STATE ENGINE */}
            <AnimatePresence>
                {(activeModal === 'appointment' || activeModal === 'edit-appointment') && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{
                            opacity: isTerminalMinimized ? 0 : 1,
                            scale: isTerminalMinimized ? 0.9 : 1,
                            pointerEvents: isTerminalMinimized ? 'none' : 'auto',
                            translateY: isTerminalMinimized ? 100 : 0
                        }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed inset-0 z-[110] bg-slate-950/20 backdrop-blur-sm flex items-center justify-center p-0"
                    >
                        <div className="w-full h-full">
                            <AppointmentForm
                                key={(editingAppointment?.id || 'new')}
                                onClose={() => {
                                    setActiveModal(null);
                                    setEditingAppointment(null);
                                    setIsTerminalMinimized(false);
                                }}
                                onMinimize={() => setIsTerminalMinimized(true)}
                                patients={patients}
                                doctors={doctors}
                                editingAppointment={editingAppointment}
                                billableItems={billableItems}
                                taxConfig={taxConfig}
                                uoms={uoms}
                                currency={currency}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* MINIMIZED TERMINAL DOCK */}
            <AnimatePresence>
                {isTerminalMinimized && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-6 right-6 z-[100]"
                    >
                        <Button
                            onClick={() => setIsTerminalMinimized(false)}
                            className="h-16 px-6 bg-slate-900 border-2 border-indigo-500 text-white rounded-2xl shadow-2xl flex items-center gap-4 hover:bg-slate-800 transition-all group"
                        >
                            <div className="bg-white rounded-lg p-1.5 shadow-lg group-hover:scale-110 transition-transform">
                                <Stethoscope className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div className="text-left mr-4">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] leading-none mb-1">Active Terminal</p>
                                <h3 className="text-sm font-black italic uppercase tracking-tighter">
                                    {editingAppointment ? `Editing: ${editingAppointment.patient?.first_name}` : 'New OP Registration'}
                                </h3>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/10 uppercase text-[9px] font-bold">
                                <Activity className="h-3 w-3 text-emerald-400 animate-pulse" />
                                Resume
                            </div>
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            <Dialog open={activeModal === 'expense'} onOpenChange={() => setActiveModal(null)}>
                <DialogContent className="w-screen h-screen max-w-none p-0 overflow-hidden bg-white">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Hospital Expense Management Terminal</DialogTitle>
                    </DialogHeader>
                    <ExpenseDialog onClose={() => setActiveModal(null)} />
                </DialogContent>
            </Dialog>

            <Dialog open={activeModal === 'shift'} onOpenChange={() => setActiveModal(null)}>
                <DialogContent className="max-w-3xl p-0">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Staff Shift & Handover Manager</DialogTitle>
                    </DialogHeader>
                    <ShiftManager />
                </DialogContent>
            </Dialog>

            <Dialog open={activeModal === 'attendance'} onOpenChange={() => setActiveModal(null)}>
                <DialogContent className="max-w-md p-0">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Staff Attendance & Punching</DialogTitle>
                    </DialogHeader>
                    <PunchWidget />
                </DialogContent>
            </Dialog>

            <Dialog open={!!viewingPayment} onOpenChange={() => setViewingPayment(null)}>
                <DialogContent className="max-w-[850px] p-0 overflow-hidden bg-white">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Petty Cash Voucher Detail</DialogTitle>
                    </DialogHeader>
                    {viewingPayment && <PettyCashVoucher payment={viewingPayment} onClose={() => setViewingPayment(null)} />}
                </DialogContent>
            </Dialog>

            <Dialog open={activeModal === 'beds'} onOpenChange={(open) => !open && setActiveModal(null)}>
                <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] p-0 overflow-hidden bg-slate-50 dark:bg-slate-950 rounded-[3rem] border-none shadow-2xl">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Ward & Bed Management Terminal</DialogTitle>
                    </DialogHeader>
                    <div className="h-full overflow-y-auto custom-scrollbar">
                        <WardManager branches={branches} isAdmin={isAdmin} />
                    </div>
                </DialogContent>
            </Dialog>
            {/* Modal for Billing */}
            <Dialog open={!!selectedAptForBilling} onOpenChange={(open) => {
                console.log("DEBUG: Dialog Open Change", open);
                if (!open) setSelectedAptForBilling(null);
            }}>
                <DialogContent
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                    className="max-w-[95vw] h-[95vh] flex flex-col p-0 overflow-hidden bg-slate-50/95 backdrop-blur-xl border-slate-200 focus:outline-none"
                >
                    <DialogHeader className="sr-only">
                        <DialogTitle>Financial Billing Terminal - {selectedAptForBilling?.patient?.first_name} ({selectedAptForBilling?.hms_invoice?.length || 0} Invoices)</DialogTitle>
                    </DialogHeader>
                    {selectedAptForBilling && (
                        <>
                            {console.log(`[DEBUG-RECEPTION] Opening Billing for Appt: ${selectedAptForBilling.id} - Patient: ${selectedAptForBilling.patient?.first_name}`)}
                            <CompactInvoiceEditor
                                patients={patients}
                                billableItems={billableItems}
                                uoms={uoms}
                                taxConfig={taxConfig}
                                initialPatientId={selectedAptForBilling.patient?.id}
                                appointmentId={selectedAptForBilling.id}
                                onClose={() => {
                                    console.log("[DEBUG-RECEPTION] Modal Close triggered");
                                    setSelectedAptForBilling(null);
                                    router.refresh();
                                }}
                            />
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isPaymentsOpen} onOpenChange={setIsPaymentsOpen}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white dark:bg-[#0a0f1e] rounded-[3rem] border-none shadow-[0_50px_100px_rgba(0,0,0,0.3)]">
                    <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-8 text-white">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                                    <IndianRupee className="h-8 w-8 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black italic uppercase tracking-tighter">Daily Revenue Ledger</h3>
                                    <p className="text-[10px] font-black uppercase text-emerald-100 tracking-widest">Real-time Financial Pulse</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black uppercase text-emerald-100 tracking-widest">Total Collection</p>
                                <p className="text-3xl font-black italic tracking-tighter">₹{dailyCollection.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-4">
                                    <th className="pb-4 px-2">Time</th>
                                    <th className="pb-4 px-2">Patient</th>
                                    <th className="pb-4 px-2">Reference</th>
                                    <th className="pb-4 px-2">Method</th>
                                    <th className="pb-4 px-2">Amount</th>
                                    <th className="pb-4 px-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                {todayPayments.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-20 text-center">
                                            <div className="flex flex-col items-center gap-2 opacity-20">
                                                <History className="h-12 w-12" />
                                                <p className="text-xs font-black uppercase tracking-widest">No transactions recorded yet</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    todayPayments.map((p: any) => (
                                        <tr key={p.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="py-5 px-2 text-xs font-black text-indigo-500 font-mono">
                                                {new Date(p.paid_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="py-5 px-2">
                                                <p className="text-xs font-bold leading-none">{p.hms_invoice?.hms_patient?.first_name} {p.hms_invoice?.hms_patient?.last_name}</p>
                                                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter">INV: {p.hms_invoice?.invoice_number}</p>
                                            </td>
                                            <td className="py-5 px-2 text-[10px] font-mono text-slate-500 uppercase">
                                                {p.payment_reference || 'Ref-None'}
                                            </td>
                                            <td className="py-5 px-2">
                                                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter bg-white dark:bg-slate-900">
                                                    {p.method}
                                                </Badge>
                                            </td>
                                            <td className="py-5 px-2 font-black text-slate-900 dark:text-white">
                                                ₹{Number(p.amount).toLocaleString()}
                                            </td>
                                            <td className="py-5 px-2 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setViewingPayment(p)}
                                                        className="h-8 px-3 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600"
                                                    >
                                                        Receipt
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={voidingId === p.id}
                                                        onClick={() => handleVoidPayment(p.id)}
                                                        className="h-8 px-3 text-[9px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-50 hover:text-rose-600"
                                                    >
                                                        {voidingId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldAlert className="h-3 w-3 mr-1" />}
                                                        Void
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-8 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-rose-500">
                            <ShieldAlert className="h-4 w-4" />
                            <p className="text-[10px] font-bold uppercase tracking-tight max-w-[400px]">
                                Use 'Void' to reconcile transactions that failed at the bank or were made in error. This will reopen the invoice for reprocessing.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setIsPaymentsOpen(false)}
                            className="rounded-2xl h-12 px-8 text-xs font-black uppercase tracking-widest"
                        >
                            Close Ledger
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    )
}

const getSmartStatus = (apt: any) => {
    if (apt.status === 'cancelled') return { label: 'Cancelled', color: 'bg-red-50 text-red-600 border-red-100', icon: AlertTriangle };
    if (apt.status === 'archived') return { label: 'Archived', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: CheckCircle };
    if (apt.status === 'scheduled') return { label: 'Upcoming', color: 'bg-slate-50 text-slate-500 border-slate-100', icon: Clock };

    if (apt.status === 'arrived' || apt.status === 'checked_in') {
        if (!apt.hasVitals) return { label: 'Vitals Pending', color: 'bg-rose-50 text-rose-600 border-rose-100 animate-pulse', icon: Activity };
        return { label: 'Waiting', color: 'bg-blue-50 text-blue-600 border-blue-100', icon: Users };
    }

    if (apt.status === 'confirmed') return { label: 'Sent In', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: Stethoscope };

    if (apt.status === 'in_progress') {
        if (apt.labStatus === 'pending') return { label: 'Labs / Samples', color: 'bg-violet-50 text-violet-600 border-violet-100', icon: Syringe };
        return { label: 'Consulting', color: 'bg-indigo-50 text-indigo-600 border-indigo-100', icon: Activity };
    }

    if (apt.status === 'completed') {
        if (apt.labStatus === 'pending') return { label: 'Lab Result Pending', color: 'bg-violet-50 text-violet-600 border-violet-100', icon: Syringe };
        if (apt.invoiceStatus !== 'paid') return { label: 'Billing / Checkout', color: 'bg-orange-50 text-orange-600 border-orange-100', icon: CreditCard };
        return { label: 'Discharged / Paid', color: 'bg-emerald-600 text-white border-none', icon: CheckCircle };
    }

    return { label: apt.status.toUpperCase(), color: 'bg-slate-100 text-slate-600', icon: Activity };
};

const StatusBadge = ({ apt }: { apt: any }) => {
    const status = getSmartStatus(apt);
    const Icon = status.icon;
    return (
        <Badge className={`${status.color} border py-0.5 h-auto text-[10px] font-black uppercase tracking-tighter flex items-center gap-1 shadow-none transition-all`}>
            <Icon className="h-2.5 w-2.5" />
            {status.label}
        </Badge>
    );
};



function PatientCard({
    apt,
    type,
    onAction,
    onEdit,
    onBill,
    isPrivacyMode,
    currentTime,
    router,
    handleStatusUpdate,
    statusLoading,
    hospitalInfo
}: {
    apt: any,
    type: 'waiting' | 'running' | 'billing' | 'completed',
    onAction: () => void,
    onEdit: () => void,
    onBill?: () => void,
    isPrivacyMode: boolean,
    currentTime: Date,
    router: any,
    handleStatusUpdate: (id: string, status: string) => void,
    statusLoading: string | null,
    hospitalInfo?: any
}) {
    const isEmergency = apt.type === 'emergency' || apt.tags?.includes('EMERGENCY');
    const isUrgent = apt.priority === 'urgent';
    const isHigh = apt.priority === 'high';
    const isCritical = isEmergency || isUrgent || isHigh || apt.tags?.some((t: string) => ['ACCIDENT', 'SUICIDE_ATTEMPT', 'EMERGENCY', 'MLC'].includes(t));
    const visitType = apt.type || 'consultation';

    const mask = (str: string) => {
        if (!str || !isPrivacyMode) return str;
        if (str.length <= 2) return str[0] + "*";
        return str[0] + "*".repeat(str.length - 2) + str[str.length - 1];
    };

    const isPendingBilling = apt.status === 'completed' && apt.invoiceStatus !== 'paid';
    const isPaid = apt.invoiceStatus === 'paid';

    const startTime = new Date(apt.start_time);
    const diffMins = Math.max(0, Math.floor((currentTime.getTime() - startTime.getTime()) / 60000));
    const isOverdue = type === 'billing' && diffMins > 10;
    const isWarning = type === 'billing' && diffMins > 5;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -2 }}
            className={`
                p-3 rounded-xl border transition-all group relative overflow-hidden flex-shrink-0
                ${isEmergency ? 'bg-red-50/90 dark:bg-red-950/30 border-red-200 dark:border-red-900 border-l-4 border-l-red-600' :
                    isUrgent ? 'bg-orange-50/90 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900 border-l-4 border-l-orange-500' :
                        isHigh ? 'bg-amber-50/90 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900 border-l-4 border-l-amber-400' :
                            isPendingBilling ? 'bg-yellow-50/90 dark:bg-amber-950/30 border-yellow-200 dark:border-amber-900 border-l-4 border-l-yellow-500' :
                                isPaid ? 'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 border-l-4 border-l-emerald-500' :
                                    'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-slate-100 dark:border-slate-800'}
                ${isOverdue ? 'ring-2 ring-rose-500 border-rose-200' : isWarning ? 'ring-2 ring-amber-500 border-amber-200' : ''}
            `}
        >
            {isOverdue && <div className="absolute inset-0 bg-rose-500/5 animate-pulse pointer-events-none" />}

            <div className="flex justify-between items-start mb-2 relative z-10">
                <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-[10px] font-bold">
                            {isPrivacyMode ? '**' : `${apt.patient?.first_name?.[0]}${apt.patient?.last_name?.[0]}`}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <h4 className="text-xs font-bold leading-tight">
                            {mask(apt.patient?.first_name)} {mask(apt.patient?.last_name)}
                        </h4>
                        <span className="text-[9px] text-slate-400">{apt.patient?.patient_number}</span>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <div className={`text-[10px] flex items-center gap-1 ${diffMins > 15 ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                        <Clock className="h-2.5 w-2.5" />
                        {diffMins}m
                    </div>
                    {apt.token_number && (
                        <div className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 rounded-full mt-1 border border-emerald-100 dark:border-emerald-900/50">
                            #{apt.token_number}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1 mt-1">
                    <OpSlipDialog
                        appointment={apt}
                        hospitalInfo={hospitalInfo}
                        trigger={
                            <button
                                className="p-1 rounded-md text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-all"
                                title="Print OP Slip / Rx Sheet"
                            >
                                <Printer className="h-3.5 w-3.5" />
                            </button>
                        }
                    />
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const phone = apt.patient?.contact?.mobile || "";
                            const name = `${apt.patient?.first_name} ${apt.patient?.last_name}`;
                            const msg = encodeURIComponent(`Hello ${name}, your turn is approaching shortly. Please wait near the consultation area.`);
                            window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
                        }}
                        className="p-1 rounded-md text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 transition-all"
                        title="Send WhatsApp Alert"
                    >
                        <MessageSquare className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={onEdit} className="p-1 rounded-md text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-all">
                        <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mb-3 relative z-10">
                <StatusBadge apt={apt} />
                <VisitTypeBadge type={visitType} />
                {isCritical && (
                    <Badge className="text-[9px] bg-red-600 text-white border-none animate-pulse">CRITICAL</Badge>
                )}
            </div>

            <div className="flex flex-col gap-1.5 mb-3 relative z-10">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <Stethoscope className="h-3 w-3" />
                    <span className="truncate">Dr. {apt.clinician?.first_name} {apt.clinician?.last_name}</span>
                </div>
                {apt.assigned_bed && (
                    <div className="flex items-center gap-1.5 p-1 px-2 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50 w-fit">
                        <BedIcon className="h-3 w-3" />
                        <span className="text-[9px] font-black uppercase tracking-tighter leading-none">
                            {apt.assigned_ward} - {apt.assigned_bed}
                        </span>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-800 relative z-10">
                <div className="flex items-center gap-1">
                    {apt.hasVitals && <Activity className="h-3 w-3 text-rose-500" />}
                    {apt.hasPrescription && <Stethoscope className="h-3 w-3 text-blue-500" />}
                </div>

                {type === 'waiting' && apt.status === 'scheduled' && (
                    <Button
                        size="sm"
                        disabled={statusLoading === apt.id}
                        onClick={onAction}
                        className="h-7 text-[10px] bg-blue-600 hover:bg-blue-700 text-white min-w-[80px]"
                    >
                        {statusLoading === apt.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Check In"}
                    </Button>
                )}
                {type === 'waiting' && (apt.status === 'arrived' || apt.status === 'checked_in') && (
                    <div className="flex gap-1">
                        <Button
                            size="sm"
                            disabled={statusLoading === apt.id}
                            onClick={onAction}
                            className="h-7 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white min-w-[80px]"
                        >
                            {statusLoading === apt.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Send In"}
                        </Button>
                        <AdmissionDialog
                            patientId={apt.patient.id}
                            patientName={`${apt.patient.first_name} ${apt.patient.last_name}`}
                            trigger={
                                <Button size="sm" variant="outline" className="h-7 text-[10px] border-emerald-100 text-emerald-600 hover:bg-emerald-50">Admit</Button>
                            }
                        />
                    </div>
                )}
                {type === 'running' && (
                    <div className="flex gap-1">
                        <Button size="sm" onClick={() => router.push(`/hms/prescriptions/${apt.id}`)} className="h-7 text-[10px] bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100">
                            View Rx
                        </Button>
                        {apt.hasPrescription && apt.invoiceStatus !== 'paid' && (
                            <Button size="sm" onClick={onBill} className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm px-2">
                                <IndianRupee className="h-3 w-3 mr-1" />
                                Bill
                            </Button>
                        )}
                    </div>
                )}
                {type === 'completed' && (
                    <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => router.push(`/hms/prescriptions/${apt.id}`)} className="h-7 text-[10px]">Rx</Button>
                        {apt.invoiceStatus !== 'paid' && (
                            <Button
                                size="sm"
                                onClick={onBill}
                                disabled={apt.pendingConsumablesCount > 0}
                                className={cn(
                                    "h-7 text-[10px] shadow-sm px-2 font-black uppercase tracking-widest transition-all",
                                    apt.pendingConsumablesCount > 0
                                        ? "bg-amber-100 text-amber-700 border border-amber-200 cursor-not-allowed"
                                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                )}
                            >
                                {apt.pendingConsumablesCount > 0 ? (
                                    <><Clock className="h-3 w-3 mr-1 animate-pulse" /> NYP</>
                                ) : (
                                    <><IndianRupee className="h-3 w-3 mr-1" /> Bill</>
                                )}
                            </Button>
                        )}
                        <Button
                            size="sm"
                            disabled={statusLoading === apt.id}
                            onClick={() => handleStatusUpdate(apt.id, 'archived')}
                            className="h-7 text-[10px] bg-slate-100 text-slate-500 hover:bg-slate-200 min-w-[70px]"
                        >
                            {statusLoading === apt.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Archive"}
                        </Button>
                    </div>
                )}
                {type === 'billing' && (
                    <Button
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            console.log("DEBUG: CLICKED COLLECT BUTTON", apt.id);
                            try {
                                if (onAction) {
                                    console.log("DEBUG: Calling onAction prop");
                                    onAction();
                                } else {
                                    console.error("DEBUG: onAction prop is MISSING");
                                }
                            } catch (err) {
                                console.error("DEBUG: CRASH inside Collect Handler", err);
                            }
                        }}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black h-8 px-4 text-[10px] rounded-lg shadow-lg relative z-50 pointer-events-auto"
                    >
                        <CreditCard className="h-3 w-3 mr-1" />
                        COLLECT
                    </Button>
                )}
            </div>
        </motion.div>
    );
}
