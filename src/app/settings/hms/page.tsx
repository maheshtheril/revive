
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getHMSSettings, getPaymentGatewaySettings, getWhatsAppSettings, getPDFSettings } from "@/app/actions/settings"
import { HMSSettingsForm } from "./hms-settings-form"
import { Activity } from "lucide-react"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export default async function HMSSettingsPage() {
    const session = await auth()
    if (!session?.user?.id) redirect('/login')

    const [res, doctors, gatewayRes, whatsappRes, pdfRes, company] = await Promise.all([
        getHMSSettings(),
        prisma.hms_clinicians.findMany({
            where: { company_id: session.user.companyId!, is_active: true },
            select: {
                id: true,
                first_name: true,
                last_name: true,
            },
            orderBy: { first_name: 'asc' }
        }),
        getPaymentGatewaySettings(session.user.companyId!, session.user.tenantId),
        getWhatsAppSettings(session.user.companyId!, session.user.tenantId),
        getPDFSettings(session.user.companyId!, session.user.tenantId),
        prisma.company.findUnique({
            where: { id: session.user.companyId! },
            select: { name: true, logo_url: true, metadata: true }
        })
    ]);

    if (!res.success) {
        return (
            <div className="p-8 text-center text-red-500">
                <h2 className="text-xl font-bold">Access Denied</h2>
                <p>{res.error}</p>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <header className="mb-8 border-b border-slate-200 dark:border-slate-800 pb-6">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center">
                        <Activity className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">HMS Configuration</h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">Manage clinical workflows and financial defaults.</p>
                    </div>
                </div>
            </header>

            <HMSSettingsForm
                settings={res.settings}
                products={res.availableProducts || []}
                doctors={doctors}
                gatewaySettings={gatewayRes.success ? gatewayRes.settings : null}
                whatsappSettings={whatsappRes.success ? whatsappRes.settings : null}
                pdfSettings={pdfRes.success ? pdfRes.settings : null}
                aiSettings={res.aiSettings}
                company={company}
            />
        </div>
    )
}
