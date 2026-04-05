'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Activity, Thermometer, Heart, Wind, PersonStanding,
    Weight, Ruler, Save, Loader2, Calculator, Info,
    X, ClipboardList
} from "lucide-react"
import { saveVitals, getVitals } from "@/app/actions/nursing-v2"
import { useToast } from "@/components/ui/use-toast"
import { motion, AnimatePresence } from "framer-motion"

interface Props {
    patientId: string
    encounterId: string
    tenantId: string
    initialData?: any
    onCancel?: () => void
    isModal?: boolean
}

export default function NursingVitalsForm({ patientId, encounterId, tenantId, initialData, onCancel, isModal }: Props) {
    const router = useRouter()
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(!initialData)

    // State
    const [height, setHeight] = useState(initialData?.height || '')
    const [weight, setWeight] = useState(initialData?.weight || '')
    const [bmi, setBmi] = useState('')
    const [bmiStatus, setBmiStatus] = useState('')

    const [temp, setTemp] = useState(initialData?.temperature || '')
    const [pulse, setPulse] = useState(initialData?.pulse || '')
    const [bpSys, setBpSys] = useState(initialData?.systolic || '')
    const [bpDia, setBpDia] = useState(initialData?.diastolic || '')
    const [map, setMap] = useState('') // Mean Arterial Pressure
    const [spo2, setSpo2] = useState(initialData?.spo2 || '')
    const [resp, setResp] = useState(initialData?.respiration || '')

    const [notes, setNotes] = useState(initialData?.notes || '')

    // Fetch if needed
    useEffect(() => {
        let isMounted = true;
        if (!initialData) {
            const fetchExisting = async () => {
                const data = await getVitals(encounterId)
                if (isMounted && data) {
                    setHeight(data.height?.toString() || '')
                    setWeight(data.weight?.toString() || '')
                    setTemp(data.temperature?.toString() || '')
                    setPulse(data.pulse?.toString() || '')
                    setBpSys(data.systolic?.toString() || '')
                    setBpDia(data.diastolic?.toString() || '')
                    setSpo2(data.spo2?.toString() || '')
                    setResp(data.respiration?.toString() || '')
                    setNotes(data.notes || '')
                }
                if (isMounted) setFetching(false)
            }
            fetchExisting()
        }
        return () => { isMounted = false; };
    }, [encounterId, initialData])

    // BMI Calc
    useEffect(() => {
        if (height && weight) {
            const h = parseFloat(height) / 100
            const w = parseFloat(weight)
            if (h > 0) {
                const val = (w / (h * h)).toFixed(1)
                setBmi(val)
                const num = parseFloat(val)
                if (num < 18.5) setBmiStatus('Underweight')
                else if (num < 25) setBmiStatus('Normal')
                else if (num < 30) setBmiStatus('Overweight')
                else setBmiStatus('Obese')
            }
        } else {
            setBmi('')
            setBmiStatus('')
        }
    }, [height, weight])

    // MAP Calc
    useEffect(() => {
        if (bpSys && bpDia) {
            const s = parseInt(bpSys)
            const d = parseInt(bpDia)
            if (!isNaN(s) && !isNaN(d)) {
                const m = d + (s - d) / 3
                setMap(Math.round(m).toString())
            } else {
                setMap('')
            }
        }
    }, [bpSys, bpDia])


    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        setLoading(true)
        try {
            const res = await saveVitals({
                tenantId,
                patientId,
                encounterId,
                height,
                weight,
                temperature: temp,
                pulse,
                systolic: bpSys,
                diastolic: bpDia,
                spo2,
                respiration: resp,
                notes
            })

            if (res.success) {
                toast({
                    title: "Assessment Saved",
                    description: "Vitals recorded successfully.",
                    className: "bg-green-600 text-white border-none"
                })
                if (onCancel) onCancel() // Close modal if in modal
                else router.back()
                router.refresh()
            } else {
                toast({
                    title: "Error",
                    description: res.error,
                    variant: "destructive"
                })
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to save vitals",
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }

    if (fetching) return <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    }
    const item = {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 }
    }

    return (
        <form id="nursing-vitals-form" onSubmit={handleSubmit} className="h-full flex flex-col">
            <div className={`flex-1 flex flex-col gap-4 ${isModal ? '' : 'pb-24'} p-1`}>
                {/* TOP ROW: ANTHROPOMETRY & KEY VITALS */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-none">

                    {/* BODY METRICS CARD */}
                    <div className="col-span-1 md:col-span-12 xl:col-span-3">
                        <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm h-full flex flex-col justify-between relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/40 to-purple-50/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3 relative z-10">
                                <Ruler className="h-3.5 w-3.5" /> Body Metrics
                            </h3>

                            <div className="flex gap-3 relative z-10">
                                <div className="flex-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Height (cm)</label>
                                    <input
                                        type="number"
                                        value={height}
                                        onChange={e => setHeight(e.target.value)}
                                        className="w-full text-xl font-black text-slate-900 outline-none bg-slate-50/50 rounded-lg px-2 py-2 border border-slate-100 focus:border-indigo-300 focus:bg-white transition-all shadow-inner relative z-50 cursor-text"
                                        placeholder="--"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Weight (kg)</label>
                                    <input
                                        type="number"
                                        value={weight}
                                        onChange={e => setWeight(e.target.value)}
                                        className="w-full text-xl font-black text-slate-900 outline-none bg-slate-50/50 rounded-lg px-2 py-2 border border-slate-100 focus:border-indigo-300 focus:bg-white transition-all shadow-inner relative z-50 cursor-text"
                                        placeholder="--"
                                    />
                                </div>
                            </div>

                            {/* Compact BMI Strip */}
                            <div className="mt-4 bg-slate-100 rounded-lg p-2.5 flex items-center justify-between relative z-10">
                                <div>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">BMI Index</span>
                                    <div className="text-lg font-black text-slate-700 leading-none">{bmi || '--'}</div>
                                </div>
                                <div className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${bmiStatus === 'Normal' ? 'bg-green-100 text-green-700' :
                                    bmiStatus === 'Overweight' ? 'bg-orange-100 text-orange-700' :
                                        bmiStatus === 'Obese' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-500'
                                    }`}>
                                    {bmiStatus || 'N/A'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* MAIN VITALS GRID - WORLD STANDARD MOBILE RESPONSE */}
                    <div className="col-span-1 md:col-span-12 xl:col-span-9 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">

                        {/* BP - Spans 2 cols on mobile/tablet */}
                        <div className="col-span-2 bg-gradient-to-br from-indigo-50/50 to-white/50 rounded-2xl p-4 border border-white/60 shadow-sm relative overflow-hidden">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                    <Activity className="h-3.5 w-3.5" /> Blood Pressure
                                </h4>
                                {map && <span className="text-[9px] font-bold text-indigo-600 bg-white/50 px-1.5 py-0.5 rounded border border-indigo-100">MAP: {map}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex-1">
                                    <label className="text-[9px] font-black text-indigo-300 uppercase block mb-1">Systolic</label>
                                    <input
                                        type="number"
                                        value={bpSys}
                                        onChange={e => setBpSys(e.target.value)}
                                        className="w-full text-3xl font-black text-indigo-900 outline-none bg-white/60 rounded-xl px-2 py-2 border border-indigo-100 focus:border-indigo-400 focus:bg-white transition-all placeholder-indigo-100 shadow-inner relative z-50 cursor-text"
                                        placeholder="120"
                                    />
                                </div>
                                <span className="text-xl font-black text-indigo-200 mt-6">/</span>
                                <div className="flex-1">
                                    <label className="text-[9px] font-black text-indigo-300 uppercase block mb-1">Diastolic</label>
                                    <input
                                        type="number"
                                        value={bpDia}
                                        onChange={e => setBpDia(e.target.value)}
                                        className="w-full text-3xl font-black text-indigo-900 outline-none bg-white/60 rounded-xl px-2 py-2 border border-indigo-100 focus:border-indigo-400 focus:bg-white transition-all placeholder-indigo-100 shadow-inner relative z-50 cursor-text"
                                        placeholder="80"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Heart Rate */}
                        <div className="bg-white/50 backdrop-blur-md rounded-2xl p-4 border border-white/60 shadow-sm hover:shadow-md transition-all group">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5 text-rose-500/80 group-hover:animate-pulse" /> HR</span>
                            </h4>
                            <div className="flex items-baseline gap-1">
                                <input
                                    type="number"
                                    value={pulse}
                                    onChange={e => setPulse(e.target.value)}
                                    className="w-full text-3xl font-black text-slate-900 outline-none bg-transparent placeholder-slate-200"
                                    placeholder="--"
                                />
                                <span className="text-[10px] font-bold text-slate-400">bpm</span>
                            </div>
                        </div>

                        {/* SpO2 */}
                        <div className="bg-white/50 backdrop-blur-md rounded-2xl p-4 border border-white/60 shadow-sm hover:shadow-md transition-all">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1"><Wind className="h-3.5 w-3.5 text-cyan-500/80" /> SpO2</span>
                            </h4>
                            <div className="flex items-baseline gap-1">
                                <input
                                    type="number"
                                    value={spo2}
                                    onChange={e => setSpo2(e.target.value)}
                                    className="w-full text-3xl font-black text-slate-900 outline-none bg-transparent placeholder-slate-200"
                                    placeholder="--"
                                />
                                <span className="text-[10px] font-bold text-slate-400">%</span>
                            </div>
                        </div>

                        {/* Temp */}
                        <div className="bg-white/50 backdrop-blur-md rounded-2xl p-4 border border-white/60 shadow-sm hover:shadow-md transition-all">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1"><Thermometer className="h-3.5 w-3.5 text-orange-500" /> Temp</span>
                            </h4>
                            <div className="flex items-baseline gap-1">
                                <input
                                    type="number"
                                    step="0.1"
                                    value={temp}
                                    onChange={e => setTemp(e.target.value)}
                                    className="w-full text-3xl font-black text-slate-900 outline-none bg-transparent placeholder-slate-200"
                                    placeholder="--"
                                />
                                <span className="text-[10px] font-bold text-slate-400">°F</span>
                            </div>
                        </div>

                        {/* Resp */}
                        <div className="bg-white/50 backdrop-blur-md rounded-2xl p-4 border border-white/60 shadow-sm hover:shadow-md transition-all">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1"><Activity className="h-3.5 w-3.5 text-teal-500" /> Resp</span>
                            </h4>
                            <div className="flex items-baseline gap-1">
                                <input
                                    type="number"
                                    value={resp}
                                    onChange={e => setResp(e.target.value)}
                                    className="w-full text-3xl font-black text-slate-900 outline-none bg-transparent placeholder-slate-200"
                                    placeholder="--"
                                />
                                <span className="text-[10px] font-bold text-slate-400">/min</span>
                            </div>
                        </div>

                    </div>
                </div>

                {/* NOTES SECTION - High Speed Input */}
                <div className="flex-1 min-h-[150px] bg-white/50 backdrop-blur-md rounded-2xl p-4 border border-white/60 shadow-sm flex flex-col">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" /> Observations & Clinical Notes
                    </label>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        className="flex-1 w-full bg-white/70 border border-slate-200 rounded-xl p-4 text-base font-medium outline-none focus:ring-2 focus:ring-indigo-100 transition-all font-sans resize-none shadow-sm"
                        placeholder="Type observation notes here..."
                    />
                </div>

                {/* ACTION BAR - Floating if NOT modal, Inline if Modal? */}
                {isModal ? null : (
                    <div
                        className="fixed bottom-0 left-0 w-full p-4 flex justify-center z-50 pointer-events-none"
                    >
                        <div className="bg-white/90 backdrop-blur-xl border border-white/20 shadow-2xl rounded-full p-2 flex items-center gap-2 pointer-events-auto transform hover:scale-[1.02] transition-transform">
                            <button
                                type="button"
                                onClick={() => onCancel ? onCancel() : router.back()}
                                className="px-6 py-3 rounded-full text-slate-500 font-bold hover:bg-slate-100 transition-colors text-sm"
                            >
                                Cancel
                            </button>
                            <div className="w-px h-6 bg-slate-200" />
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-slate-900 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-slate-900/20 flex items-center gap-2 hover:bg-black disabled:opacity-50 transition-colors"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save Assessment
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </form>
    )
}
