'use client'

import { useState, useEffect } from 'react'
import { getGlobalAuditLogs } from '@/app/actions/audit-global'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { History, Search, RefreshCcw, User, Calendar, Database, Shield } from 'lucide-react'
import { format } from 'date-fns'

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)

    useEffect(() => {
        fetchLogs()
    }, [page])

    async function fetchLogs() {
        setLoading(true)
        const res = await getGlobalAuditLogs(page)
        if (res.success) {
            setLogs(res.data)
            setTotal(res.total || 0)
        }
        setLoading(false)
    }

    const getOpColor = (op: string) => {
        switch (op?.toUpperCase()) {
            case 'CREATE': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            case 'UPDATE': return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
            case 'DELETE': return 'bg-rose-500/10 text-rose-500 border-rose-500/20'
            default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20'
        }
    }

    return (
        <div className="p-8 space-y-6 bg-slate-50/50 min-h-screen">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                        <History className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Audit Log</h1>
                        <p className="text-slate-500 text-sm font-medium">Compliance and activity trail for all institutional transactions</p>
                    </div>
                </div>
                <Button onClick={fetchLogs} variant="outline" className="gap-2 bg-white font-bold border-slate-200">
                    <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Logs
                </Button>
            </div>

            <Card className="border-slate-200/60 shadow-sm overflow-hidden bg-white/80 backdrop-blur">
                <CardHeader className="border-b border-slate-100 bg-slate-50/30">
                    <div className="flex items-center gap-4">
                         <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input placeholder="Search logs by user, table, or event..." className="pl-10 h-10 border-slate-200 focus:ring-indigo-500 focus:border-indigo-500 font-medium" />
                         </div>
                         <div className="flex gap-2">
                             <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 font-black uppercase text-[10px] px-3 py-1">Standardized Audit v4.5</Badge>
                             <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 font-bold px-3 py-1">Compliant</Badge>
                         </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                                <TableHead className="font-bold text-slate-900 w-[180px]">Timestamp</TableHead>
                                <TableHead className="font-bold text-slate-900">Actor</TableHead>
                                <TableHead className="font-bold text-slate-900 text-center">Operation</TableHead>
                                <TableHead className="font-bold text-slate-900">Module/Table</TableHead>
                                <TableHead className="font-bold text-slate-900">Event Details</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={5} className="h-16 animate-pulse bg-slate-50/30" />
                                    </TableRow>
                                ))
                            ) : logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-40 text-center text-slate-500 font-medium italic">
                                        <div className="flex flex-col items-center gap-2">
                                            <Database className="h-8 w-8 opacity-20" />
                                            No audit logs found for the current period.
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : logs.map((log) => (
                                <TableRow key={log.id} className="hover:bg-slate-50/50 group transition-colors">
                                    <TableCell className="text-slate-500 text-[13px] font-medium">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                                            {log.created_at ? format(new Date(log.created_at), 'dd-MMM-yy HH:mm') : '-'}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-bold text-slate-700">
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-slate-300" />
                                            <span className="truncate max-w-[150px]">{log.app_user?.name || log.actor_id || 'SYSTEM'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className={`font-black uppercase text-[10px] ${getOpColor(log.operation)}`}>
                                            {log.operation || 'LOG'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-semibold text-slate-900">
                                        <div className="flex items-center gap-2">
                                            <Shield className="h-3.5 w-3.5 text-slate-400" />
                                            <span className="uppercase tracking-wider text-[11px]">{log.table_name || 'GENERAL'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-slate-600 font-medium">
                                        {log.event}
                                        {log.diff && Object.keys(log.diff).length > 0 && (
                                            <span className="ml-2 text-[10px] text-indigo-500 cursor-pointer underline">(View Diff)</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    <div className="p-4 border-t border-slate-100 bg-slate-50/20 flex items-center justify-between">
                         <span className="text-sm text-slate-500 font-medium">Showing {(page-1)*50 + 1} - {Math.min(page*50, total)} of {total} entries</span>
                         <div className="flex gap-2">
                             <Button disabled={page === 1} onClick={() => setPage(p => p - 1)} variant="outline" className="h-8 px-4 font-bold">Previous</Button>
                             <Button disabled={logs.length < 50} onClick={() => setPage(p => p + 1)} variant="outline" className="h-8 px-4 font-bold">Next</Button>
                         </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
