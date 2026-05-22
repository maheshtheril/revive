'use client'

import dynamic from "next/dynamic"
import { Suspense } from "react"
import { Loader2 } from "lucide-react"

// Version 2.0.7 - Isolated Client Entry for Stability
// By moving the dynamic import here, we ensure the 'InvoiceEditor' 
// NEVER touches the Server-Side Rendering (SSR) phase.
const InvoiceEditor = dynamic(
    () => import("./invoice-editor-compact").then((m) => m.CompactInvoiceEditor),
    { 
        ssr: false,
        loading: () => (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                <p className="font-black text-xl animate-pulse">Initializing Billing Registry...</p>
                <p className="text-slate-400 text-sm">Please wait while we hydrate the high-speed interface...</p>
            </div>
        )
    }
)

export function BillingClientEntry({ currentUser, ...props }: any) {
    return (
        <Suspense fallback={
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                <p className="font-black text-xl animate-pulse">Preparing Billing Terminal...</p>
            </div>
        }>
            <InvoiceEditor currentUser={currentUser} {...props} />
        </Suspense>
    )
}
