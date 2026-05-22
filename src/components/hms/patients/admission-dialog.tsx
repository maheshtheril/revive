'use client'

import { useState, useEffect } from 'react'
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogTrigger, DialogFooter,
    DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Bed as BedIcon,
    Home,
    Stethoscope,
    ChevronRight,
    Search,
    UserPlus,
    Activity,
    CheckCircle2,
    Calendar,
    Clock
} from 'lucide-react'
import { getWards, createAdmission } from "@/app/actions/wards"
import { toast } from "sonner"
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

interface AdmissionDialogProps {
    patientId: string
    patientName: string
    trigger?: React.ReactNode
}

export function AdmissionDialog({ patientId, patientName, trigger }: AdmissionDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [wards, setWards] = useState<any[]>([])
    const [selectedWard, setSelectedWard] = useState<any>(null)
    const [selectedBed, setSelectedBed] = useState<any>(null)
    const [fetchingWards, setFetchingWards] = useState(false)
    const router = useRouter()

    useEffect(() => {
        if (isOpen) {
            fetchWards()
        }
    }, [isOpen])

    async function fetchWards() {
        setFetchingWards(true)
        const res = await getWards()
        if (res.success) {
            setWards(res.data)
        }
        setFetchingWards(false)
    }

    async function handleAdmit() {
        if (!selectedBed) {
            toast.error("Please select a bed for admission")
            return
        }

        setLoading(true)
        const res = await createAdmission(patientId, undefined, selectedWard.id, selectedBed.id)

        if (res.success) {
            toast.success(`${patientName} has been admitted to ${selectedWard.name} (Bed ${selectedBed.bed_no})`)
            setIsOpen(false)
            router.refresh()
        } else {
            toast.error(res.error)
        }
        setLoading(false)
    }

    const availableWards = wards.filter(w => w.hms_bed.some((b: any) => b.status === 'available'))

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <button className="text-emerald-600 hover:text-emerald-800 font-bold text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1 group">
                        <Activity className="h-3 w-3 group-hover:scale-110 transition-transform" />
                        IP Admission
                    </button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-4xl rounded-[2.5rem] p-0 border-none shadow-2xl overflow-hidden bg-slate-50 dark:bg-slate-950">
                <div className="flex flex-col h-[85vh]">
                    {/* Header Section */}
                    <div className="bg-white dark:bg-slate-900 p-8 border-b border-slate-100 dark:border-slate-800 shrink-0">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                                    <UserPlus className="h-6 w-6 text-indigo-600" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase italic underline decoration-indigo-500/30">
                                        In-Patient <span className="text-indigo-600">Admission</span>
                                    </DialogTitle>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Global Protocol V4.0</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-black text-slate-900 dark:text-white uppercase">{patientName}</p>
                                <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">Awaiting Bed Assignment</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-1 overflow-hidden">
                        {/* Wards Sidebar */}
                        <div className="w-1/3 border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            <h3 className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
                                Select Ward
                                <Badge variant="outline" className="text-[9px] border-slate-200">{availableWards.length} Available</Badge>
                            </h3>
                            {fetchingWards ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="h-16 bg-white dark:bg-slate-900/30 rounded-2xl animate-pulse" />
                                ))
                            ) : availableWards.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 italic text-sm">No available wards found.</div>
                            ) : availableWards.map(ward => (
                                <button
                                    key={ward.id}
                                    onClick={() => { setSelectedWard(ward); setSelectedBed(null); }}
                                    className={`
                                        w-full text-left p-4 rounded-2xl transition-all border-2
                                        ${selectedWard?.id === ward.id
                                            ? 'bg-white dark:bg-slate-800 border-indigo-600 shadow-lg shadow-indigo-100 dark:shadow-none'
                                            : 'bg-white/40 dark:bg-slate-900/20 border-transparent hover:border-slate-200 dark:hover:border-slate-800'}
                                    `}
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight text-xs">{ward.name}</p>
                                            <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                                                {ward.hms_bed.filter((b: any) => b.status === 'available').length} Vacant Units
                                            </p>
                                        </div>
                                        <ChevronRight className={`h-4 w-4 transition-transform ${selectedWard?.id === ward.id ? 'translate-x-1 text-indigo-600' : 'text-slate-300'}`} />
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Beds Grid */}
                        <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-950 custom-scrollbar">
                            {!selectedWard ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                                    <div className="h-20 w-20 rounded-full border-4 border-slate-100 dark:border-slate-900 flex items-center justify-center">
                                        <Home className="h-10 w-10" />
                                    </div>
                                    <p className="font-black uppercase text-sm tracking-widest text-slate-400 italic">Select a clinical ward to view available bed units</p>
                                </div>
                            ) : (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="flex items-center justify-between mb-8">
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">
                                                {selectedWard.name} <span className="text-indigo-600">Inventory</span>
                                            </h3>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Unit Status: Operational</p>
                                        </div>
                                        <Badge variant="outline" className="h-10 px-4 rounded-full border-emerald-100 text-emerald-600 font-black">
                                            LIVE STATUS
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-4">
                                        {selectedWard.hms_bed.map((bed: any) => (
                                            <button
                                                key={bed.id}
                                                disabled={bed.status !== 'available'}
                                                onClick={() => setSelectedBed(bed)}
                                                className={`
                                                    relative h-24 rounded-[1.5rem] flex flex-col items-center justify-center border-2 transition-all
                                                    ${bed.status !== 'available'
                                                        ? 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 opacity-40 grayscale cursor-not-allowed'
                                                        : selectedBed?.id === bed.id
                                                            ? 'bg-indigo-600 border-indigo-600 shadow-xl shadow-indigo-200 dark:shadow-none translate-y-[-4px]'
                                                            : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-indigo-200 hover:shadow-lg hover:translate-y-[-2px]'}
                                                `}
                                            >
                                                <BedIcon className={`h-6 w-6 mb-1 ${selectedBed?.id === bed.id ? 'text-white' : 'text-slate-400'}`} />
                                                <span className={`text-[10px] font-black tracking-widest uppercase ${selectedBed?.id === bed.id ? 'text-white' : 'text-slate-900 dark:text-slate-200'}`}>
                                                    {bed.bed_no}
                                                </span>
                                                {bed.status === 'occupied' && (
                                                    <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    {selectedBed && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="mt-12 p-6 rounded-[2rem] bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="h-14 w-14 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center font-black text-indigo-600 shadow-sm border border-slate-100 dark:border-slate-800">
                                                    <CheckCircle2 className="h-8 w-8" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-1">Confirmation Ready</p>
                                                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase leading-none">
                                                        Assign {patientName} to {selectedWard.name} Unit {selectedBed.bed_no}
                                                    </h3>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end text-right">
                                                <p className="text-[10px] font-black text-indigo-400 uppercase italic">Protocol Signature Required</p>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Section */}
                    <div className="p-8 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-indigo-600" />
                                <span className="text-[10px] font-black text-slate-400 uppercase">Available</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-slate-300 grayscale" />
                                <span className="text-[10px] font-black text-slate-400 uppercase">Occupied</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setIsOpen(false)}
                                className="h-14 px-8 rounded-2xl font-black uppercase text-xs tracking-widest border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
                            >
                                Cancel
                            </Button>
                            <Button
                                disabled={!selectedBed || loading}
                                onClick={handleAdmit}
                                className="h-14 px-12 rounded-2xl font-black uppercase text-xs tracking-[0.2em] bg-indigo-600 text-white shadow-xl shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-3"
                            >
                                {loading ? (
                                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        Finalize Admission <ChevronRight className="h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
