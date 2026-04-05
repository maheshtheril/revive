'use client'

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { getLabOrderForReporting, saveLabResults } from "@/app/actions/lab"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
    FlaskConical, Save, ArrowLeft, Loader2, User, 
    Calendar, CheckCircle2, FlaskRound, Info, Beaker,
    Printer, Hash, ShieldCheck, FileText
} from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/components/ui/use-toast"
import Link from "next/link"

export default function LabResultEntryPage() {
    const { id } = useParams()
    const router = useRouter()
    const { toast } = useToast()
    const [order, setOrder] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [results, setResults] = useState<any[]>([])

    useEffect(() => {
        loadOrder()
    }, [id])

    async function loadOrder() {
        setLoading(true)
        const res = await getLabOrderForReporting(id as string)
        if (res.success && res.data) {
            setOrder(res.data)
            // Pre-fill results state
            const initialResults = (res.data.hms_lab_order_lines || []).map((line: any) => ({
                orderLineId: line.id,
                testId: line.test_id,
                testName: line.hms_lab_test?.name || line.requested_name,
                value: line.hms_lab_result?.[0]?.result_value || "",
                remarks: line.hms_lab_result?.[0]?.interpreted_value || "",
                units: line.hms_lab_test?.units || line.hms_lab_result?.[0]?.units || "",
                refRange: line.hms_lab_test?.reference_range || line.hms_lab_result?.[0]?.reference_range || "",
                isVerified: !!line.hms_lab_result?.[0]?.verified_at
            }))
            setResults(initialResults)
        }
        setLoading(false)
    }

    const handleResultChange = (index: number, field: string, value: any) => {
        const newResults = [...results]
        newResults[index][field] = value
        setResults(newResults)
    }

    const handleSubmit = async (verify: boolean = false) => {
        setSaving(true)
        const payload = {
            orderId: id as string,
            results: results.map(r => ({
                orderLineId: r.orderLineId,
                testId: r.testId,
                value: r.value,
                remarks: r.remarks,
                isVerified: verify
            }))
        }

        const res = await saveLabResults(payload)
        if (res.success) {
            toast({ title: "Results Saved", description: verify ? "Reports verified and completed." : "Progress saved successfully." })
            if (verify) {
                router.push(`/hms/lab/reports/${id}`)
            } else {
                router.push('/hms/lab/pending')
            }
        } else {
            toast({ title: "Error", description: res.error || "Failed to save results", variant: "destructive" })
        }
        setSaving(false)
    }

    if (loading) return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
            <p className="font-bold text-xl animate-pulse tracking-wide">Loading Diagnostic Profile...</p>
        </div>
    )

    if (!order) return <div>Order not found</div>

    return (
        <div className="p-8 space-y-6 max-w-7xl mx-auto selection:bg-indigo-500/30">
            <div className="flex items-center gap-4 mb-2">
                <Link href="/hms/lab/pending">
                    <Button variant="ghost" className="rounded-full w-10 h-10 p-0 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                        Laboratory Results Entry 
                        <Badge variant="outline" className="text-indigo-600 bg-indigo-50/50 border-indigo-200 uppercase text-[10px] ml-2 px-2 py-0.5">
                           {order.order_number}
                        </Badge>
                    </h1>
                    <p className="text-slate-500 text-sm">Reviewing order for {order.hms_patient?.first_name} {order.hms_patient?.last_name}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Header Information Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500">
                                <User className="w-5 h-5" />
                           </div>
                           <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Patient Name</p>
                                <p className="font-bold text-slate-800 dark:text-white">{order.hms_patient?.first_name} {order.hms_patient?.last_name}</p>
                           </div>
                        </div>

                        <div className="flex items-center gap-3 pt-2 border-t border-slate-50 dark:border-slate-800">
                           <div className="w-10 h-10 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
                                <FlaskRound className="w-5 h-5" />
                           </div>
                           <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Ordered By</p>
                                <p className="font-bold text-slate-800 dark:text-white">Dr. {order.hms_appointment?.hms_clinician?.first_name} {order.hms_appointment?.hms_clinician?.last_name || 'Medical Consultant'}</p>
                           </div>
                        </div>

                        <div className="flex items-center gap-3 pt-2 border-t border-slate-50 dark:border-slate-800">
                           <div className="w-10 h-10 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500">
                                <Calendar className="w-5 h-5" />
                           </div>
                           <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Order Date</p>
                                <p className="font-bold text-slate-800 dark:text-white">{format(new Date(order.created_at), 'MMMM dd, yyyy')}</p>
                           </div>
                        </div>
                    </div>

                    <div className="bg-indigo-500 p-6 rounded-3xl text-white shadow-xl shadow-indigo-500/20 space-y-1">
                        <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest">Technician Helper</p>
                        <h4 className="text-lg font-black leading-tight text-white mb-2">Check Flags Before Verifying</h4>
                        <p className="text-xs text-indigo-100/80 leading-relaxed font-medium">Verify results against reference ranges before finalizing the clinical report. High/Low flags are computed automatically in the final report PDF.</p>
                    </div>
                </div>

                {/* Test Entry Table */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Diagnostic Test</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest w-48">Result Value</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest w-32">Units</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Normal Range</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {results.map((res, index) => (
                                        <tr key={index} className="group hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors">
                                                        <Beaker className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800 dark:text-slate-200">{res.testName}</p>
                                                        <Input 
                                                            placeholder="Add clinical observation/remarks..." 
                                                            className="mt-1 h-7 text-[10px] border-none bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 px-0 focus:ring-0 focus:px-2 rounded-md italic"
                                                            value={res.remarks}
                                                            onChange={(e) => handleResultChange(index, "remarks", e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <Input 
                                                    className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500"
                                                    placeholder="Result..."
                                                    value={res.value}
                                                    onChange={(e) => handleResultChange(index, "value", e.target.value)}
                                                />
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="text-sm font-black text-slate-500 uppercase">{res.units || "N/A"}</span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-900/80 px-4 py-2 rounded-2xl border border-slate-200/50 dark:border-slate-800">
                                                    <Info className="w-3 h-3 text-indigo-400" />
                                                    {typeof res.refRange === 'object' ? JSON.stringify(res.refRange) : res.refRange || "—"}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl gap-4">
                        <div className="flex gap-4">
                           <Button 
                                variant="outline" 
                                className="rounded-2xl gap-2 font-bold px-6"
                                onClick={() => handleSubmit(false)}
                                disabled={saving}
                            >
                                <Save className="w-4 h-4" />
                                Save as Draft
                            </Button>
                        </div>
                        
                        <div className="flex gap-4">
                                <Button 
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2 font-black rounded-2xl px-10 shadow-lg shadow-emerald-500/20"
                                    onClick={() => handleSubmit(true)}
                                    disabled={saving}
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                    Verify & Deliver Result
                                </Button>
                        </div>
                   </div>
                </div>
            </div>
        </div>
    )
}
