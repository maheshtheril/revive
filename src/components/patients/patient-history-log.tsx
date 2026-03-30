'use client'

import { useState, useEffect } from 'react'
import { getPatientHistory } from '@/app/actions/audit'
import { Clock, User, AlertCircle, ChevronDown, ChevronUp, Database } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function PatientHistoryLog({ patientId }: { patientId: string }) {
    const [history, setHistory] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState<Set<string>>(new Set())

    useEffect(() => {
        loadHistory()
    }, [patientId])

    async function loadHistory() {
        setLoading(true)
        const res = await getPatientHistory(patientId)
        if (res.success) {
            setHistory(res.data)
        }
        setLoading(false)
    }

    const toggleExpand = (id: string | number) => {
        const next = new Set(expanded)
        const sid = String(id)
        if (next.has(sid)) next.delete(sid)
        else next.add(sid)
        setExpanded(next)
    }

    if (loading) return (
        <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-slate-100 rounded-3xl" />
            ))}
        </div>
    )

    if (history.length === 0) return (
        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100">
            <Database className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <h3 className="text-slate-400 font-bold uppercase tracking-widest text-sm">No Audit History Logged</h3>
            <p className="text-slate-300 text-xs mt-2 italic">Detailed change tracking is enabled for all modifications.</p>
        </div>
    )

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            <div className="px-4 mb-6 flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                    <Clock className="h-3 w-3" /> System Audit Trail (Last 50 Changes)
                </h3>
            </div>

            {history.map((log) => (
                <div key={log.history_id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden transition-all hover:border-indigo-100 group">
                    <div 
                        className="p-5 flex items-center justify-between cursor-pointer"
                        onClick={() => toggleExpand(log.history_id)}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${
                                log.operation === 'INSERT' ? 'bg-emerald-50 text-emerald-600' :
                                log.operation === 'UPDATE' ? 'bg-indigo-50 text-indigo-600' :
                                'bg-rose-50 text-rose-600'
                            }`}>
                                <Database className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-black text-slate-900 uppercase text-xs tracking-tight">{log.operation}</span>
                                    <span className="text-[10px] text-slate-400 font-bold">• {new Date(log.changed_at).toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5 text-slate-500 font-medium text-[11px]">
                                    <User className="h-3 w-3" /> {log.changed_by || 'SYSTEM'} • Automated Internal Record Sync
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                             {expanded.has(String(log.history_id)) ? <ChevronUp className="h-4 w-4 text-slate-300" /> : <ChevronDown className="h-4 w-4 text-slate-300" />}
                        </div>
                    </div>

                    <AnimatePresence>
                        {expanded.has(String(log.history_id)) && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden border-t border-slate-50 bg-slate-50/50"
                            >
                                <div className="p-6 grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-2">Previous State</h4>
                                        <div className="bg-white/80 p-4 rounded-2xl border border-slate-200/50 font-mono text-[10px] text-slate-600 whitespace-pre-wrap overflow-auto max-h-60">
                                            {JSON.stringify(log.old_data, null, 2)}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-[9px] font-black uppercase text-indigo-400 tracking-widest px-2">New State</h4>
                                        <div className="bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100 font-mono text-[10px] text-indigo-900 whitespace-pre-wrap overflow-auto max-h-60">
                                            {JSON.stringify(log.new_data, null, 2)}
                                        </div>
                                    </div>
                                </div>
                                {log.diff && (
                                    <div className="px-6 pb-6 space-y-2">
                                        <h4 className="text-[9px] font-black uppercase text-emerald-400 tracking-widest px-2">Modified Fields Only</h4>
                                        <div className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100 font-mono text-[10px] text-emerald-900">
                                            {JSON.stringify(log.diff, null, 2)}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            ))}
        </div>
    )
}
