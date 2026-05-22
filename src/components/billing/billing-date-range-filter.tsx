'use client'

import * as React from 'react'
import { Calendar as CalendarIcon, X, ArrowRight } from 'lucide-react'
import { format, startOfDay, endOfDay, subDays } from 'date-fns'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { DateRange } from 'react-day-picker'

export function BillingDateRangeFilter() {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const { replace } = useRouter()
    
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')

    const [mounted, setMounted] = React.useState(false)
    React.useEffect(() => {
        setMounted(true)
    }, [])

    const [range, setRange] = React.useState<DateRange | undefined>(() => {
        try {
            if (fromParam === 'all' || toParam === 'all') return undefined;
            const fp = fromParam ?? format(new Date(), 'yyyy-MM-dd');
            const tp = toParam ?? format(new Date(), 'yyyy-MM-dd');
            const f = new Date(fp);
            const t = new Date(tp);
            if (!isNaN(f.getTime()) && !isNaN(t.getTime())) {
                return { from: f, to: t };
            }
        } catch (e) {
            return undefined;
        }
        return undefined;
    })

    if (!mounted) {
        return (
            <div className="flex items-center gap-2 bg-white rounded-xl p-1 shadow-sm border border-slate-200">
                <Button
                    variant={"ghost"}
                    className={cn(
                        "h-9 px-4 justify-start text-left font-bold text-sm tracking-tight rounded-lg min-w-[200px] text-slate-500"
                    )}
                    disabled
                >
                    <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                    Today (Default)
                </Button>
            </div>
        )
    }

    const applyRange = (newRange: DateRange | undefined) => {
        setRange(newRange)
        const params = new URLSearchParams(searchParams)
        
        if (newRange?.from) {
            params.set('from', format(newRange.from, 'yyyy-MM-dd'))
            if (newRange.to) {
                params.set('to', format(newRange.to, 'yyyy-MM-dd'))
            } else {
                params.set('to', format(newRange.from, 'yyyy-MM-dd'))
            }
        } else {
            params.set('from', 'all')
            params.set('to', 'all')
        }
        replace(`${pathname}?${params.toString()}`)
    }

    const clear = () => {
        setRange(undefined)
        const params = new URLSearchParams(searchParams)
        params.set('from', 'all')
        params.set('to', 'all')
        replace(`${pathname}?${params.toString()}`)
    }

    return (
        <div className="flex items-center gap-2 bg-white rounded-xl p-1 shadow-sm border border-slate-200">
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant={"ghost"}
                        className={cn(
                            "h-9 px-4 justify-start text-left font-bold text-sm tracking-tight rounded-lg min-w-[200px]",
                            !range && "text-slate-500",
                            range && "bg-slate-900 text-white hover:bg-slate-800 hover:text-white"
                        )}
                    >
                        <CalendarIcon className={cn("mr-2 h-4 w-4", !range ? "text-slate-400" : "text-indigo-400")} />
                        {range?.from ? (
                            range.to ? (
                                range.from.getTime() === range.to.getTime() ? format(range.from, "LLL dd, y") : (
                                    <>
                                        {format(range.from, "LLL dd")} <ArrowRight className="mx-1 h-3 w-3 opacity-50 inline" /> {format(range.to, "LLL dd, y")}
                                    </>
                                )
                            ) : (
                                format(range.from, "LLL dd, y")
                            )
                        ) : (
                            "All Time (No Filter)"
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-slate-100 shadow-2xl" align="start">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={range?.from}
                        selected={range}
                        onSelect={applyRange}
                        numberOfMonths={2}
                        className="p-3"
                    />
                    <div className="p-3 border-t border-slate-50 flex flex-wrap gap-2 bg-slate-50/50">
                       <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => applyRange({ from: new Date(), to: new Date() })}
                        className="text-[10px] font-black uppercase tracking-widest h-8"
                       >
                         Today
                       </Button>
                       <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => applyRange({ from: subDays(new Date(), 7), to: new Date() })}
                        className="text-[10px] font-black uppercase tracking-widest h-8"
                       >
                         Last 7 Days
                       </Button>
                       <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                            const now = new Date();
                            applyRange({ from: new Date(now.getFullYear(), now.getMonth(), 1), to: now });
                        }}
                        className="text-[10px] font-black uppercase tracking-widest h-8"
                       >
                         This Month
                       </Button>
                       <Button 
                           variant="ghost" 
                           size="sm" 
                           onClick={clear}
                           className="ml-auto text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50 h-8"
                       >
                           <X className="mr-1 h-3 w-3" /> All Time
                       </Button>
                    </div>
                </PopoverContent>
            </Popover>
            
            {!range && (
                <div className="flex gap-1 pr-1 border-l pl-2 border-slate-100 ml-1">
                    <button 
                        onClick={() => applyRange({ from: new Date(), to: new Date() })}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-all"
                    >
                        Today
                    </button>
                </div>
            )}
        </div>
    )
}
