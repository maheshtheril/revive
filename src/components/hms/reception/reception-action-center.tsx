'use client'

import { cn } from "@/lib/utils"
// TurboSync: Refreshing module factory

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    UserPlus, CalendarPlus, LogIn, CreditCard,
    PhoneIncoming, IdCard, Users, Search,
    Clock, Stethoscope, ChevronRight, Filter, ChevronDown, CheckCircle, Smartphone, MoreVertical, Edit, Activity, IndianRupee,
    Printer, Wallet, Banknote, Fingerprint, Receipt, LayoutDashboard, Kanban, AlertTriangle, Syringe, Zap, Eye, EyeOff, Wifi, Bed as BedIcon,
    RotateCcw, ShieldAlert, Trash2, Loader2, History, BookOpen, MessageSquare, Maximize2, Minimize2, X, FileText
} from "lucide-react"
import { ExpenseDialog } from "./expense-dialog"
import { PaymentVoucherForm } from "@/components/accounting/payment-voucher-form"
import { PettyCashVoucher } from "./petty-cash-voucher"
import { ShiftManager } from "./shift-manager"
import { getCurrentShift } from "@/app/actions/shift"
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
import { voidPayment, getTaxConfiguration, getBillableItems } from "@/app/actions/billing"
import { getInitialInvoiceData } from "@/app/actions/clinical"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import { VisitTypeBadge } from "../visit-type-badge"
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

const getInitials = (firstName?: string, lastName?: string) => {
    const f = firstName?.trim() || "";
    const l = lastName?.trim() || "";
    if (!f && !l) return "U";
    if (f && !l) return f.substring(0, 2).toUpperCase();
    if (!f && l) return l.substring(0, 2).toUpperCase();
    return `${f[0]}${l[0]}`.toUpperCase();
};

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
    const [activeShift, setActiveShift] = useState<any>(null)
    const [isMounted, setIsMounted] = useState(false)
    const [isExpenseMaximized, setIsExpenseMaximized] = useState(true)
    const [isJournalMaximized, setIsJournalMaximized] = useState(true)
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

            // F5 - Expense Entry Modal
            if (e.key === 'F5' && !activeModal) {
                e.preventDefault()
                if (!activeShift) {
                    toast({ title: "⚠️ Counter Session Closed", description: "You must start a cash shift session and verify your starting float before logging petty cash expenses.", variant: "destructive" })
                    setActiveModal('shift')
                    return
                }
                setActiveModal('expense')
            }

            // F7 - Journal / Voucher Entry Modal
            if (e.key === 'F7' && !activeModal) {
                e.preventDefault()
                if (!activeShift) {
                    toast({ title: "⚠️ Counter Session Closed", description: "You must start a cash shift session and verify your starting float before entering accounting vouchers.", variant: "destructive" })
                    setActiveModal('shift')
                    return
                }
                setActiveModal('journal')
            }

            // Escape - Close Modal
            if (e.key === 'Escape' && activeModal) {
                const target = e.target as HTMLElement;
                if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.closest('[role="combobox"]') || target.closest('[role="listbox"]') || target.closest('[role="dialog"]') || target.closest('.z-\\[120\\]') || target.closest('.z-\\[200\\]'))) {
                    return;
                }
                if (document.querySelector('.z-\\[120\\]') || document.querySelector('.z-\\[200\\]')) {
                    return;
                }
                setActiveModal(null)
                setEditingAppointment(null)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [activeModal, router, toast, activeShift])

    const handleEditClick = (apt: any) => {
        setEditingAppointment(apt)
        setActiveModal('edit-appointment')
    }

    const handleAction = (actionId: string) => {
        if (['voucher', 'billing', 'expense', 'journal', 'appointment', 'create-patient'].includes(actionId)) {
            if (!activeShift) {
                toast({ title: "⚠️ Counter Session Closed", description: "You must start a cash counter session and verify your starting float before processing registrations, billing, or vouchers.", variant: "destructive" })
                setActiveModal('shift')
                return
            }
        }

        if (actionId === 'voucher') {
            router.push('/hms/reception/registration-voucher')
            return
        }
        if (actionId === 'billing') {
            router.push('/hms/billing')
            return
        }
        if (actionId === 'ledger_view') {
            setIsPaymentsOpen(true)
            return
        }
        if (actionId === 'expense_report') {
            router.push('/hms/accounting/payments')
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
        { id: 'journal', title: 'Advanced Voucher (F7)', icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-100 dark:border-emerald-800' },
        { id: 'ledger_view', title: 'Financial Ledger', icon: History, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-100 dark:border-blue-800' },
        { id: 'expense', title: 'Petty Cash / Exp (F5)', icon: Wallet, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-800' },
        { id: 'shift', title: 'Cash Counter', icon: Banknote, color: 'text-slate-600', bg: 'bg-slate-50 dark:bg-slate-800/50', border: 'border-slate-200 dark:border-slate-700' },
        { id: 'expense_report', title: 'Expense Reports', icon: FileText, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-100 dark:border-rose-800' },
    ]

    useEffect(() => { 
        setIsMounted(true)
        async function fetchShift() {
            const s = await getCurrentShift();
            setActiveShift(s);
        }
        fetchShift();
    }, [])

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
        <div className="flex-1 space-y-8 pt-6 overflow-x-hidden animate-in fade-in duration-700 relative">
            {/* GLOBAL DATE HUB & LIVE PULSE */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-white/80 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)]">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-2xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 bg-clip-text text-transparent uppercase tracking-tighter italic drop-shadow-sm">Front Office Hub</span>
                        <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 shadow-sm">
                            <Clock className="h-3.5 w-3.5 text-indigo-500 animate-spin-slow" />
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Shift Active: 08:00 AM - 07:59 AM</span>
                        </div>
                        <div 
                            onClick={() => setActiveModal('shift')}
                            className={cn(
                                "flex items-center gap-2 px-3.5 py-1 rounded-full border shadow-sm cursor-pointer transition-all active:scale-95 font-mono",
                                activeShift 
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-500/30"
                                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-rose-500/30 animate-pulse shadow-rose-500/10"
                            )}
                        >
                            {activeShift ? (
                                <><CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> <span className="text-[10px] font-black uppercase tracking-wider font-sans">Counter Open</span></>
                            ) : (
                                <><AlertTriangle className="h-3.5 w-3.5 text-rose-500" /> <span className="text-[10px] font-black uppercase tracking-wider font-sans">⚠️ Counter Closed: Click to Open Float</span></>
                            )}
                        </div>
                    </div>
                    <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 pl-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        World Standard 24/7 Medical Day Triaging
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex flex-col items-end border-r border-slate-200 dark:border-slate-800 pr-5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Reporting Window</span>
                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 tracking-wider">SHIFT: {currentTime.getHours() < 8 ? 'NIGHT' : 'DAY'}</span>
                    </div>
                    <DashboardDateFilter />
                </div>
            </div>

            {/* TOP STATS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
                <Card className="p-5 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/80 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] rounded-3xl flex items-center justify-between group hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300">
                    <div className="space-y-1">
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Expected</p>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{todayAppointments.length}</h3>
                    </div>
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-indigo-500/30 dark:from-indigo-900/20 dark:to-indigo-900/40 border border-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                </Card>
                <Card className="p-5 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/80 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] rounded-3xl flex items-center justify-between group hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300">
                    <div className="space-y-1">
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">In Waiting</p>
                        <h3 className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight">{todayAppointments.filter(a => ['arrived', 'checked_in'].includes(a.status)).length}</h3>
                    </div>
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/30 dark:from-blue-900/20 dark:to-blue-900/40 border border-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                </Card>
                <Link href="/hms/billing?status=draft" className="block cursor-pointer">
                    <Card className="p-5 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/80 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] rounded-3xl flex items-center justify-between group hover:-translate-y-1.5 hover:shadow-xl hover:border-orange-500/30 transition-all duration-300">
                        <div className="space-y-1">
                            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Draft Bills</p>
                            <h3 className="text-3xl font-black text-orange-600 dark:text-orange-400 tracking-tight">{draftCount}</h3>
                        </div>
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500/10 to-orange-500/30 dark:from-orange-900/20 dark:to-orange-900/40 border border-orange-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <Activity className="h-6 w-6 text-orange-600 dark:text-orange-400 animate-pulse" />
                        </div>
                    </Card>
                </Link>
                <div onClick={() => setActiveModal('beds')} className="block cursor-pointer">
                    <Card className="p-5 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/80 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] rounded-3xl flex items-center justify-between group hover:-translate-y-1.5 hover:shadow-xl hover:border-indigo-500/30 transition-all duration-300">
                        <div className="space-y-1">
                            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Beds Vacant</p>
                            <h3 className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">{availableBeds}</h3>
                        </div>
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-indigo-500/30 dark:from-indigo-900/20 dark:to-indigo-900/40 border border-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <BedIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                    </Card>
                </div>
                <Link href="/hms/billing?status=pending" className="block cursor-pointer">
                    <Card className="p-5 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-950/40 backdrop-blur-2xl border border-emerald-500/30 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] rounded-3xl flex items-center justify-between group hover:-translate-y-1.5 hover:shadow-xl hover:border-emerald-500/50 transition-all duration-300">
                        <div className="space-y-1">
                            <p className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Awaiting Billing</p>
                            <h3 className="text-3xl font-black text-emerald-700 dark:text-emerald-300 tracking-tight">
                                {todayAppointments.filter(a => (a.status === 'completed' || a.hasPrescription) && a.invoiceStatus !== 'paid').length}
                            </h3>
                        </div>
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/40 border border-emerald-500/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <IndianRupee className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
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
                                            <AvatarImage src={(apt.patient?.metadata as any)?.profile_pic} alt={apt.patient?.first_name} />
                                            <AvatarFallback className="text-[10px] font-bold bg-orange-100 text-orange-600">
                                                {getInitials(apt.patient?.first_name, apt.patient?.last_name)}
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
                                <div className="flex-1 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-2 space-y-3">
                                    {filteredAppointments
                                        .filter(a => ['scheduled', 'arrived', 'checked_in'].includes(a.status))
                                        .sort((a, b) => new Date(a.starts_at || a.start_time).getTime() - new Date(b.starts_at || b.start_time).getTime())
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
                                <div className="flex-1 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30 p-2 space-y-3">
                                    {filteredAppointments
                                        .filter(a => ['confirmed', 'in_progress'].includes(a.status) || (a.status === 'completed' && a.labStatus === 'pending'))
                                        .sort((a, b) => new Date(a.starts_at || a.start_time).getTime() - new Date(b.starts_at || b.start_time).getTime())
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
                                <div className="flex-1 bg-orange-50/30 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/30 p-2 space-y-3">
                                    {filteredAppointments
                                        .filter(a => (a.status === 'completed' || a.hasPrescription) && a.invoiceStatus !== 'paid')
                                        .sort((a, b) => new Date(a.starts_at || a.start_time).getTime() - new Date(b.starts_at || b.start_time).getTime())
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
                                <div className="flex-1 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-2 space-y-3">
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
                        <Card className="border border-slate-100 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900 overflow-hidden flex-1">
                            <div className="overflow-x-auto custom-scrollbar scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
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
                                                                {new Date(apt.starts_at || apt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                                                                <AvatarImage src={(apt.patient?.metadata as any)?.profile_pic} alt={apt.patient?.first_name} className={isPrivacyMode ? "blur-sm" : ""} />
                                                                <AvatarFallback className="text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                                                                    {isPrivacyMode ? '**' : getInitials(apt.patient?.first_name, apt.patient?.last_name)}
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
                                                                        directPrint={true}
                                                                        trigger={
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/30" title="Print OP Slip (Standard)">
                                                                                <Printer className="h-4 w-4" />
                                                                            </Button>
                                                                        }
                                                                    />
                                                                    <OpSlipDialog
                                                                        appointment={apt}
                                                                        hospitalInfo={hospitalInfo}
                                                                        defaultPrintMode="standard"
                                                                        initialTab="voucher"
                                                                        directPrint={false}
                                                                        trigger={
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800" title="Preview Slip Options">
                                                                                <Eye className="h-4 w-4" />
                                                                            </Button>
                                                                        }
                                                                    />
                                                                    {/* 2. Token / Identity Label (Thermal) */}
                                                                    <OpSlipDialog
                                                                        appointment={apt}
                                                                        hospitalInfo={hospitalInfo}
                                                                        defaultPrintMode="label"
                                                                        initialTab="voucher"
                                                                        directPrint={true}
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
                                                                        directPrint={true}
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
                <div className="w-full xl:w-96 space-y-6">
                    <Card className="p-6 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white border-none shadow-[0_20px_50px_rgba(79,70,229,0.3)] relative overflow-hidden rounded-3xl">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/20 rounded-full -ml-20 -mb-20 blur-2xl pointer-events-none" />
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-4 text-indigo-100/90 flex items-center gap-2 relative z-10">
                            <Zap className="h-4 w-4 text-amber-300 animate-pulse" /> Quick Actions Hub
                        </h3>
                        <div className="grid grid-cols-2 gap-3 relative z-10">
                            {actions.map((action) => (
                                <button
                                    key={action.id}
                                    onClick={() => handleAction(action.id)}
                                    className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all border border-white/20 group hover:shadow-lg backdrop-blur-md"
                                >
                                    <div className={`p-2.5 rounded-xl bg-white mb-2 shadow-sm group-hover:scale-110 transition-transform duration-300 ${action.color}`}>
                                        <action.icon className="h-5 w-5" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-50 leading-tight text-center">{action.title}</span>
                                </button>
                            ))}
                        </div>
                    </Card>

                    <div className="space-y-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-3xl border border-white/80 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Master Registry</h3>
                            <button onClick={() => router.push('/hms/patients')} className="text-[10px] font-black tracking-wider text-indigo-600 dark:text-indigo-400 hover:underline uppercase">VIEW ALL</button>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search registry..."
                                value={patientSearchQuery}
                                onChange={(e) => setPatientSearchQuery(e.target.value)}
                                className="pl-10 h-10 text-xs rounded-2xl bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 focus-visible:ring-indigo-500"
                            />
                            {isSearching && <Loader2 className="absolute right-3.5 top-3 h-4 w-4 text-indigo-500 animate-spin" />}
                        </div>
                        <div className="max-h-[300px] overflow-y-auto space-y-2 custom-scrollbar">
                            {filteredPatients.slice(0, 5).map(p => (
                                <div key={p.id} className="p-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 shadow-sm transition-all">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9 border-2 border-white dark:border-slate-700 shadow-sm">
                                            <AvatarImage src={(p.metadata as any)?.profile_pic} alt={p.first_name} />
                                            <AvatarFallback className="text-[10px] font-black bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 dark:from-slate-800 dark:to-slate-900 dark:text-slate-300">
                                                {getInitials(p.first_name, p.last_name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{p.first_name} {p.last_name}</div>
                                            <div className="text-[9px] text-slate-400 font-mono tracking-tighter">{p.patient_number}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {todayAppointments.find(a => a.patient_id === p.id && a.status === 'completed' && a.invoiceStatus !== 'paid') && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className={cn(
                                                    "h-7 px-2 text-[9px] font-black border uppercase tracking-tighter rounded-xl",
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
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-xl hover:bg-indigo-50 hover:text-indigo-600" onClick={() => router.push(`/hms/patients/${p.id}`)}>
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-3xl border border-white/80 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Revenue Pulse</h3>
                            <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">Live Flow</span>
                        </div>
                        <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-950/40 backdrop-blur-xl border border-emerald-500/30 relative group shadow-sm hover:border-emerald-500/50 transition-all duration-300">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none -mr-8 -mt-8" />
                            <div className="flex items-center gap-4 mb-3">
                                <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-300">
                                    <IndianRupee className="h-6 w-6" />
                                </div>
                                <div>
                                    <div className="text-3xl font-black italic tracking-tighter bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">₹{dailyCollection.toLocaleString()}</div>
                                    <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Today's Gross Flow</div>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsPaymentsOpen(true)}
                                className="w-full h-10 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 transition-colors flex items-center justify-center gap-2"
                            >
                                <History className="h-3.5 w-3.5" /> View Detailed Ledger
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODALS */}

            {/* ELITE CLINICAL TERMINAL - PERSISTENT STATE ENGINE */}
            <Dialog open={(activeModal === 'appointment' || activeModal === 'edit-appointment') && !isTerminalMinimized} onOpenChange={(open) => {
                if (!open) {
                    setActiveModal(null);
                    setEditingAppointment(null);
                    setIsTerminalMinimized(false);
                }
            }}>
                <DialogContent
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => {
                        const target = e.target as HTMLElement;
                        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.closest('[role="combobox"]') || target.closest('[role="listbox"]') || target.closest('.z-\\[120\\]') || target.closest('.z-\\[200\\]'))) {
                            e.preventDefault();
                            return;
                        }
                        if (document.querySelector('.z-\\[120\\]') || document.querySelector('.z-\\[200\\]')) {
                            e.preventDefault();
                            return;
                        }
                    }}
                    className="max-w-[95vw] h-[92vh] p-0 overflow-hidden bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl flex flex-col focus:outline-none"
                >
                    <DialogHeader className="sr-only">
                        <DialogTitle>{editingAppointment ? `Editing: ${editingAppointment.patient?.first_name}` : 'New OP Registration'}</DialogTitle>
                    </DialogHeader>
                    <div className="w-full h-full overflow-hidden flex flex-col">
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
                </DialogContent>
            </Dialog>

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
                <DialogContent className={isExpenseMaximized ? "w-screen h-screen max-w-none rounded-none border-none p-0 overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col" : "max-w-5xl h-[85vh] p-0 overflow-hidden bg-slate-50 dark:bg-slate-950 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"}>
                    <DialogHeader className="sr-only">
                        <DialogTitle>Hospital Expense Management Terminal</DialogTitle>
                    </DialogHeader>
                    <ExpenseDialog
                        onClose={() => setActiveModal(null)}
                        headerActions={
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsExpenseMaximized(!isExpenseMaximized)}
                                    className="h-8 w-8 text-white hover:text-white hover:bg-white/20 rounded-lg transition-all"
                                    title={isExpenseMaximized ? "Restore window" : "Maximize window"}
                                >
                                    {isExpenseMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4 text-white" />}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setActiveModal(null)}
                                    className="h-8 w-8 text-white hover:text-white hover:bg-white/20 rounded-lg transition-all"
                                    title="Close window (Esc)"
                                >
                                    <X className="h-4 w-4 text-white" />
                                </Button>
                            </div>
                        }
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={activeModal === 'journal'} onOpenChange={() => setActiveModal(null)}>
                <DialogContent className={isJournalMaximized ? "w-screen h-screen max-w-none rounded-none border-none p-0 overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col" : "max-w-5xl h-[85vh] p-0 overflow-hidden bg-slate-50 dark:bg-slate-950 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"}>
                    <DialogHeader className="sr-only">
                        <DialogTitle>Financial Voucher Terminal (F7)</DialogTitle>
                    </DialogHeader>
                    <PaymentVoucherForm
                        initialData={{}}
                        onClose={() => setActiveModal(null)}
                        onSuccess={() => setActiveModal(null)}
                        simplified={false}
                        headerActions={
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsJournalMaximized(!isJournalMaximized)}
                                    className="h-8 w-8 text-white hover:text-white hover:bg-white/20 rounded-lg transition-all"
                                    title={isJournalMaximized ? "Restore window" : "Maximize window"}
                                >
                                    {isJournalMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4 text-white" />}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setActiveModal(null)}
                                    className="h-8 w-8 text-white hover:text-white hover:bg-white/20 rounded-lg transition-all"
                                    title="Close window (Esc)"
                                >
                                    <X className="h-4 w-4 text-white" />
                                </Button>
                            </div>
                        }
                    />
                </DialogContent>
            </Dialog>



            <Dialog open={activeModal === 'shift'} onOpenChange={() => setActiveModal(null)}>
                <DialogContent className="max-w-3xl p-0">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Staff Shift & Handover Manager</DialogTitle>
                    </DialogHeader>
                    <ShiftManager 
                        onShiftUpdate={(s) => setActiveShift(s)} 
                        onOpenExpense={() => {
                            setActiveModal('expense');
                        }} 
                    />
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
                    <DialogHeader className="sr-only">
                        <DialogTitle>Financial Revenue Ledger & Payment History</DialogTitle>
                    </DialogHeader>
                    <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-8 text-white">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                                    <IndianRupee className="h-8 w-8 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black italic uppercase tracking-tighter">Daily Revenue Ledger</h3>
                                    <div className="flex items-center gap-3 mt-1">
                                        <p className="text-[10px] font-black uppercase text-emerald-100 tracking-widest">Real-time Financial Pulse</p>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="h-7 px-3 text-[10px] font-black rounded-lg bg-white text-emerald-800 hover:bg-emerald-50 transition-all uppercase tracking-widest"
                                            onClick={() => router.push('/hms/accounting/payments')}
                                        >
                                            View Expense Register ➜
                                        </Button>
                                    </div>
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

    const startTime = new Date(apt.starts_at || apt.start_time);
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
                    <Avatar className="h-8 w-8 shadow-sm">
                        <AvatarImage src={(apt.patient?.metadata as any)?.profile_pic} alt={apt.patient?.first_name} className={isPrivacyMode ? "blur-sm" : ""} />
                        <AvatarFallback className="text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                            {isPrivacyMode ? '**' : getInitials(apt.patient?.first_name, apt.patient?.last_name)}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <h4 className="text-xs font-bold leading-tight text-slate-900 dark:text-white">
                            {mask(apt.patient?.first_name)} {mask(apt.patient?.last_name)}
                        </h4>
                        <span className="text-[9px] text-slate-400 font-mono tracking-tighter">{apt.patient?.patient_number}</span>
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
                        directPrint={true}
                        trigger={
                            <button
                                className="p-1 rounded-md text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all"
                                title="Print OP Slip / Rx Sheet (Direct)"
                            >
                                <Printer className="h-4 w-4" />
                            </button>
                        }
                    />
                    <OpSlipDialog
                        appointment={apt}
                        hospitalInfo={hospitalInfo}
                        directPrint={false}
                        trigger={
                            <button
                                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                                title="Preview / Options"
                            >
                                <Eye className="h-4 w-4" />
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
