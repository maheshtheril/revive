"use client"

import Link from "next/link"
import { MoreHorizontal, Pencil, Eye, Printer, Trash2, MessageCircle, Loader2 } from "lucide-react"
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
    const [isLoading, setIsLoading] = useState(false)
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
                    <Link href={`/api/billing/${invoiceId}/pdf`} target="_blank" className="cursor-pointer flex items-center gap-2">
                        <Printer className="h-4 w-4 text-gray-500" />
                        Print
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
    )
}
