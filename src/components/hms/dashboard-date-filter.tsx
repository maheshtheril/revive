'use client'

import { useState, useEffect } from "react"
import { format, addDays, subDays, isSameDay } from "date-fns"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export function DashboardDateFilter() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isMounted, setIsMounted] = useState(false)
    useEffect(() => { setIsMounted(true) }, [])

    // [ELITE DATE LOGIC] Default to current system date if none in URL
    const dateStr = searchParams.get('date')
    const date = dateStr ? new Date(dateStr) : new Date()

    const updateDate = (newDate: Date) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('date', format(newDate, 'yyyy-MM-dd'))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
        router.refresh()
    }

    const goToToday = () => updateDate(new Date())
    const goToPrev = () => updateDate(subDays(date, 1))
    const goToNext = () => updateDate(addDays(date, 1))

    const isToday = isSameDay(date, new Date())

    // Prevent hydration mismatch by stalling render until client-side is ready
    if (!isMounted) return (
        <div className="h-10 w-48 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl" />
    );

    return (
        <div className="flex items-center gap-2 bg-white/60 dark:bg-slate-900/60 p-1 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-xl shadow-sm group">
            <div className="flex items-center">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={goToPrev}
                    title="Previous Day"
                    className="h-8 w-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-all active:scale-90"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            className={cn(
                                "h-8 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 whitespace-nowrap overflow-hidden transition-all",
                                isToday && "text-indigo-600 dark:text-indigo-400"
                            )}
                        >
                            <CalendarIcon className="h-3.5 w-3.5" />
                            <span className="text-xs uppercase tracking-wider">
                                {isToday ? "Today" : format(date, "EEE, MMM d")}
                            </span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden" align="center">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={(d) => d && updateDate(d)}
                            initialFocus
                            className="bg-white dark:bg-slate-950"
                        />
                    </PopoverContent>
                </Popover>

                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={goToNext}
                    title="Next Day"
                    className="h-8 w-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-all active:scale-90"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {!isToday && (
                <>
                    <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-0.5" />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={goToToday}
                        className="h-7 rounded-lg px-2 font-bold text-[9px] uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                    >
                        Reset
                    </Button>
                </>
            )}
        </div>
    )
}
