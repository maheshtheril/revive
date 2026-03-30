'use client'

import { useState, useEffect } from 'react'
import {
    Home, Plus, Users, Bed as BedIcon, Info,
    MoreVertical, CheckCircle2, AlertCircle,
    Trash2, Edit2, Search, Filter, RefreshCcw,
    Thermometer, Heart, Activity as VitalIcon, Droplets, Zap
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog"
import {
    DropdownMenu, DropdownMenuContent,
    DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { getWards, createWard, createBed, getActiveAdmissions, assignBedToPatient, releaseBed, transferBed } from "@/app/actions/wards"
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from "sonner"
import Link from 'next/link'

export function WardManager({ branches, isAdmin }: { branches: any[], isAdmin?: boolean }) {
    const [wards, setWards] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedBranch, setSelectedBranch] = useState(branches[0]?.id || '')
    const [wardName, setWardName] = useState('')
    const [isCreateWardOpen, setIsCreateWardOpen] = useState(false)

    // For Bed Assignment
    const [admissions, setAdmissions] = useState<any[]>([])
    const [selectedBed, setSelectedBed] = useState<any>(null)
    const [isAssignOpen, setIsAssignOpen] = useState(false)
    const [isCreateBedOpen, setIsCreateBedOpen] = useState(false)
    const [targetWardId, setTargetWardId] = useState('')
    const [bedNo, setBedNo] = useState('')

    // For Transfer
    const [transferMode, setTransferMode] = useState(false)
    const [sourceAdmissionId, setSourceAdmissionId] = useState('')
    const [sourcePatientName, setSourcePatientName] = useState('')

    useEffect(() => {
        loadWards()
    }, [selectedBranch])

    async function loadWards() {
        setLoading(true)
        const res = await getWards(selectedBranch)
        if (res.success) setWards(res.data || [])
        setLoading(false)
    }

    async function handleCreateWard() {
        if (!wardName) return
        const res = await createWard(wardName, selectedBranch)
        if (res.success) {
            toast.success("Ward created successfully")
            setWardName('')
            setIsCreateWardOpen(false)
            loadWards()
        } else {
            toast.error(res.error)
        }
    }

    function handleAddBed(wardId: string) {
        setTargetWardId(wardId)
        setBedNo('')
        setIsCreateBedOpen(true)
    }

    async function submitAddBed() {
        if (!bedNo || !targetWardId) return
        setLoading(true)
        const res = await createBed(targetWardId, bedNo)
        if (res.success) {
            toast.success("Bed added successfully")
            setIsCreateBedOpen(false)
            loadWards()
        } else {
            toast.error(res.error)
        }
        setLoading(false)
    }

    async function openAssignDialog(bed: any) {
        setSelectedBed(bed)
        const res = await getActiveAdmissions()
        if (res.success) {
            setAdmissions(res.data || [])
            setIsAssignOpen(true)
        } else {
            toast.error("Failed to load admissions")
        }
    }

    async function handleAssign(admissionId: string) {
        if (!selectedBed) return
        const res = await assignBedToPatient(admissionId, selectedBed.id)
        if (res.success) {
            toast.success("Bed assigned")
            setIsAssignOpen(false)
            loadWards()
        } else {
            toast.error(res.error)
        }
    }

    async function handleRelease(bedId: string, patientName?: string, admissionId?: string) {
        if (transferMode) {
            setTransferMode(false)
            setSourceAdmissionId('')
            return
        }

        if (!confirm(`Are you sure you want to release this bed? ${patientName ? `(Currently occupied by ${patientName})` : ''}`)) return
        const res = await releaseBed(bedId)
        if (res.success) {
            toast.success("Bed released and patient discharged")
            loadWards()
        } else {
            toast.error(res.error)
        }
    }

    async function startTransfer(bed: any) {
        // We need the admission ID. getWards should ideally return it.
        // Let's check how we get it. 
        // I need to update getWards action to include admissionId in the enriched beds.
        if (!bed.admissionId) {
            toast.error("Admission data missing for this bed")
            return
        }
        setTransferMode(true)
        setSourceAdmissionId(bed.admissionId)
        setSourcePatientName(bed.patient)
        toast.info(`Transfer Mode: Select a vacant bed for ${bed.patient}`)
    }

    async function executeTransfer(targetBedId: string) {
        const res = await transferBed(sourceAdmissionId, targetBedId)
        if (res.success) {
            toast.success(`${sourcePatientName} has been transferred`)
            setTransferMode(false)
            setSourceAdmissionId('')
            setSourcePatientName('')
            loadWards()
        } else {
            toast.error(res.error)
        }
    }


    return (
        <div className="space-y-8 p-4 md:p-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-slate-200 dark:border-slate-800">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none">
                            <Home className="h-6 w-6 text-white" />
                        </div>
                        <Badge variant="outline" className="uppercase tracking-widest text-[10px] font-bold border-indigo-100 text-indigo-600">Operations Hub</Badge>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Wards & Admissions</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Real-time occupancy management and bed coordination</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {transferMode && (
                        <Button
                            variant="destructive"
                            onClick={() => { setTransferMode(false); setSourceAdmissionId(''); }}
                            className="h-12 px-6 rounded-xl font-bold animate-pulse"
                        >
                            Cancel Transfer ({sourcePatientName})
                        </Button>
                    )}
                    <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="h-12 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm focus:ring-2 ring-indigo-500 dark:text-white"
                    >
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>

                    {isAdmin && (
                        <Button onClick={() => setIsCreateWardOpen(true)} className="h-12 px-6 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:shadow-lg transition-all">
                            <Plus className="h-5 w-5 mr-2" /> New Ward
                        </Button>
                    )}
                </div>
            </div>

            {/* Content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-12 flex gap-4 h-12 items-center px-8 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500 overflow-x-auto no-scrollbar">
                    <span className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-500" /> STABLE</span>
                    <span className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-amber-500" /> OBSERVATION</span>
                    <span className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-rose-500 animate-ping" /> CRITICAL (SPO2 {"<"} 92)</span>
                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-2" />
                    <span className="flex items-center gap-2"><Heart className="h-3 w-3 text-rose-500" /> REAL-TIME PULSE</span>
                    <span className="flex items-center gap-2"><VitalIcon className="h-3 w-3 text-indigo-500" /> VITALS UPDATED</span>
                </div>

                {/* Wards Sidebar/List */}
                <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    <AnimatePresence mode='popLayout'>
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="h-64 bg-slate-100 dark:bg-slate-800 rounded-[2rem] animate-pulse" />
                            ))
                        ) : wards.length === 0 ? (
                            <div className="col-span-full py-20 text-center bg-slate-50 dark:bg-slate-900/50 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                                <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-slate-400">No wards configured for this branch</h3>
                                <p className="text-slate-500 text-sm mt-1">Start by creating your first clinical ward</p>
                            </div>
                        ) : wards.map((ward) => (
                            <motion.div
                                key={ward.id}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="group bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl hover:shadow-2xl transition-all overflow-hidden flex flex-col"
                            >
                                <div className="p-8 pb-4 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors uppercaseTracking leading-none mb-2">{ward.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="secondary" className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-500">
                                                {ward.hms_bed.length} Beds
                                            </Badge>
                                            <Badge variant="secondary" className="bg-emerald-50 dark:bg-emerald-900/20 text-[10px] uppercase font-bold text-emerald-600">
                                                {ward.hms_bed.filter((b: any) => b.status === 'available').length} Available
                                            </Badge>
                                        </div>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 hover:bg-slate-100 dark:hover:bg-slate-800">
                                                <MoreVertical className="h-5 w-5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2">
                                            {isAdmin && (
                                                <DropdownMenuItem onClick={() => handleAddBed(ward.id)} className="rounded-xl h-11 cursor-pointer">
                                                    <Plus className="h-4 w-4 mr-2" /> Add New Bed
                                                </DropdownMenuItem>
                                            )}
                                            {isAdmin && (
                                                <DropdownMenuItem className="rounded-xl h-11 cursor-pointer text-rose-600">
                                                    <Trash2 className="h-4 w-4 mr-2" /> Delete Ward
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <div className="p-8 pt-4 flex-1">
                                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                        {ward.hms_bed.map((bed: any) => (
                                            <div
                                                key={bed.id}
                                                onClick={() => {
                                                    if (transferMode) {
                                                        if (bed.status === 'available') executeTransfer(bed.id)
                                                        else toast.error("Cannot transfer to an occupied bed")
                                                    } else {
                                                        bed.status === 'available' ? openAssignDialog(bed) : handleRelease(bed.id, bed.patient, bed.admissionId)
                                                    }
                                                }}
                                                className={`
                                                    relative h-20 rounded-2xl cursor-pointer transition-all flex flex-col items-center justify-center border-2 transition-all group/bed
                                                    ${transferMode && bed.status === 'available' ? 'border-dashed border-emerald-500 bg-emerald-50/50 animate-pulse' : 'border-transparent'}
                                                    ${bed.status === 'available'
                                                        ? 'bg-slate-50 dark:bg-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800'
                                                        : 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-100 dark:border-indigo-800 shadow-sm'}
                                                `}
                                                title={bed.patient ? `Occupied by: ${bed.patient}` : 'Available'}
                                            >
                                                <BedIcon className={`h-5 w-5 mb-1 ${bed.status === 'available' ? 'text-slate-300 dark:text-slate-600' : 'text-indigo-600 animate-pulse'}`} />
                                                <span className={`text-[11px] font-black ${bed.status === 'available' ? 'text-slate-500' : 'text-indigo-900 dark:text-indigo-200'}`}>
                                                    {bed.bed_no}
                                                </span>

                                                {/* Clinical Vitals QuickView - World Standard Feature */}
                                                {bed.status === 'occupied' && bed.vitals && !transferMode && (
                                                    <div className="absolute right-1 top-1 flex flex-col gap-0.5 opacity-60 group-hover/bed:opacity-100 transition-opacity">
                                                        {bed.vitals.pulse && (
                                                            <div className="flex items-center gap-0.5 text-[7px] font-bold text-rose-600">
                                                                <Heart className="h-1.5 w-1.5 fill-rose-500" /> {bed.vitals.pulse}
                                                            </div>
                                                        )}
                                                        {bed.vitals.spo2 && (
                                                            <div className={`flex items-center gap-0.5 text-[7px] font-bold ${bed.vitals.spo2 < 94 ? 'text-orange-500' : 'text-indigo-600'}`}>
                                                                <Droplets className="h-1.5 w-1.5" /> {bed.vitals.spo2}%
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {bed.status === 'occupied' && !transferMode && (
                                                    <div className="absolute inset-x-0 bottom-1 flex justify-center gap-2 opacity-40">
                                                        <div className="h-0.5 w-4 bg-indigo-200 rounded-full" />
                                                        <div className="h-0.5 w-4 bg-indigo-200 rounded-full" />
                                                    </div>
                                                )}

                                                {bed.status === 'occupied' && !transferMode && (
                                                    <div className="absolute inset-0 bg-indigo-600/90 rounded-2xl flex items-center justify-center opacity-0 group-hover/bed:opacity-100 transition-opacity p-2 text-center pointer-events-none group">
                                                        <div className="flex flex-col gap-1 pointer-events-auto">
                                                            <Link
                                                                href={`/hms/patients/${bed.patientId}`}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="text-[9px] font-black text-white leading-tight uppercase bg-indigo-500 hover:bg-indigo-400 p-1 px-2 rounded-md transition-colors block"
                                                            >
                                                                View History
                                                            </Link>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); startTransfer(bed); }}
                                                                className="text-[9px] font-black text-white leading-tight uppercase bg-white/20 hover:bg-white/40 p-1 px-2 rounded-md transition-colors"
                                                            >
                                                                Transfer
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleRelease(bed.id, bed.patient, bed.admissionId); }}
                                                                className="text-[9px] font-black text-white leading-tight uppercase bg-rose-500/50 hover:bg-rose-500 p-1 px-2 rounded-md transition-colors"
                                                            >
                                                                Release
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                        ))}
                                        {isAdmin && (
                                            <button
                                                onClick={() => handleAddBed(ward.id)}
                                                className="h-20 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 flex flex-col items-center justify-center transition-all group/add gap-1"
                                            >
                                                <Plus className="h-5 w-5 text-slate-300 group-hover/add:text-indigo-500 transition-colors" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover/add:text-indigo-600 transition-colors">Add Bed</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* Create Ward Dialog */}
            <Dialog open={isCreateWardOpen} onOpenChange={setIsCreateWardOpen}>
                <DialogContent className="max-w-md rounded-[2.5rem] p-8 border-none shadow-2xl dark:bg-slate-900">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black">Architecture New Ward</DialogTitle>
                        <CardDescription>Define a new functional unit for patient care</CardDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-slate-400 px-1">Ward Name</label>
                            <Input
                                placeholder="e.g. Intensive Care Unit, General Male Ward"
                                value={wardName}
                                onChange={(e) => setWardName(e.target.value)}
                                className="h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border-none font-bold text-lg px-6 dark:text-white"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreateWard} className="w-full h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-lg hover:opacity-90">
                            Construct Ward
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Assignment Dialog */}
            <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
                <DialogContent className="max-w-xl rounded-[2.5rem] p-8 border-none shadow-2xl dark:bg-slate-900">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black">Assign Bed {selectedBed?.bed_no}</DialogTitle>
                        <CardDescription>Select a currently admitted patient to assign to this bed</CardDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-6 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                        {admissions.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 italic font-medium">
                                No active admissions waiting for bed assignment
                            </div>
                        ) : admissions.map((adm) => (
                            <div
                                key={adm.id}
                                onClick={() => handleAssign(adm.id)}
                                className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all flex items-center justify-between border-2 border-transparent hover:border-indigo-100 dark:hover:border-indigo-900 group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center font-black text-indigo-600 shadow-sm border border-slate-100 dark:border-slate-800 group-hover:scale-110 transition-transform">
                                        {adm.hms_patient?.first_name?.[0]}{adm.hms_patient?.last_name?.[0]}
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{adm.hms_patient?.first_name} {adm.hms_patient?.last_name}</p>
                                        <p className="text-xs text-slate-500 font-medium">ID: {adm.hms_patient?.reg_no || 'Walk-in'}</p>
                                    </div>
                                </div>
                                <Button variant="ghost" className="rounded-xl h-10 px-4 font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30">Assign</Button>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
            <Dialog open={isCreateBedOpen} onOpenChange={setIsCreateBedOpen}>
                <DialogContent className="max-w-md rounded-[2.5rem] p-8 border-none shadow-2xl dark:bg-slate-900">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black">Provision New Bed</DialogTitle>
                        <CardDescription>Register a new clinical bed in the selected ward</CardDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-slate-400 px-1">Bed Number / Label</label>
                            <Input
                                placeholder="e.g. B-101, VENT-01"
                                value={bedNo}
                                onChange={(e) => setBedNo(e.target.value)}
                                className="h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border-none font-bold text-lg px-6 dark:text-white"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setIsCreateBedOpen(false)}
                            className="h-14 rounded-2xl font-bold px-8"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={submitAddBed}
                            disabled={loading || !bedNo}
                            className="h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black px-8 hover:shadow-xl transition-all"
                        >
                            {loading ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> : <Plus className="h-5 w-5 mr-2" />}
                            Create Bed
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
