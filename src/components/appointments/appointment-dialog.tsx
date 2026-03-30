'use client'

import { useState } from "react"
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog"
import { AppointmentForm } from "@/components/appointments/appointment-form"
import { Plus, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AppointmentDialogProps {
    patients: any[]
    doctors: any[]
    billableItems?: any[]
    taxConfig?: any
    uoms?: any[]
    currency?: string
}

export function AppointmentDialog({
    patients,
    doctors,
    billableItems,
    taxConfig,
    uoms,
    currency
}: AppointmentDialogProps) {
    const [open, setOpen] = useState(false)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button className="group relative px-4 md:px-8 py-3 md:py-4 bg-white text-indigo-600 rounded-2xl hover:shadow-2xl hover:scale-105 transition-all duration-300 flex items-center gap-3 font-bold shadow-xl">
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-pink-400 rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity"></div>
                    <Plus className="h-5 w-5 md:h-5 md:w-5" />
                    <span className="hidden md:inline">Book Appointment</span>
                    <Zap className="h-4 w-4 text-yellow-500 hidden md:inline" />
                </button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 overflow-hidden bg-transparent border-none shadow-none">
                <DialogTitle className="sr-only">Book Appointment</DialogTitle>
                <div className="h-full w-full bg-slate-50 dark:bg-slate-950 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                    <div className="flex-1 overflow-hidden p-4">
                        <AppointmentForm
                            patients={patients}
                            doctors={doctors}
                            billableItems={billableItems}
                            taxConfig={taxConfig}
                            uoms={uoms}
                            currency={currency}
                            onClose={() => setOpen(false)}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export function MobileAppointmentFab({
    patients,
    doctors,
    billableItems,
    taxConfig,
    uoms,
    currency
}: AppointmentDialogProps) {
    const [open, setOpen] = useState(false)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    className="fixed bottom-6 right-6 lg:hidden z-50 h-14 w-14 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-2xl shadow-indigo-500/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-300 animate-in slide-in-from-bottom-4 fade-in"
                    aria-label="Book Appointment"
                >
                    <Plus className="h-8 w-8" />
                    <div className="absolute inset-0 rounded-full animate-ping bg-indigo-500 opacity-20 duration-1000"></div>
                </button>
            </DialogTrigger>
            <DialogContent className="max-w-[100vw] w-full h-[100vh] sm:h-[95vh] sm:max-w-[95vw] p-0 overflow-hidden bg-transparent border-none shadow-none">
                <DialogTitle className="sr-only">Book Appointment</DialogTitle>
                <div className="h-full w-full bg-slate-50 dark:bg-slate-950 sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                    <div className="flex-1 overflow-hidden p-2 sm:p-4">
                        <AppointmentForm
                            patients={patients}
                            doctors={doctors}
                            billableItems={billableItems}
                            taxConfig={taxConfig}
                            uoms={uoms}
                            currency={currency}
                            onClose={() => setOpen(false)}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
