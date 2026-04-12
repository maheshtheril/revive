'use client'

import { useState } from "react"
import { motion } from "framer-motion"
import {
    Activity, HeartPulse, UserCheck, Syringe,
    ClipboardList, BedDouble, TestTube2, AlertCircle,
    Clock, Search, Filter, ChevronRight, X
} from "lucide-react"
import { useRouter } from "next/navigation"
import { differenceInYears } from "date-fns"
import { Dialog, DialogContent, DialogTitle, DialogHeader } from "@/components/ui/dialog"
import NursingVitalsForm from "@/components/nursing/vitals-form"
import { UsageForm } from "./usage-form"

interface NursingActionCenterProps {
    pendingTriage: any[]
    completedTriage?: any[]
    activeAdmissions: any[]
    pendingSamples: any[]
    allPatients?: any[]
}

import { DashboardDateFilter } from "../dashboard-date-filter"

export function NursingActionCenter({ pendingTriage, completedTriage = [], activeAdmissions, pendingSamples, allPatients = [] }: NursingActionCenterProps) {
    const router = useRouter()
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedTask, setSelectedTask] = useState<any>(null)
    const [selectedUsageTask, setSelectedUsageTask] = useState<any>(null)
    const [activeTab, setActiveTab] = useState<'queue' | 'history' | 'census'>('queue')

    // [MOD] Removed unused quickActions array to ensure UI clarity and prevent accidental rendering of legacy blocks

    const displayedTasks = (activeTab === 'queue' ? pendingTriage : activeTab === 'census' ? allPatients : completedTriage).filter(task => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            task.patient_name.toLowerCase().includes(q) ||
            (task.patient_id && task.patient_id.toString().toLowerCase().includes(q))
        );
    })

    return (
        <div className="flex flex-col lg:flex-row gap-8 min-h-[calc(100vh-6rem)] relative">

            {/* Left Column: Tasks & Queue */}
            <div className="flex-1 space-y-6">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                            <Activity className="h-6 w-6 text-pink-500" />
                            Nursing Station
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Manage patient care, vitals, and ward duties
                        </p>
                    </div>
                    <DashboardDateFilter />
                </div>

                {/* Queue Summary Grid */}
                {/* Queue Summary Grid Compact */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-pink-300 transition-all flex items-center gap-4 group" onClick={() => setActiveTab('queue')}>
                        <div className="h-12 w-12 bg-pink-100 dark:bg-pink-900/30 rounded-xl flex items-center justify-center text-pink-600 shrink-0 group-hover:scale-110 transition-transform">
                            <HeartPulse className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">{pendingTriage.length}</div>
                            <div className={`text-xs font-bold uppercase tracking-wider mt-1 ${activeTab === 'queue' ? 'text-pink-600' : 'text-slate-500'}`}>Pending Vitals</div>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-blue-300 transition-all flex items-center gap-4 group" onClick={() => setActiveTab('census')}>
                        <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 shrink-0 group-hover:scale-110 transition-transform">
                            <Activity className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">{allPatients.length}</div>
                            <div className={`text-xs font-bold uppercase tracking-wider mt-1 ${activeTab === 'census' ? 'text-blue-600' : 'text-slate-500'}`}>Active Patients</div>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-emerald-300 transition-all flex items-center gap-4 group" onClick={() => setActiveTab('history')}>
                        <div className="h-12 w-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-110 transition-transform">
                            <UserCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">{completedTriage.length}</div>
                            <div className={`text-xs font-bold uppercase tracking-wider mt-1 ${activeTab === 'history' ? 'text-emerald-600' : 'text-slate-500'}`}>Completed Today</div>
                        </div>
                    </div>
                </div>

                {/* Priority Queue (Triage) */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[500px]">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50">
                        <div className="flex gap-4">
                            <button
                                onClick={() => setActiveTab('queue')}
                                className={`text-sm font-bold flex items-center gap-2 pb-2 border-b-2 transition-all ${activeTab === 'queue' ? 'text-pink-600 border-pink-600' : 'text-slate-500 border-transparent hover:text-slate-700'}`}
                            >
                                <Clock className="h-4 w-4" />
                                Awaiting Vitals
                            </button>
                            <button
                                onClick={() => setActiveTab('census')}
                                className={`text-sm font-bold flex items-center gap-2 pb-2 border-b-2 transition-all ${activeTab === 'census' ? 'text-blue-600 border-blue-600' : 'text-slate-500 border-transparent hover:text-slate-700'}`}
                            >
                                <Activity className="h-4 w-4" />
                                All Patients
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`text-sm font-bold flex items-center gap-2 pb-2 border-b-2 transition-all ${activeTab === 'history' ? 'text-emerald-600 border-emerald-600' : 'text-slate-500 border-transparent hover:text-slate-700'}`}
                            >
                                <UserCheck className="h-4 w-4" />
                                Completed
                            </button>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative hidden md:block">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8 pr-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-pink-100 outline-none w-48"
                                />
                            </div>
                            <div className="text-xs text-slate-500 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                {displayedTasks.length} Patients
                            </div>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[600px] overflow-y-auto">
                        {displayedTasks.length === 0 ? (
                            <div className="p-12 text-center text-slate-500">
                                {activeTab === 'queue' ? (
                                    <>
                                        <UserCheck className="h-12 w-12 mx-auto text-slate-300 mb-2" />
                                        <p>No patients waiting for vitals assessment</p>
                                    </>
                                ) : activeTab === 'census' ? (
                                    <>
                                        <Activity className="h-12 w-12 mx-auto text-slate-300 mb-2" />
                                        <p>No active patients found today</p>
                                    </>
                                ) : (
                                    <>
                                        <ClipboardList className="h-12 w-12 mx-auto text-slate-300 mb-2" />
                                        <p>No vitals recorded yet today</p>
                                    </>
                                )}
                            </div>
                        ) : (
                            displayedTasks.map((task) => {
                                const isEmergency = task.priority?.toLowerCase() === 'emergency';
                                const isUrgent = task.priority?.toLowerCase() === 'urgent';
                                const isHigh = task.priority?.toLowerCase() === 'high';
                                const isHighPriority = isEmergency || isUrgent || isHigh;

                                let rowColor = 'hover:bg-slate-50 dark:hover:bg-slate-800/50';
                                if (activeTab === 'history') {
                                    if (task.invoiceStatus === 'paid') rowColor = 'border-emerald-500 bg-emerald-50/5 hover:bg-emerald-50/10 border-l-4 border-l-emerald-500';
                                    else if (task.invoiceStatus === 'pending') rowColor = 'border-amber-500 bg-amber-50/5 hover:bg-amber-50/10 border-l-4 border-l-amber-500';
                                    else rowColor = 'border-slate-200 bg-slate-50/5 hover:bg-slate-100/10 border-l-4 border-l-slate-300';
                                }
                                else if (activeTab === 'census') rowColor = 'border-blue-500 bg-blue-50/5 hover:bg-blue-50/10';
                                else if (isEmergency) rowColor = 'bg-red-100/60 hover:bg-red-200/60 dark:bg-red-950/40 dark:hover:bg-red-900/40 border-l-4 border-l-red-600';
                                else if (isUrgent) rowColor = 'bg-orange-50/60 hover:bg-orange-100/60 dark:bg-orange-950/20 dark:hover:bg-orange-900/20 border-l-4 border-l-orange-500';
                                else if (isHigh) rowColor = 'bg-amber-50/40 hover:bg-amber-100/40 dark:bg-amber-950/10 dark:hover:bg-amber-900/10 border-l-4 border-l-amber-400';
                                else rowColor = 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50';

                                return (
                                    <div
                                        key={task.id}
                                        className={`p-4 transition-all duration-300 flex flex-row items-center justify-between cursor-pointer gap-2 md:gap-4 ${rowColor}`}
                                        onClick={() => setSelectedTask(task)}
                                    >
                                        <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                                            <div className={`h-11 w-11 md:h-12 md:w-12 rounded-2xl flex items-center justify-center text-base md:text-lg font-bold shadow-sm shrink-0 transition-transform group-hover:scale-105 ${task.patient_gender?.toLowerCase() === 'female' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'}`}>
                                                {task.patient_name.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-black text-xs md:text-sm text-slate-900 dark:text-white uppercase tracking-tight truncate max-w-[120px] md:max-w-none">{task.patient_name}</h4>
                                                    {isEmergency && activeTab === 'queue' && <span className="text-[8px] md:text-[9px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full uppercase flex items-center gap-1 animate-pulse shadow-sm">Critical</span>}
                                                    {isUrgent && activeTab === 'queue' && <span className="text-[8px] md:text-[9px] font-black bg-orange-500 text-white px-2 py-0.5 rounded-full uppercase">Urgent</span>}
                                                    {activeTab === 'history' && (
                                                        task.invoiceStatus === 'paid' ? (
                                                            <span className="text-[8px] md:text-[9px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase shadow-sm shadow-emerald-200">Paid</span>
                                                        ) : (
                                                            <span className="text-[8px] md:text-[9px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase shadow-sm shadow-amber-200">Billing</span>
                                                        )
                                                    )}
                                                </div>
                                                <p className="text-[10px] md:text-xs text-slate-500 mt-0.5 font-medium flex items-center gap-1.5 md:gap-2">
                                                    <span className="capitalize">{task.patient_gender || '?'}</span>
                                                    <span className="h-0.5 w-0.5 bg-slate-300 rounded-full" />
                                                    <span>{task.patient_dob ? differenceInYears(new Date(), new Date(task.patient_dob)) + 'y' : '-'}</span>
                                                    <span className="h-0.5 w-0.5 bg-slate-300 rounded-full" />
                                                    <span className="text-slate-400 truncate max-w-[60px]">#{task.patient_id || 'N/A'}</span>
                                                </p>
                                                <p className="text-[10px] md:text-xs text-slate-400 mt-1 truncate max-w-[150px] md:max-w-[200px]">
                                                    {task.reason || 'General Visit'} • {task.doctor_name}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5 md:gap-2 text-right shrink-0">
                                            <div className="text-[10px] md:text-xs font-bold text-slate-400 flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {new Date(task.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedUsageTask(task);
                                                    }}
                                                    className="flex items-center justify-center h-8 w-8 md:h-9 md:w-9 rounded-xl bg-slate-100 text-slate-500 hover:bg-orange-100 hover:text-orange-600 transition-colors border border-slate-200"
                                                    title="Record Consumables Usage"
                                                >
                                                    <ClipboardList className="h-4 w-4" />
                                                </button>
                                                <div className={`flex items-center gap-1 font-bold text-[10px] md:text-xs px-2.5 md:px-3 py-1.5 md:py-2 rounded-xl transition-all shadow-sm ${activeTab === 'history' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-pink-50 text-pink-600 hover:bg-pink-600 hover:text-white'
                                                    }`}>
                                                    {activeTab === 'history' ? 'Edit' : 'Assess'} <ChevronRight className="h-3 w-3" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

            </div>

            {/* Right Column: Alerts & Alerts */}
            <div className="w-full lg:w-80 space-y-6">
                {/* Status / Meta Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-pink-100 text-pink-600">
                            <Activity className="h-5 w-5" />
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-white">Station Status</h3>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500 font-bold">Shift Lead</span>
                            <span className="text-slate-900 font-black">Charge Nurse</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500 font-bold">Active Station</span>
                            <span className="text-emerald-500 font-black flex items-center gap-1">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> ONLINE
                            </span>
                        </div>
                    </div>
                </div>

                {/* Notifications / Alerts */}
                <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-100 dark:border-amber-800">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-bold text-sm text-amber-800 dark:text-amber-200">Shift Reminder</h4>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                Please ensure all vitals are synced before shift handover.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal for Vitals */}
            <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
                <DialogContent className="max-w-[95vw] h-[95vh] flex flex-col p-0 overflow-hidden bg-slate-50/95 backdrop-blur-xl border-slate-200 outline-none">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Vitals Assessment for {selectedTask?.patient_name}</DialogTitle>
                    </DialogHeader>

                    {/* Sticky Header inside Modal */}
                    <div className="flex items-center gap-4 px-6 py-4 bg-white/50 backdrop-blur-md border-b border-slate-100 flex-none z-10 relative">
                        <div className={`h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold ${selectedTask?.patient_gender?.toLowerCase() === 'female' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'}`}>
                            {selectedTask?.patient_name?.charAt(0)}
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-slate-900">{selectedTask?.patient_name}</h2>
                            <p className="text-sm text-slate-500 flex items-center gap-2 flex-wrap">
                                <span className="capitalize">{selectedTask?.patient_gender}</span>
                                {selectedTask?.patient_dob && (
                                    <>
                                        <span className="h-1 w-1 bg-slate-300 rounded-full" />
                                        <span>{differenceInYears(new Date(), new Date(selectedTask.patient_dob))}Y</span>
                                    </>
                                )}
                                {selectedTask?.patient_blood_group && (
                                    <>
                                        <span className="h-1 w-1 bg-slate-300 rounded-full" />
                                        <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded textxs font-bold ring-1 ring-red-100">{selectedTask.patient_blood_group}</span>
                                    </>
                                )}
                                <span className="h-1 w-1 bg-slate-300 rounded-full" />
                                <span className="text-indigo-600 font-medium">#{selectedTask?.patient_id}</span>
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            {selectedTask?.reason && (
                                <div className="hidden sm:block text-right mr-4">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Chief Complaint</span>
                                    <span className="text-sm font-bold text-slate-700">{selectedTask.reason}</span>
                                </div>
                            )}
                            <button
                                onClick={() => setSelectedTask(null)}
                                className="h-8 w-8 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 rounded-full flex items-center justify-center transition-all"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Form Content - Compact to avoid scroll */}
                    <div className="flex-1 overflow-y-auto p-2 scroll-smooth bg-slate-50/50">
                        {selectedTask && (
                            <NursingVitalsForm
                                patientId={selectedTask.patient_uuid}
                                encounterId={selectedTask.id}
                                tenantId={selectedTask.tenant_id}
                                isModal={true}
                                onCancel={() => setSelectedTask(null)}
                            />
                        )}
                    </div>

                    {/* Fixed Footer */}
                    <div className="p-4 border-t border-slate-200 bg-white/80 backdrop-blur-md flex justify-end gap-3 flex-none z-10">
                        <button
                            onClick={() => setSelectedTask(null)}
                            className="px-6 py-3 rounded-full text-slate-500 font-bold hover:bg-slate-100 transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="nursing-vitals-form"
                            className="bg-slate-900 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-slate-900/20 flex items-center gap-2 hover:bg-black transition-colors"
                        >
                            Save Assessment
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!selectedUsageTask} onOpenChange={(open) => !open && setSelectedUsageTask(null)}>
                <DialogContent className="max-w-[95vw] lg:max-w-6xl h-[90vh] flex flex-col p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Record Consumption for {selectedUsageTask?.patient_name}</DialogTitle>
                    </DialogHeader>
                    {selectedUsageTask && (
                        <UsageForm
                            patientId={selectedUsageTask.patient_uuid}
                            encounterId={selectedUsageTask.id}
                            patientName={selectedUsageTask.patient_name}
                            isModal={true}
                            onCancel={() => setSelectedUsageTask(null)}
                            onSuccess={() => {
                                setSelectedUsageTask(null)
                                router.refresh()
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

        </div>
    )
}
