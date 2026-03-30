'use client'

import { Calendar as CalendarIcon, X } from 'lucide-react'
import { format } from 'date-fns'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export function BillingDateFilter() {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const { replace } = useRouter()
    
    const currentDate = searchParams.get('date')
    const date = currentDate ? new Date(currentDate) : undefined

    const setDate = (newDate: Date | undefined) => {
        const params = new URLSearchParams(searchParams)
        if (newDate) {
            params.set('date', format(newDate, 'yyyy-MM-dd'))
        } else {
            params.delete('date')
        }
        replace(`${pathname}?${params.toString()}`)
    }

    return (
        <div className="flex items-center gap-2 bg-white rounded-xl p-1 shadow-sm border border-slate-200">
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant={"ghost"}
                        className={cn(
                            "h-9 px-4 justify-start text-left font-bold text-sm tracking-tight rounded-lg",
                            !date && "text-slate-500",
                            date && "bg-slate-900 text-white hover:bg-slate-800 hover:text-white"
                        )}
                    >
                        <CalendarIcon className={cn("mr-2 h-4 w-4", !date ? "text-slate-400" : "text-indigo-400")} />
                        {date ? format(date, "PPP") : "All Dates"}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-slate-100 shadow-2xl" align="start">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        initialFocus
                        className="p-3"
                    />
                    <div className="p-2 border-t border-slate-50 flex justify-between bg-slate-50/50">
                       <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setDate(new Date())}
                        className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50"
                       >
                         Today
                       </Button>
                       {date && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setDate(undefined)}
                            className="text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50"
                        >
                            Clear
                        </Button>
                       )}
                    </div>
                </PopoverContent>
            </Popover>
            
            {!date && (
                <div className="flex gap-1 pr-1">
                    <button 
                        onClick={() => setDate(new Date())}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100"
                    >
                        Today
                    </button>
                </div>
            )}
        </div>
    )
}
