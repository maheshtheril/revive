'use client'

import { useState, useEffect } from "react"
import { getPendingLabOrders, updateLabOrderStatus } from "@/app/actions/lab"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
    Search, Filter, Clock, FlaskConical, ArrowRight, 
    CheckCircle2, Beaker, User, Calendar, Printer
} from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"

export default function LabPendingOrdersPage() {
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const { toast } = useToast()

    useEffect(() => {
        loadOrders()
    }, [])

    async function loadOrders() {
        setLoading(true)
        const res = await getPendingLabOrders()
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

    const handleStatusUpdate = async (id: string, status: string) => {
        const res = await updateLabOrderStatus({ orderId: id, status: status as any })
        if (res.success) {
            toast({ title: "Updated", description: `Order is now ${status.replace('_', ' ')}` })
            loadOrders()
        }
    }

    return (
        <div className="p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
                        <FlaskConical className="w-8 h-8 text-indigo-500" />
                        Active Lab Orders
                    </h1>
                    <p className="text-slate-500 mt-1">Manage sample collection and result entry</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Find Patient or Order..."
                            className="pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl w-64 focus:ring-2 focus:ring-indigo-500"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" className="rounded-xl gap-2">
                        <Filter className="w-4 h-4" />
                        Filters
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-4 text-slate-400">
                        <FlaskConical className="w-12 h-12 animate-pulse" />
                        <p className="animate-pulse">Loading active diagnostics queue...</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 p-12 rounded-2xl text-center">
                        <Beaker className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-slate-700 dark:text-white">No Pending Orders</h3>
                        <p className="text-slate-500">All samples processed and results reported.</p>
                    </div>
                ) : (
                    filteredOrders.map(order => (
                        <div key={order.id} className="group bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-indigo-500/50 transition-all shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-4">
                               <Badge variant={
                                    order.status === 'collected' ? 'secondary' : 
                                    order.status === 'in_progress' ? 'default' : 'outline'
                               } className="capitalize px-3 py-1 rounded-full text-xs font-bold">
                                    {order.status.replace('_', ' ')}
                               </Badge>
                            </div>

                            <div className="flex flex-col md:flex-row gap-6">
                                <div className="flex-1 space-y-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400">
                                            <User className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
                                                {order.hms_patient?.first_name} {order.hms_patient?.last_name}
                                            </h3>
                                            <div className="flex items-center gap-3 text-sm text-slate-500 font-medium">
                                                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider text-slate-600">
                                                    {order.order_number || 'No Order #'}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {format(new Date(order.created_at), 'MMM dd, HH:mm')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {(order.hms_lab_order_lines || []).map((line: any) => (
                                            <Badge key={line.id} variant="secondary" className="bg-slate-50 dark:bg-slate-900 border-none px-3 py-1 text-slate-600 dark:text-slate-400">
                                                {line.hms_lab_test?.name || line.requested_name}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-4 md:pt-0 md:pl-6">
                                    {order.status === 'requested' && (
                                        <Button 
                                            onClick={() => handleStatusUpdate(order.id, 'collected')}
                                            className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2 rounded-xl"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            Mark Collected
                                        </Button>
                                    )}
                                    {(order.status === 'collected' || order.status === 'in_progress') && (
                                        <Link href={`/hms/lab/results/${order.id}`}>
                                            <Button className="bg-indigo-500 hover:bg-indigo-600 text-white gap-2 rounded-xl">
                                                <FlaskConical className="w-4 h-4" />
                                                Enter Results
                                                <ArrowRight className="w-4 h-4 ml-1" />
                                            </Button>
                                        </Link>
                                    )}
                                    {order.status === 'completed' && (
                                        <Link href={`/hms/lab/reports/${order.id}`}>
                                            <Button variant="outline" className="rounded-xl gap-2 border-slate-200">
                                                <Printer className="w-4 h-4" />
                                                Report
                                            </Button>
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
