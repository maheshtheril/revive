
'use client'

import { useState, useEffect } from "react"
import { getAllLabOrders } from "@/app/actions/lab"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
    Search, Filter, Clock, FlaskConical, ArrowRight, 
    CheckCircle2, Beaker, User, Calendar, Printer, FileDown
} from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"

export default function LabOrdersRegisterPage() {
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")

    useEffect(() => {
        loadOrders()
    }, [])

    async function loadOrders() {
        setLoading(true)
        const res = await getAllLabOrders()
        if (res.success && res.data) {
            setOrders(res.data)
        }
        setLoading(false)
    }

    const filteredOrders = orders.filter(o => 
        o.hms_patient?.first_name?.toLowerCase().includes(search.toLowerCase()) ||
        o.hms_patient?.last_name?.toLowerCase().includes(search.toLowerCase()) ||
        o.order_number?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
                        <FileDown className="w-8 h-8 text-indigo-500" />
                        Laboratory Order Register
                    </h1>
                    <p className="text-slate-500 mt-1">Audit and history of all clinical investigations</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Find Patient or Order..."
                            className="pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl w-64 focus:ring-2 focus:ring-indigo-500 font-medium"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" className="rounded-xl gap-2 font-bold">
                        <Printer className="w-4 h-4" />
                        Export
                    </Button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900 text-left border-b border-slate-100 dark:border-slate-800">
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest whitespace-nowrap">Order Date</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Patient</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Investigations</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest w-32">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {loading ? (
                             <tr>
                                <td colSpan={5} className="p-20 text-center">
                                    <FlaskConical className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
                                    <p className="font-bold text-slate-400 animate-pulse">Scanning historical records...</p>
                                </td>
                             </tr>
                        ) : filteredOrders.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-20 text-center">
                                    <Beaker className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                                    <p className="font-bold text-slate-400 tracking-tight text-lg">Empty Record</p>
                                    <p className="text-slate-400 text-sm">No investigations found for this facility.</p>
                                </td>
                            </tr>
                        ) : (
                            filteredOrders.map(order => (
                                <tr key={order.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="font-black text-slate-800 dark:text-white flex items-center gap-1.5 whitespace-nowrap">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                            {format(new Date(order.created_at), 'dd MMM yyyy')}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{format(new Date(order.created_at), 'hh:mm a')}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold">
                                                {order.hms_patient?.first_name?.[0]}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 dark:text-white uppercase leading-none">{order.hms_patient?.first_name} {order.hms_patient?.last_name}</p>
                                                <p className="text-[10px] text-slate-400 font-bold mt-1 tracking-wider">{order.hms_patient?.patient_number}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1.5">
                                            {(order.hms_lab_order_lines || []).map((line: any) => (
                                                <span key={line.id} className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md whitespace-nowrap border border-slate-200/50 dark:border-slate-700/50">
                                                    {line.hms_lab_test?.name || line.requested_name}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <Badge variant={
                                            order.status === 'completed' ? 'default' : 
                                            order.status === 'collected' ? 'secondary' : 'outline'
                                        } className="rounded-full px-4 text-[10px] font-black uppercase tracking-widest py-1 shadow-sm">
                                            {order.status.replace('_', ' ')}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {order.status === 'completed' ? (
                                            <Link href={`/hms/lab/reports/${order.id}`}>
                                                <Button size="sm" variant="outline" className="rounded-xl gap-2 font-black border-slate-200">
                                                    <Printer className="w-4 h-4" />
                                                    View Report
                                                </Button>
                                            </Link>
                                        ) : (
                                            <Link href={`/hms/lab/results/${order.id}`}>
                                                <Button size="sm" variant="ghost" className="rounded-xl gap-2 font-bold text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50">
                                                    Enter Results
                                                    <ArrowRight className="w-4 h-4" />
                                                </Button>
                                            </Link>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
