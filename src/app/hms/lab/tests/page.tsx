'use client'

import { useState, useEffect } from "react"
import { getLabTests, saveLabTest, deleteLabTest, seedStandardLabTests } from "@/app/actions/lab"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
    Plus, Search, FlaskConical, Beaker, Trash2, 
    Edit, Database, Loader2, Info, ArrowLeft
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import Link from "next/link"

export default function LabTestManagementPage() {
    const { toast } = useToast()
    const [tests, setTests] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [isOpen, setIsOpen] = useState(false)
    const [editingTest, setEditingTest] = useState<any>(null)
    const [seeding, setSeeding] = useState(false)

    useEffect(() => {
        loadTests()
    }, [])

    async function loadTests() {
        setLoading(true)
        const res = await getLabTests()
        if (res.success) setTests(res.data)
        setLoading(false)
    }

    const filteredTests = tests.filter(t => 
        t.name.toLowerCase().includes(search.toLowerCase())
    )

    async function handleSave(formData: any) {
        const res = await saveLabTest(formData)
        if (res.success) {
            toast({ title: "Success", description: "Lab test updated successfully." })
            setIsOpen(false)
            loadTests()
        } else {
            toast({ title: "Error", description: res.error, variant: "destructive" })
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Are you sure? This will delete the test definition.")) return
        const res = await deleteLabTest(id)
        if (res.success) {
            toast({ title: "Deleted", description: "Test removed from catalog." })
            loadTests()
        }
    }

    async function handleSeed() {
        setSeeding(true)
        const res = await seedStandardLabTests()
        if (res.success) {
            toast({ title: "Success", description: "Loaded standard lab tests." })
            loadTests()
        }
        setSeeding(false)
    }

    return (
        <div className="p-8 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/hms/lab/dashboard">
                        <Button variant="ghost" className="rounded-full w-10 h-10 p-0">
                            <ArrowLeft className="w-5 h-5 text-slate-500" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                             Lab Test Catalog
                        </h1>
                        <p className="text-slate-500 text-sm font-medium">Manage your hospital's diagnostic investigations and reference ranges</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        onClick={handleSeed}
                        disabled={seeding}
                        className="rounded-2xl gap-2 font-bold text-indigo-600 border-indigo-100"
                    >
                        {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                        Load Standard Tests
                    </Button>

                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button 
                                onClick={() => setEditingTest(null)}
                                className="bg-slate-900 hover:bg-slate-800 text-white gap-2 font-black rounded-2xl px-6"
                            >
                                <Plus className="w-4 h-4" />
                                Add New Test
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md rounded-3xl">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-black">{editingTest ? 'Edit Test' : 'New Lab Investigation'}</DialogTitle>
                            </DialogHeader>
                            <LabTestForm 
                                initialData={editingTest} 
                                onSubmit={handleSave} 
                                onClose={() => setIsOpen(false)} 
                            />
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 font-black" />
                <Input 
                    placeholder="Search tests by name (e.g. CBC, Thyroid...)" 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-12 py-6 text-md font-bold rounded-2xl border-slate-200 bg-white shadow-xl shadow-slate-200/20 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                />
            </div>

            {loading ? (
                <div className="h-64 flex flex-col items-center justify-center opacity-50">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-2" />
                    <p className="font-bold">Syncing Catalog...</p>
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/30">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-6 py-5 text-left text-[11px] font-black uppercase text-slate-400 tracking-widest">Investigation Name</th>
                                <th className="px-6 py-5 text-left text-[11px] font-black uppercase text-slate-400 tracking-widest">Reference Range</th>
                                <th className="px-6 py-5 text-left text-[11px] font-black uppercase text-slate-400 tracking-widest">Units</th>
                                <th className="px-6 py-5 text-right text-[11px] font-black uppercase text-slate-400 tracking-widest">Price</th>
                                <th className="px-6 py-5 text-center text-[11px] font-black uppercase text-slate-400 tracking-widest w-24">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredTests.map((test) => (
                                <tr key={test.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">
                                                <Beaker className="w-5 h-5" />
                                            </div>
                                            <span className="font-black text-slate-900 uppercase tracking-tight">{test.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/50">
                                            <Info className="w-3 h-3 text-indigo-400" />
                                            {typeof test.reference_range === 'object' ? test.reference_range?.range || JSON.stringify(test.reference_range) : test.reference_range || "Not Defined"}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{test.units || "—"}</span>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <span className="font-black text-indigo-600 text-lg">₹{Number(test.price) || '0'}</span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex justify-center gap-1">
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-8 w-8 p-0 rounded-full hover:bg-indigo-50 hover:text-indigo-600"
                                                onClick={() => {
                                                    setEditingTest(test)
                                                    setIsOpen(true)
                                                }}
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-8 w-8 p-0 rounded-full hover:bg-red-50 hover:text-red-600"
                                                onClick={() => handleDelete(test.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredTests.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <FlaskConical className="w-8 h-8 text-slate-300" />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900">No Tests Found</h3>
                                        <p className="text-slate-500">Add a new test or load standard presets to begin.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

function LabTestForm({ initialData, onSubmit, onClose }: any) {
    const [formData, setFormData] = useState(initialData ? {
        ...initialData,
        reference_range: typeof initialData.reference_range === 'object' ? initialData.reference_range?.range || JSON.stringify(initialData.reference_range) : initialData.reference_range || ""
    } : {
        name: "",
        price: "",
        units: "",
        reference_range: "",
        method: ""
    })

    return (
        <form onSubmit={(e) => {
            e.preventDefault()
            onSubmit(formData)
        }} className="space-y-5 pt-4">
            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Investigation Name</label>
                <Input 
                    required 
                    value={formData.name || ""}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. Blood Glucose"
                    className="rounded-xl font-bold py-5"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unit</label>
                    <Input 
                        value={formData.units || ""}
                        onChange={(e) => setFormData({...formData, units: e.target.value})}
                        placeholder="e.g. mg/dL"
                        className="rounded-xl font-bold py-5"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Price (INR)</label>
                    <Input 
                        type="number"
                        required
                        value={formData.price || ""}
                        onChange={(e) => setFormData({...formData, price: e.target.value})}
                        placeholder="0.00"
                        className="rounded-xl font-bold py-5"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reference Range / Normal Value</label>
                <Input 
                    value={formData.reference_range || ""}
                    onChange={(e) => setFormData({...formData, reference_range: e.target.value})}
                    placeholder="e.g. 70 - 110"
                    className="rounded-xl font-bold py-5"
                />
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Method (Optional)</label>
                <Input 
                    value={formData.method || ""}
                    onChange={(e) => setFormData({...formData, method: e.target.value})}
                    placeholder="e.g. UV-Spectrometry"
                    className="rounded-xl font-bold py-5"
                />
            </div>

            <div className="flex gap-3 pt-6">
                <Button type="button" variant="ghost" onClick={onClose} className="flex-1 rounded-xl font-bold">Cancel</Button>
                <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-lg shadow-indigo-600/20">
                    {initialData ? 'Update Test' : 'Add to Catalog'}
                </Button>
            </div>
        </form>
    )
}
