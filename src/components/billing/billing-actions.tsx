"use client"

import * as React from "react"
import Link from "next/link"
import { MoreHorizontal, Pencil, Eye, Printer, Trash2, MessageCircle, Loader2, RotateCcw } from "lucide-react"
import { useState } from "react"
import { shareInvoiceWhatsapp } from "@/app/actions/billing"
import { useToast } from "@/components/ui/use-toast"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface BillingActionsProps {
    invoiceId: string
    invoiceNumber: string
}

export function BillingActions({ invoiceId, invoiceNumber }: BillingActionsProps) {
    const [mounted, setMounted] = React.useState(false)
    React.useEffect(() => {
        setMounted(true)
    }, [])

    const [isLoading, setIsLoading] = React.useState(false)
    const { toast } = useToast()

    async function handleWhatsappShare() {
        setIsLoading(true);
        try {
            const res = await shareInvoiceWhatsapp(invoiceId) as any;
            if (res && res.success) {
                toast({
                    title: "WhatsApp Shared",
                    description: res.message || "Invoice PDF shared via WhatsApp",
                });
            } else {
                toast({
                    title: "Share Failed",
                    description: (res && res.error) || "Could not send WhatsApp",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error(error);
            toast({
                title: "Error",
                description: "Failed to connect to WhatsApp service.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="flex items-center justify-end gap-1">
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-95 text-slate-400"
                asChild
            >
                <a 
                    href={`/api/invoice-printer/${invoiceId}?autoPrint=true`} 
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                >
                    <Printer className="h-4 w-4 pointer-events-none" />
                </a>
            </Button>
            {!mounted ? (
                <Button variant="ghost" className="h-8 w-8 p-0" disabled>
                    <MoreHorizontal className="h-4 w-4 text-gray-300" />
                </Button>
            ) : (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100 data-[state=open]:bg-gray-100 transition-colors">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4 text-gray-500" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[160px]">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                            <Link href={`/hms/billing/${invoiceId}/edit`} className="cursor-pointer flex items-center gap-2">
                                <Pencil className="h-4 w-4 text-gray-500" />
                                Edit
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href={`/hms/billing/${invoiceId}`} className="cursor-pointer flex items-center gap-2">
                                <Eye className="h-4 w-4 text-gray-500" />
                                View Details
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <a 
                                href={`/api/invoice-printer/${invoiceId}?autoPrint=true`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="cursor-pointer flex items-center gap-2 px-2 py-1.5 text-sm outline-none transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <Printer className="h-4 w-4 text-gray-500" />
                                Print
                            </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50">
                            <Link href={`/hms/billing/returns/new?invoiceId=${invoiceId}`} className="cursor-pointer flex items-center gap-2">
                                <RotateCcw className="h-4 w-4" />
                                Return Items
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={handleWhatsappShare}
                            disabled={isLoading}
                            className="cursor-pointer flex items-center gap-2 text-green-600 focus:text-green-700 focus:bg-green-50"
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                            Share WhatsApp
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    )
}
