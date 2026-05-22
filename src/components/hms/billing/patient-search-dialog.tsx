'use client'

import { useState, useEffect, useCallback } from "react"
import { Check, ChevronsUpDown, Plus, Search, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { searchPatients } from "@/app/actions/patient-search"
import { createPatientV10 } from "@/app/actions/patient-v10"
import { useToast } from "@/components/ui/use-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { CreditCard } from "lucide-react"

import { CreatePatientForm } from "@/components/hms/create-patient-form"

interface Patient {
    id: string
    name: string
    patient_number?: string
    phone?: string
}

interface PatientSearchWithCreateProps {
    onSelect: (patient: Patient) => void
    selectedPatientId?: string
}

export function PatientSearchWithCreate({ onSelect, selectedPatientId }: PatientSearchWithCreateProps) {
    const [open, setOpen] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [patients, setPatients] = useState<Patient[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
    const { toast } = useToast()

    const fetchPatients = useCallback(async (q: string) => {
        if (!q || q.length < 1) {
            setPatients([])
            return
        }
        setLoading(true)
        try {
            const results = await searchPatients(q)
            setPatients(results as any)
        } catch (err) {
            console.error("Fetch patients failed:", err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        const timer = setTimeout(() => {
            if (query) fetchPatients(query)
            else setPatients([])
        }, 200)
        return () => clearTimeout(timer)
    }, [query, fetchPatients])

    const handlePatientCreated = (data: any) => {
        const newPatient = {
            id: data.id,
            name: `${data.first_name} ${data.last_name || ''}`.trim(),
            patient_number: data.patient_number,
            phone: (data.contact as any)?.phone || (data.contact as any)?.mobile || ''
        }
        toast({ title: "Success", description: "Patient registered successfully." })
        onSelect(newPatient)
        setSelectedPatient(newPatient)
        setDialogOpen(false)
        setOpen(false)
    }

    return (
        <div className="flex items-center gap-3 w-full">
            <div className="relative flex-1">
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className={cn(
                                "w-full h-12 justify-between bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-400 transition-all",
                                selectedPatient && "border-blue-500 bg-blue-50/10"
                            )}
                        >
                            {selectedPatient ? (
                                <span className="flex items-center gap-2 overflow-hidden">
                                    <UserPlus className="h-4 w-4 text-blue-500 shrink-0" />
                                    <span className="font-bold text-slate-900 truncate">{selectedPatient.name}</span>
                                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-100 shrink-0">
                                        {selectedPatient.patient_number}
                                    </Badge>
                                </span>
                            ) : (
                                <span className="flex items-center gap-2 text-slate-400">
                                    <Search className="h-4 w-4" />
                                    Search Patient by Name, ID or Phone...
                                </span>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[450px] p-0 shadow-[0_20px_50px_rgba(0,0,0,0.15)] border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden" align="start">
                        <Command shouldFilter={false} className="rounded-xl">
                            <CommandInput
                                placeholder="Start typing name or phone..."
                                value={query}
                                onValueChange={setQuery}
                                className="h-12 border-none focus:ring-0"
                            />
                            <CommandList className="max-h-[300px]">
                                {loading && (
                                    <div className="p-4 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
                                        <div className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                                        Searching clinical records...
                                    </div>
                                )}
                                {!loading && query.length > 0 && patients.length === 0 && (
                                    <CommandEmpty className="p-6 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center">
                                                <Search className="h-6 w-6 text-slate-300" />
                                            </div>
                                            <p className="text-sm font-medium text-slate-900">No patient found</p>
                                            <p className="text-xs text-slate-500">Try a different name or register a new patient.</p>
                                        </div>
                                    </CommandEmpty>
                                )}
                                <CommandGroup>
                                    {patients.map((patient) => (
                                        <CommandItem
                                            key={patient.id}
                                            value={patient.id}
                                            onSelect={() => {
                                                onSelect(patient)
                                                setSelectedPatient(patient)
                                                setOpen(false)
                                            }}
                                            className="flex flex-col items-start py-4 px-4 cursor-pointer hover:bg-blue-50/50 aria-selected:bg-blue-50"
                                        >
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                                        {patient.name}
                                                        {selectedPatientId === patient.id && <Check className="h-3 w-3 text-blue-500" />}
                                                    </span>
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">{patient.patient_number}</span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> {patient.phone}</span>
                                                    </div>
                                                </div>
                                                <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold text-blue-600 uppercase tracking-tighter">Select</Button>
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                    <Button
                        variant="default"
                        className="h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2 shrink-0 group"
                    >
                        <UserPlus className="h-5 w-5 group-hover:scale-110 transition-transform" />
                        <span className="hidden sm:inline">Add New Patient</span>
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-7xl h-[90vh] bg-white dark:bg-slate-950 rounded-[2.5rem] overflow-hidden p-0 border border-white/20 shadow-2xl flex flex-col focus:outline-none">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Add New Patient</DialogTitle>
                    </DialogHeader>
                    <div className="w-full h-full overflow-hidden flex flex-col">
                        <CreatePatientForm
                            onClose={() => setDialogOpen(false)}
                            onSuccess={handlePatientCreated}
                            hideBilling={false}
                            isDialog={true}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function SelectItem({ children, value }: { children: React.ReactNode, value: string }) {
    return <option value={value}>{children}</option>
}
