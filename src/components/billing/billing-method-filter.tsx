'use client'

import * as React from 'react'
import { CreditCard, Banknote, Smartphone, Landmark, X } from 'lucide-react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const methods = [
    { id: 'cash', label: 'Cash', icon: Banknote, color: 'emerald' },
    { id: 'card', label: 'Card', icon: CreditCard, color: 'blue' },
    { id: 'upi', label: 'UPI', icon: Smartphone, color: 'indigo' },
    { id: 'bank_transfer', label: 'Bank', icon: Landmark, color: 'violet' }
]

export function BillingMethodFilter() {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const { replace } = useRouter()

    const [mounted, setMounted] = React.useState(false)
    React.useEffect(() => {
        setMounted(true)
    }, [])
    
    const currentMethod = searchParams.get('method')
    const active = methods.find(m => m.id === currentMethod)

    const setMethod = (id: string | null) => {
        const params = new URLSearchParams(searchParams)
        if (id) {
            params.set('method', id)
        } else {
            params.delete('method')
        }
        replace(`${pathname}?${params.toString()}`)
    }

    if (!mounted) {
        return (
            <div className="flex items-center gap-2 bg-white rounded-xl p-1 shadow-sm border border-slate-200">
                <Button
                    variant={"ghost"}
                    className={cn(
                        "h-9 px-4 justify-start text-left font-bold text-sm tracking-tight rounded-lg text-slate-500"
                    )}
                    disabled
                >
                    <Banknote className="mr-2 h-4 w-4 text-slate-400" />
                    All Modes
                </Button>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-2 bg-white rounded-xl p-1 shadow-sm border border-slate-200">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant={"ghost"}
                        className={cn(
                            "h-9 px-4 justify-start text-left font-bold text-sm tracking-tight rounded-lg",
                            !active && "text-slate-500",
                            active && "bg-slate-900 text-white hover:bg-slate-800 hover:text-white"
                        )}
                    >
                        {active ? (
                            <>
                                <active.icon className={cn("mr-2 h-4 w-4", `text-${active.color}-400`)} />
                                {active.label}
                            </>
                        ) : (
                            <>
                                <Banknote className="mr-2 h-4 w-4 text-slate-400" />
                                All Modes
                            </>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48 p-1 rounded-2xl border-slate-100 shadow-2xl" align="start">
                    {methods.map((m) => (
                        <DropdownMenuItem
                            key={m.id}
                            onClick={() => setMethod(m.id)}
                            className={cn(
                                "flex items-center gap-3 p-2.5 rounded-xl cursor-pointer font-bold text-xs uppercase tracking-widest",
                                currentMethod === m.id ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"
                            )}
                        >
                            <m.icon className={cn("h-4 w-4", `text-${m.color}-500`)} />
                            {m.label}
                        </DropdownMenuItem>
                    ))}
                    {currentMethod && (
                        <div className="border-t border-slate-50 mt-1 p-1">
                            <DropdownMenuItem
                                onClick={() => setMethod(null)}
                                className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer font-bold text-xs uppercase tracking-widest text-rose-500 hover:bg-rose-50"
                            >
                                <X className="h-4 w-4" />
                                Clear Filter
                            </DropdownMenuItem>
                        </div>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
