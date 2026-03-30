'use client'

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Activity, FlaskConical, Users, Clock, Calendar,
    ChevronRight, Search, Bell, FileText, CheckCircle2,
    AlertCircle, TrendingUp, TestTube2, Microscope,
    ArrowRight, Check, Loader2, X, IndianRupee
} from "lucide-react"
import { useRouter } from "next/navigation"
import { updateLabOrderStatus, uploadAndAttachLabReport, deleteLabReport } from "@/app/actions/lab"
import { CompactInvoiceEditor } from "@/components/billing/invoice-editor-compact"

interface LabDashboardProps {
    labStaffName: string
    orders: any[]
    stats: {
        total: number
        pending: number
        completed: number
    }
    patients: any[]
    billableItems: any[]
    taxConfig: any
}

export function LabDashboardClient({ labStaffName, orders, stats, patients, billableItems, taxConfig }: LabDashboardProps) {
    const router = useRouter()
    const [selectedTab, setSelectedTab] = useState<'pending' | 'completed'>('pending')
    const [searchQuery, setSearchQuery] = useState('')

    // Filter logic
    const pendingOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled')
    const completedOrders = orders.filter(o => o.status === 'completed')

    const displayedOrders = (selectedTab === 'pending' ? pendingOrders : completedOrders).filter(o =>
        o.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.order_number?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    }

    const item = {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 }
    }

    const [selectedOrder, setSelectedOrder] = useState<any>(null)
    const [billingOrder, setBillingOrder] = useState<any>(null)
    const [isUpdating, setIsUpdating] = useState(false)
    const [isUploading, setIsUploading] = useState(false)

    const handleStatusUpdate = async () => {
        if (!selectedOrder) return

        const currentStatus = selectedOrder.status
        let nextStatus = ''

        if (currentStatus === 'requested') nextStatus = 'collected'
        else if (currentStatus === 'collected') nextStatus = 'in_progress'
        else if (currentStatus === 'in_progress') nextStatus = 'completed'
        else return

        setIsUpdating(true)
        try {
            const res = await updateLabOrderStatus({
                orderId: selectedOrder.id,
                status: nextStatus as any
            })

            if (res.success) {
                // Determine if we should close the modal or just update local state
                // For better UX, let's update local state so user sees the progress, then close if completed?
                // Or just close. Let's close for now as the list will refresh.
                setSelectedOrder(null)
                router.refresh()
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsUpdating(false)
        }
    }

    // Status Steps Definition
    const steps = [
        { id: 'requested', label: 'Requested' },
        { id: 'collected', label: 'Collected' },
        { id: 'in_progress', label: 'In Progress' },
        { id: 'completed', label: 'Completed' },
    ]

    const getCurrentStepIndex = (status: string) => steps.findIndex(s => s.id === status)

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 lg:p-10 font-sans">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* HEADER */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div>
                            <motion.h1
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight"
                            >
                                Lab Dashboard <span className="text-xl font-medium text-slate-400 block sm:inline sm:ml-2">| {labStaffName}</span>
                            </motion.h1>
                            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by Patient or Order ID..."
                                className="pl-9 pr-4 py-2 text-sm font-medium rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-violet-100 outline-none w-full sm:w-80 shadow-sm"
                            />
                        </div>
                    </div>
                </header>

                {/* STATS GRID */}
                {/* STATS GRID COMPACT */}
                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                    <motion.div variants={item} className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-4 rounded-2xl border border-white/50 shadow-sm relative overflow-hidden group flex items-center gap-4">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
                            <TestTube2 className="h-24 w-24 text-violet-600" />
                        </div>
                        <div className="h-12 w-12 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center text-violet-600 shrink-0">
                            <Activity className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">{stats.total}</h3>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Total Orders</p>
                        </div>
                    </motion.div>

                    <motion.div variants={item} className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-4 rounded-2xl border border-white/50 shadow-sm relative overflow-hidden group flex items-center gap-4">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
                            <Clock className="h-24 w-24 text-amber-600" />
                        </div>
                        <div className="h-12 w-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
                            <Microscope className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">{stats.pending}</h3>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Pending</p>
                        </div>
                    </motion.div>

                    <motion.div variants={item} className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-4 rounded-2xl border border-white/50 shadow-sm relative overflow-hidden group flex items-center gap-4">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
                            <CheckCircle2 className="h-24 w-24 text-emerald-600" />
                        </div>
                        <div className="h-12 w-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                            <FileText className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">{stats.completed}</h3>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Completed</p>
                        </div>
                    </motion.div>
                </motion.div>

                {/* MAIN CONTENT AREA */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <FlaskConical className="h-5 w-5 text-violet-500" />
                            Worklist
                        </h2>

                        <div className="bg-white dark:bg-slate-900 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex">
                            <button
                                onClick={() => setSelectedTab('pending')}
                                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${selectedTab === 'pending' ? 'bg-violet-50 text-violet-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Queue
                            </button>
                            <button
                                onClick={() => setSelectedTab('completed')}
                                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${selectedTab === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                History
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <AnimatePresence mode="popLayout">
                            {displayedOrders.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    className="bg-white/40 dark:bg-slate-900/40 rounded-3xl p-12 text-center border-2 border-dashed border-slate-200"
                                >
                                    <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                        <TestTube2 className="h-8 w-8 text-slate-300" />
                                    </div>
                                    <p className="text-slate-500 font-medium">No lab orders found.</p>
                                </motion.div>
                            ) : (
                                displayedOrders.map((order, index) => (
                                    <motion.div
                                        key={order.id}
                                        layout
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="bg-white dark:bg-slate-900 rounded-3xl p-4 md:p-6 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-violet-200 transition-all group relative overflow-hidden"
                                    >
                                        <div className={`absolute left-0 top-0 bottom-0 w-2 ${order.status === 'completed' ? 'bg-emerald-500' :
                                            order.status === 'in_progress' ? 'bg-amber-500' : 'bg-slate-200'
                                            }`} />

                                        <div className="flex flex-col lg:flex-row lg:items-center gap-6 pl-4">

                                            {/* Order Time & Patient Avatar */}
                                            <div className="flex items-center gap-6 min-w-[200px]">
                                                <div className="text-center min-w-[60px]">
                                                    <p className="text-2xl font-black text-slate-900 dark:text-white">
                                                        {new Date(order.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).split(' ')[0]}
                                                    </p>
                                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                                        {new Date(order.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).split(' ')[1]}
                                                    </p>
                                                </div>
                                                <div className="h-14 w-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl font-black shadow-inner">
                                                    {order.patient_name.charAt(0)}
                                                </div>
                                            </div>

                                            {/* Main Details */}
                                            <div className="flex-1 space-y-3">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                                        {order.patient_name}
                                                    </h3>
                                                    <span className="px-2.5 py-1 rounded-full text-[10px] bg-slate-100 text-slate-500 font-bold border border-slate-200 uppercase tracking-wider">
                                                        #{order.order_number || 'N/A'}
                                                    </span>
                                                    {order.totalPrice > 0 && (
                                                        <span className="flex items-center gap-0.5 px-2.5 py-1 rounded-full text-[10px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 uppercase tracking-wider">
                                                            <IndianRupee className="h-3 w-3" />
                                                            {order.totalPrice?.toFixed(2)}
                                                        </span>
                                                    )}
                                                    {order.priority === 'urgent' && (
                                                        <span className="px-2.5 py-1 rounded-full text-[10px] bg-red-100 text-red-700 font-bold border border-red-200 uppercase tracking-wider animate-pulse">
                                                            URGENT
                                                        </span>
                                                    )}
                                                    {order.report_url && (
                                                        <span className="px-2.5 py-1 rounded-full text-[10px] bg-blue-100 text-blue-700 font-bold border border-blue-200 uppercase tracking-wider flex items-center gap-1">
                                                            <FileText className="h-3 w-3" />
                                                            Results Ready
                                                        </span>
                                                    )}
                                                    {order.invoice_status && (
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider flex items-center gap-1 ${order.invoice_status === 'paid' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                            order.invoice_status === 'posted' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                                                'bg-amber-100 text-amber-700 border-amber-200'
                                                            }`}>
                                                            <IndianRupee className="h-3 w-3" />
                                                            {order.invoice_status === 'paid' ? 'PAID' : order.invoice_status === 'posted' ? 'INVOICE POSTED' : 'INVOICE DRAFT'}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex flex-wrap gap-2">
                                                    {order.tests.map((test: any, tIdx: number) => (
                                                        <span key={tIdx} className="px-3 py-1 bg-violet-50 text-violet-700 rounded-lg text-xs font-bold border border-violet-100">
                                                            {test.test_name}
                                                        </span>
                                                    ))}
                                                    {order.tests.length === 0 && <span className="text-slate-400 italic text-sm">No specific tests listed</span>}
                                                </div>

                                                <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <Users className="h-3 w-3" /> Dr. {order.doctor_name || 'Unknown'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-3 mt-4 lg:mt-0 lg:ml-auto flex-wrap justify-end">
                                                <button
                                                    onClick={() => router.push(`/hms/lab/results/${order.id}`)}
                                                    className="h-12 px-6 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm shadow-xl shadow-violet-600/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                                                >
                                                    {order.status === 'requested' ? 'Process Order' : 'Enter Results'}
                                                    <ArrowRight className="h-4 w-4" />
                                                </button>
                                                {order.status === 'completed' && (
                                                    <button
                                                        onClick={() => router.push(`/hms/lab/reports/${order.id}`)}
                                                        className="h-12 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xl shadow-blue-600/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                                                    >
                                                        <FileText className="h-4 w-4" />
                                                        View Report
                                                    </button>
                                                )}
                                                {order.invoice_id ? (
                                                    <button
                                                        onClick={() => router.push(`/hms/billing?invoice=${order.invoice_id}`)}
                                                        className="h-12 px-6 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-xl shadow-amber-600/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                                                    >
                                                        <IndianRupee className="h-4 w-4" />
                                                        View Invoice
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setBillingOrder(order);
                                                        }}
                                                        className="h-12 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-xl shadow-emerald-600/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                                                    >
                                                        <IndianRupee className="h-4 w-4" />
                                                        Bill Patient
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Modal for Lab Order Details */}
            <AnimatePresence>
                {selectedOrder && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 px-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                            onClick={() => setSelectedOrder(null)}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="relative bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl border border-gray-100 dark:border-slate-800 flex flex-col"
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                                <div>
                                    <h3 className="text-xl font-black">Order #{selectedOrder.order_number}</h3>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                                        {new Date(selectedOrder.time).toLocaleString()}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedOrder(null)}
                                    className="h-10 w-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-slate-700 transition-all duration-200"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
                                {/* Status Stepper */}
                                <div className="relative">
                                    <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 dark:bg-slate-800 -translate-y-1/2 rounded-full" />
                                    <div
                                        className="absolute top-1/2 left-0 h-1 bg-violet-600 -translate-y-1/2 rounded-full transition-all duration-500"
                                        style={{ width: `${(getCurrentStepIndex(selectedOrder.status) / (steps.length - 1)) * 100}%` }}
                                    />
                                    <div className="relative flex justify-between">
                                        {steps.map((step, idx) => {
                                            const isCompleted = idx <= getCurrentStepIndex(selectedOrder.status)
                                            const isCurrent = idx === getCurrentStepIndex(selectedOrder.status)
                                            return (
                                                <div key={step.id} className="flex flex-col items-center gap-2">
                                                    <div className={`
                                                        w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all duration-300 z-10
                                                        ${isCompleted
                                                            ? 'bg-violet-600 border-violet-600 text-white'
                                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                                                        }
                                                        ${isCurrent ? 'ring-4 ring-violet-100 dark:ring-violet-900/30 scale-110' : ''}
                                                    `}>
                                                        {isCompleted ? <Check className="h-4 w-4" /> : <div className="w-2 h-2 rounded-full bg-slate-300" />}
                                                    </div>
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isCurrent ? 'text-violet-600' : 'text-slate-400'}`}>
                                                        {step.label}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Patient Bio */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 flex flex-col sm:flex-row gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-xl font-black text-slate-900 dark:text-white border border-slate-100 dark:border-slate-700">
                                            {selectedOrder.patient_name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Patient</p>
                                            <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedOrder.patient_name}</p>
                                        </div>
                                    </div>
                                    <div className="w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prescribed By</p>
                                        <p className="text-base font-bold text-slate-900 dark:text-white">Dr. {selectedOrder.doctor_name}</p>
                                    </div>
                                </div>

                                {/* Tests List */}
                                <div>
                                    <h4 className="font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
                                        <TestTube2 className="h-5 w-5 text-violet-500" />
                                        Requested Analysis
                                    </h4>
                                    <div className="space-y-3">
                                        {selectedOrder.tests.map((test: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:border-violet-200 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-2 rounded-full bg-violet-500" />
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-slate-700 dark:text-slate-200">{test.test_name}</span>
                                                        <span className="text-xs text-slate-400 flex items-center gap-0.5">
                                                            <IndianRupee className="h-2.5 w-2.5" /> {test.price?.toFixed(2) || '0.00'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className={`
                                                    text-[10px] font-bold px-2 py-1 rounded-lg border uppercase tracking-wider
                                                    ${test.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                        (test.status === 'in_progress' || test.status === 'processing') ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                            'bg-slate-50 text-slate-500 border-slate-100'}
                                                `}>
                                                    {test.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 flex gap-3 shrink-0">
                                {selectedOrder.status !== 'completed' ? (
                                    <button
                                        onClick={handleStatusUpdate}
                                        disabled={isUpdating}
                                        className="flex-1 py-3.5 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-600/20 active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        {isUpdating ? (
                                            <>
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                                Updating...
                                            </>
                                        ) : (
                                            <>
                                                {selectedOrder.status === 'requested' && 'Mark Sample Collected'}
                                                {selectedOrder.status === 'collected' && 'Start Processing'}
                                                {selectedOrder.status === 'in_progress' && 'Release Results'}
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <button disabled className="flex-1 py-3.5 bg-emerald-600/10 text-emerald-600 border border-emerald-200 rounded-xl font-bold cursor-default flex items-center justify-center gap-2">
                                        <CheckCircle2 className="h-5 w-5" />
                                        Order Completed
                                    </button>
                                )}

                                <button className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                    Print Label
                                </button>
                                <button
                                    onClick={() => {
                                        setBillingOrder(selectedOrder);
                                        setSelectedOrder(null);
                                    }}
                                    className="flex-1 py-3 bg-violet-100 text-violet-700 font-bold rounded-xl hover:bg-violet-200 transition-colors flex items-center justify-center gap-2"
                                >
                                    <FileText className="h-4 w-4" />
                                    Bill Patient
                                </button>
                            </div>

                            {/* Report Upload Section */}
                            {(selectedOrder.status === 'in_progress' || selectedOrder.status === 'completed') && (
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-t border-slate-200 dark:border-slate-700">
                                    <h4 className="font-bold mb-2 flex items-center gap-2 text-slate-900 dark:text-white">
                                        <FileText className="h-4 w-4" /> Lab Report
                                    </h4>
                                    {selectedOrder.report_url ? (
                                        <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                Report Attached
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <a
                                                    href={`/api/lab/report/${selectedOrder.id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs font-bold text-violet-600 hover:underline"
                                                >
                                                    View Report
                                                </a>
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm("Are you sure you want to remove this report?")) return
                                                        setIsUpdating(true)
                                                        try {
                                                            const res = await deleteLabReport(selectedOrder.id)
                                                            if (res.success) {
                                                                setSelectedOrder((prev: any) => ({
                                                                    ...prev,
                                                                    status: 'in_progress', // Revert status
                                                                    report_url: null
                                                                }))
                                                                router.refresh()
                                                            } else {
                                                                alert(res.message)
                                                            }
                                                        } catch (e) {
                                                            console.error(e)
                                                        } finally {
                                                            setIsUpdating(false)
                                                        }
                                                    }}
                                                    disabled={isUpdating}
                                                    className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-colors"
                                                    title="Remove Report"
                                                >
                                                    {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Users className="h-3 w-3 rotate-45" />} {/* Using Users as X icon substitute or Trash if available, actually let's use Trash logic fromlucide if imported, but Users rotate is hacky. Let's use 'X' or Trash properly. I dont have Trash imported. I'll use text X for safety or import Trash.*/}
                                                    <span className="sr-only">Remove</span>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <p className="text-xs text-slate-500">
                                                Attach the final lab report (PDF or Image, max 15MB).
                                            </p>
                                            <form action={async (formData) => {
                                                setIsUploading(true)
                                                try {
                                                    const res = await uploadAndAttachLabReport(formData)

                                                    if (res.success && res.url) {
                                                        const btn = document.getElementById('upload-btn-text')
                                                        if (btn) btn.innerText = "Saved!"

                                                        await new Promise(r => setTimeout(r, 1000))

                                                        // Update local state to show the report immediately
                                                        setSelectedOrder((prev: any) => ({
                                                            ...prev,
                                                            status: 'completed',
                                                            report_url: res.url
                                                        }))

                                                        // Refresh background data
                                                        router.refresh()
                                                    } else {
                                                        alert(res.message || "Failed to upload report")
                                                    }
                                                } catch (e: any) {
                                                    console.error(e)
                                                    alert("An error occurred: " + e.message)
                                                } finally {
                                                    setIsUploading(false)
                                                }
                                            }} className="flex gap-2 items-center">
                                                <input type="hidden" name="orderId" value={selectedOrder.id} />
                                                <input
                                                    type="file"
                                                    name="file"
                                                    accept="image/*,.pdf"
                                                    required
                                                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 outline-none w-full file:mr-4 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 dark:text-gray-300"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={isUploading}
                                                    className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-colors shrink-0 disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                                    <span id="upload-btn-text">{isUploading ? 'Uploading...' : 'Upload'}</span>
                                                </button>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            )}

                        </motion.div>
                    </div>
                )
                }
            </AnimatePresence >

            {/* Billing Modal */}
            {billingOrder && (
                <div className="relative z-[100]">
                    <CompactInvoiceEditor
                        patients={patients}
                        billableItems={billableItems}
                        taxConfig={taxConfig}
                        initialPatientId={patients.find(p => p.patient_number === billingOrder.patient_id)?.id}
                        initialMedicines={billingOrder.tests.map((t: any) => ({
                            id: '',
                            name: `Lab: ${t.test_name}`,
                            price: Number(t.price) || 0,
                            quantity: 1,
                            type: 'service'
                        }))}
                        onClose={() => setBillingOrder(null)}
                    />
                </div>
            )}
        </div >
    )
}
