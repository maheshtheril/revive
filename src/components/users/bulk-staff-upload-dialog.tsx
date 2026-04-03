'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { 
    Upload, FileText, CheckCircle2, AlertCircle, 
    Loader2, Users, Download, X, Trash2, ArrowRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { bulkInviteUsers } from '@/app/actions/users'
import { useRouter } from 'next/navigation'

interface BulkStaffUploadDialogProps {
    roles: Array<{ id: string; name: string }>
}

export function BulkStaffUploadDialog({ roles = [] }: BulkStaffUploadDialogProps) {
    const { toast } = useToast()
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState<'upload' | 'preview' | 'results'>('upload')
    const [parsedData, setParsedData] = useState<any[]>([])
    const [results, setResults] = useState<any>(null)

    const downloadSample = () => {
        const headers = [['Full Name', 'Email', 'Role Name', 'System Access (admin/user)']]
        const sampleRows = [['John Doe', 'john@hospital.com', roles[0]?.name || 'Doctor', 'user']]
        const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleRows])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Staff_Template")
        XLSX.writeFile(wb, "Staff_Import_Template.xlsx")
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const data = new Uint8Array(event.target?.result as ArrayBuffer)
            const workbook = XLSX.read(data, { type: 'array' })
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]
            const json: any[] = XLSX.utils.sheet_to_json(worksheet)

            // Normalize and Validate
            const normalized = json.map(row => {
                const fullName = row['Full Name'] || row['Name'] || row['fullName'] || '';
                const email = row['Email'] || row['email'] || '';
                const roleName = row['Role Name'] || row['Role'] || row['role'] || '';
                const systemRole = (row['System Access'] || row['SystemRole'] || row['systemRole'] || 'user').toLowerCase().trim() as 'admin' | 'user';
                
                // Find Role ID by Name
                const role = roles.find(r => r.name.toLowerCase() === roleName.toLowerCase())
                
                return {
                    fullName,
                    email,
                    roleId: role?.id,
                    roleName: role?.name || 'No Role Assigned',
                    systemRole: (systemRole === 'admin' || systemRole === 'user') ? systemRole : 'user',
                    isValid: !!email && email.includes('@')
                }
            })

            setParsedData(normalized)
            setStep('preview')
        }
        reader.readAsArrayBuffer(file)
    }

    const processUpload = async () => {
        const validUsers = parsedData.filter(u => u.isValid)
        if (validUsers.length === 0) {
            toast({ title: "No valid data", description: "Please check your file for valid emails.", variant: "destructive" })
            return
        }

        setLoading(true)
        const res = await bulkInviteUsers(validUsers.map(u => ({
            email: u.email,
            fullName: u.fullName,
            roleId: u.roleId,
            systemRole: u.systemRole
        })))
        setLoading(false)

        if (res.success) {
            setResults(res.results)
            setStep('results')
            router.refresh()
        } else {
            toast({ title: "Upload Failed", description: res.error || "Internal error", variant: "destructive" })
        }
    }

    const reset = () => {
        setOpen(false)
        setStep('upload')
        setParsedData([])
        setResults(null)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="h-12 px-6 rounded-xl font-bold border-slate-200 hover:bg-slate-50 transition-all gap-2 group shadow-sm">
                    <Download className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 rotate-180" />
                    Bulk Import Staff
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden border-none rounded-[2rem] shadow-2xl bg-white dark:bg-slate-900">
                
                {/* Header */}
                <div className="p-8 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black tracking-tight">Staff Power Importer</DialogTitle>
                            <DialogDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">High-velocity personnel onboarding</DialogDescription>
                        </div>
                    </div>
                </div>

                <div className="p-8">
                    {step === 'upload' && (
                        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                            <div className="flex items-center justify-between p-6 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-3xl border border-indigo-100 dark:border-indigo-900/20">
                                <div className="flex items-center gap-4">
                                    <FileText className="h-10 w-10 text-indigo-600" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-black text-indigo-900 dark:text-indigo-400">Need a format guide?</p>
                                        <p className="text-[10px] font-bold text-indigo-600/60 uppercase tracking-wider">Download the professional Excel template</p>
                                    </div>
                                </div>
                                <Button onClick={downloadSample} variant="secondary" className="bg-white hover:bg-white text-indigo-600 font-bold px-6 rounded-xl shadow-sm hover:translate-y-[-2px] transition-all">
                                    Template.xlsx
                                </Button>
                            </div>

                            <div className="relative group">
                                <input 
                                    type="file" 
                                    accept=".xlsx, .xls, .csv" 
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <div className="h-64 border-4 border-dashed border-slate-100 dark:border-slate-800 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 group-hover:border-indigo-200 dark:group-hover:border-indigo-500/30 transition-all bg-white dark:bg-slate-900 shadow-inner">
                                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-950 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                                        <Upload className="h-8 w-8 text-slate-300 group-hover:text-indigo-500" />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-black text-lg text-slate-700 dark:text-slate-200">Drop your spreadsheet here</p>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">or browse clinical systems files</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="max-h-[400px] overflow-y-auto rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-950 z-20">
                                        <tr>
                                            <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">Status</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">Identity</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">Email Address</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">Assigned Role</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                        {parsedData.map((row, i) => (
                                            <tr key={i} className={`hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors ${!row.isValid ? 'bg-red-50/30' : ''}`}>
                                                <td className="px-5 py-4">
                                                    {row.isValid ? (
                                                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                                    ) : (
                                                        <AlertCircle className="h-5 w-5 text-rose-500" />
                                                    )}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{row.fullName || 'Anonymous'}</p>
                                                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">{row.systemRole}</p>
                                                </td>
                                                <td className="px-5 py-4 font-mono text-xs text-slate-500">{row.email}</td>
                                                <td className="px-5 py-4">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${row.roleId ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-100 text-slate-500'}`}>
                                                        {row.roleName}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex gap-4">
                                <Button onClick={() => setStep('upload')} variant="outline" className="flex-1 h-14 rounded-2xl font-bold border-slate-200">
                                    <Trash2 className="h-4 w-4 mr-2 text-slate-400" /> Reset Selection
                                </Button>
                                <Button 
                                    onClick={processUpload} 
                                    disabled={loading}
                                    className="flex-[2] h-14 rounded-2xl bg-indigo-600 hover:bg-slate-900 text-white font-black shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-3"
                                >
                                    {loading ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <>Deploy Access to {parsedData.filter(p => p.isValid).length} Members <ArrowRight className="h-4 w-4" /></>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 'results' && results && (
                        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 text-center py-4">
                            <div className="mx-auto w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 animate-bounce">
                                <CheckCircle2 className="w-12 h-12" />
                            </div>
                            
                            <div className="space-y-2">
                                <h3 className="text-3xl font-black tracking-tight">Onboarding Serialized</h3>
                                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Transmission Complete</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                    <p className="text-xs font-black text-slate-400 uppercase mb-1">Invited</p>
                                    <p className="text-4xl font-black text-indigo-600">{results.invited}</p>
                                </div>
                                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                    <p className="text-xs font-black text-slate-400 uppercase mb-1">Failed</p>
                                    <p className="text-4xl font-black text-rose-600">{results.failed}</p>
                                </div>
                            </div>

                            {results.errors.length > 0 && (
                                <div className="bg-red-50 text-red-700 p-6 rounded-3xl text-xs font-bold text-left space-y-2 max-h-40 overflow-y-auto custom-scrollbar border border-red-100">
                                    <p className="uppercase tracking-widest text-[10px]">Error Logs:</p>
                                    {results.errors.map((err: string, i: number) => <p key={i}>• {err}</p>)}
                                </div>
                            )}

                            <Button onClick={reset} className="w-full h-16 rounded-[1.5rem] bg-indigo-600 hover:bg-slate-900 text-white font-black text-lg transition-all shadow-xl shadow-indigo-100">
                                Return to Command Center
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
