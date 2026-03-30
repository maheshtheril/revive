'use client'

import { useState, useEffect } from 'react'
import { 
    Calendar, UserPlus, Heart, Stethoscope, 
    FlaskConical, ArrowUpRight, Activity, 
    LogOut, CreditCard, ChevronRight, Clock,
    Search, Filter, Download, ExternalLink,
    MapPin, Clipboard, AlertCircle, TrendingUp, TrendingDown,
    MapPin as BedIcon
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getPatientTimeline, TimelineEvent } from '@/app/actions/clinical'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const EVENT_ICONS: Record<string, any> = {
    'REGISTRATION': { icon: UserPlus, color: 'bg-blue-500', text: 'text-blue-500' },
    'APPOINTMENT': { icon: Calendar, color: 'bg-indigo-500', text: 'text-indigo-500' },
    'ADMISSION': { icon: BedIcon, color: 'bg-emerald-500', text: 'text-emerald-500' },
    'VITALS': { icon: Heart, color: 'bg-rose-500', text: 'text-rose-500' },
    'PRESCRIPTION': { icon: Stethoscope, color: 'bg-violet-500', text: 'text-violet-500' },
    'LAB_ORDER': { icon: FlaskConical, color: 'bg-amber-500', text: 'text-amber-500' },
    'DISCHARGE': { icon: LogOut, color: 'bg-teal-500', text: 'text-teal-500' },
    'BILLING': { icon: CreditCard, color: 'bg-slate-700', text: 'text-slate-700' }
}

export function ClinicalTimeline({ patientId }: { patientId: string }) {
    const [events, setEvents] = useState<TimelineEvent[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<string>('ALL')
    const [patient, setPatient] = useState<any>(null)

    useEffect(() => {
        loadEvents()
    }, [patientId])

    async function loadEvents() {
        setLoading(true)
        const res = await getPatientTimeline(patientId)
        if (res.success) {
            setEvents(res.data || [])
            setPatient(res.patient)
        }
        setLoading(false)
    }

    const filteredEvents = filter === 'ALL' ? events : events.filter(e => e.type === filter)

    if (loading) return (
        <div className="space-y-6">
            <Skeleton className="h-40 w-full rounded-3xl" />
            <Skeleton className="h-96 w-full rounded-3xl" />
        </div>
    )

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-32 animate-in fade-in duration-700">
            {/* Clinical ID Banner */}
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-white dark:border-slate-800 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Activity className="h-64 w-64" />
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="h-24 w-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-4xl font-black text-white shadow-xl shadow-indigo-200 dark:shadow-none">
                            {patient?.first_name?.[0]}{patient?.last_name?.[0]}
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none">
                                {patient?.first_name} {patient?.last_name}
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 mt-2 font-bold flex items-center gap-2">
                                <Badge variant="outline" className="border-indigo-100 text-indigo-600 uppercase font-bold text-[10px] tracking-widest">{patient?.patient_number || 'REG-ID'}</Badge>
                                <span>• {patient?.gender} • {patient?.blood_group || 'O+'}</span>
                            </p>
                        </div>
                    </div>

                    {/* Clinical Terminal Quick Actions */}
                    <div className="flex flex-wrap gap-2">
                        <Button 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl h-12 px-6 shadow-lg shadow-indigo-100 dark:shadow-none transition-all hover:scale-105 active:scale-95"
                            asChild
                        >
                            <a href={`/hms/prescriptions/new?patientId=${patientId}`}>+ Prescription</a>
                        </Button>
                        <Button 
                            variant="outline"
                            className="bg-white dark:bg-slate-800 border-indigo-100 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase tracking-widest rounded-2xl h-12 px-6 shadow-sm hover:bg-slate-50 transition-all hover:scale-105 active:scale-95"
                            asChild
                        >
                            <a href={`/hms/appointments/new?patientId=${patientId}`}>+ Appointment</a>
                        </Button>
                        <Button 
                            variant="outline"
                            className="bg-white dark:bg-slate-800 border-rose-100 dark:border-slate-700 text-rose-600 dark:text-rose-400 font-black text-[10px] uppercase tracking-widest rounded-2xl h-12 px-6 shadow-sm hover:bg-slate-50 transition-all hover:scale-105 active:scale-95"
                            asChild
                        >
                            <a href={`/hms/billing/new?patientId=${patientId}`}>+ Billing</a>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Event Filter & Stats */}
            <div className="flex items-center gap-4 px-4 overflow-x-auto no-scrollbar py-2">
                {['ALL', ...Object.keys(EVENT_ICONS)].map(type => (
                    <button
                        key={type}
                        onClick={() => setFilter(type)}
                        className={`
                            px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all
                            ${filter === type 
                                ? 'bg-slate-900 text-white shadow-lg shadow-slate-200 dark:shadow-none translate-y-[-2px]' 
                                : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-100 dark:border-slate-700 hover:bg-slate-50'}
                        `}
                    >
                        {type.replace('_', ' ')}
                    </button>
                ))}
            </div>

            {/* The Timeline */}
            <div className="relative pl-10 md:pl-24 space-y-12 after:absolute after:inset-y-0 after:left-[1.8rem] md:after:left-[4.45rem] after:w-1 after:bg-slate-100 dark:after:bg-slate-800 after:rounded-full">
                <AnimatePresence mode="popLayout">
                    {filteredEvents.map((event, index) => {
                        const IconConfig = EVENT_ICONS[event.type]
                        const Icon = IconConfig?.icon || Clock

                        return (
                            <motion.div
                                key={event.id}
                                layout
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ delay: index * 0.05 }}
                                className="relative group"
                            >
                                {/* Time marker */}
                                <div className="absolute -left-10 md:-left-24 top-2 text-right w-8 md:w-20 pr-4 print:static print:w-auto">
                                    <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase leading-none mb-1">
                                        {new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </div>
                                    <div className="text-[11px] font-bold text-slate-900 dark:text-white">
                                        {new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>

                                {/* Icon Bubble */}
                                <div className={`
                                    absolute -left-[4.85rem] md:-left-[2.25rem] top-0 h-10 w-10 rounded-2xl ${IconConfig?.color} 
                                    flex items-center justify-center shadow-lg shadow-indigo-200/40 z-10 transition-transform group-hover:scale-110 duration-500
                                `}>
                                    <Icon className="h-5 w-5 text-white" />
                                </div>

                                {/* Event Card */}
                                <div className="bg-white dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-50 dark:border-slate-800 shadow-xl shadow-slate-100/40 dark:shadow-none hover:shadow-2xl hover:border-indigo-100 dark:hover:border-indigo-900 transition-all duration-500">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors uppercase tracking-tight">
                                                {event.title}
                                            </h3>
                                            <p className="text-slate-500 dark:text-slate-400 font-bold text-sm tracking-tight">
                                                {event.description}
                                            </p>
                                        </div>
                                        <Badge variant="outline" className={`uppercase font-bold text-[8px] tracking-[0.1em] border-none px-2 rounded-lg opacity-60 ${IconConfig?.text}`}>
                                            {event.type}
                                        </Badge>
                                    </div>

                                    {/* Collapsible Details / Metadata */}
                                    {event.type === 'VITALS' && (
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-700">
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Temp</span>
                                                <span className="text-xl font-black text-rose-500">{event.metadata.temperature}°F</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Pulse</span>
                                                <span className="text-xl font-black text-indigo-600">{event.metadata.pulse} bpm</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Blood Pressure</span>
                                                <span className="text-xl font-black text-emerald-600">{event.metadata.systolic}/{event.metadata.diastolic}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">SpO2</span>
                                                <span className={`text-xl font-black ${event.metadata.spo2 < 94 ? 'text-orange-500' : 'text-blue-500'}`}>{event.metadata.spo2}%</span>
                                            </div>
                                        </div>
                                    )}

                                    {event.type === 'LAB_ORDER' && event.metadata.tests && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {event.metadata.tests.map((test: string, idx: number) => (
                                                <span key={idx} className="px-3 py-1 bg-amber-50 dark:bg-amber-900/10 text-amber-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-100 dark:border-amber-900/30">
                                                    {test}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {event.type === 'BILLING' && (
                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-2">
                                                <Badge className={event.metadata.status === 'paid' ? 'bg-emerald-500' : 'bg-amber-500'}>
                                                    {event.metadata.status}
                                                </Badge>
                                                <span className="text-lg font-black text-slate-900 dark:text-white tracking-widest">₹{event.metadata.total}</span>
                                            </div>
                                            <Button variant="ghost" size="sm" className="rounded-xl text-indigo-600 font-black h-8 px-4 hover:bg-slate-100">
                                                Print Reciept <ExternalLink className="ml-2 h-3 w-3" />
                                            </Button>
                                        </div>
                                    )}

                                    {event.type === 'PRESCRIPTION' && (
                                        <div className="mt-2 text-xs font-bold text-slate-600 bg-violet-50/50 p-4 rounded-2xl border border-violet-100 italic">
                                            "{event.metadata.plan || 'Advised rest and follow up'}"
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )
                    })}
                </AnimatePresence>

                {filteredEvents.length === 0 && (
                    <div className="py-20 text-center bg-slate-50 dark:bg-slate-900/50 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                        <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-400 uppercase tracking-widest">No matching clinical records</h3>
                    </div>
                )}
            </div>
        </div>
    )
}
