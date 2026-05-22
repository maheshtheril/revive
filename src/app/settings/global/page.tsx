import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { GlobalSettingsForm } from "./global-settings-form"
import { redirect } from "next/navigation"
import { getWhatsAppSettings, getPDFSettings, getAISettings } from "@/app/actions/settings"
import { checkPermission } from "@/app/actions/rbac"

export const dynamic = 'force-dynamic'

export default async function GlobalSettingsPage() {
    const session = await auth()
    if (!session?.user?.id) redirect('/login')

    const hasAccess = await checkPermission('settings:view');
    if (!hasAccess && !session.user.isAdmin && !(session.user as any).isTenantAdmin) {
        redirect('/hms/reception/dashboard');
    }

    console.log("Global Settings: Session OK", session?.user?.id);

    const companyId = session.user.companyId;

    if (!companyId) {
        return <div className="p-8">No company associated with this user account.</div>
    }

    const rawCompany = await prisma.company.findUnique({
        where: { id: companyId },
        include: {
            company_settings: true
        }
    })

    // Serialize to handle Date objects before passing to Client Component
    const company = JSON.parse(JSON.stringify(rawCompany));

    const tenant = await prisma.tenant.findUnique({
        where: { id: session.user.tenantId }
    }) || await prisma.tenant.findFirst({
        where: {
            OR: [
                { id: session.user.tenantId },
                { tenant_id: session.user.tenantId }
            ]
        }
    })

    console.log("Global Settings: Company Fetched", company?.id);

    const [currencies, whatsappRes, pdfRes, aiRes] = await Promise.all([
        prisma.currencies.findMany({
            select: { id: true, code: true, name: true, symbol: true },
            orderBy: { code: 'asc' }
        }),
        getWhatsAppSettings(companyId, tenant?.id),
        getPDFSettings(companyId, tenant?.id),
        getAISettings(companyId, tenant?.id)
    ])
    
    console.log("Global Settings: WhatsApp Token Found:", whatsappRes.success && whatsappRes.settings?.hasToken);

    console.log("Global Settings: Currencies", currencies.length);

    if (!company) return <div>Company not found for ID: {companyId}</div>

    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <header className="mb-8 border-b pb-4">
                <h1 className="text-3xl font-bold text-slate-900">Global Settings</h1>
                <p className="text-slate-500 mt-1">Configure your organization's core profile and preferences.</p>
            </header>

            <GlobalSettingsForm
                company={company}
                tenant={JSON.parse(JSON.stringify(tenant))}
                currencies={currencies}
                isTenantAdmin={session.user.isTenantAdmin}
                isAdmin={session.user.isAdmin}
                whatsappSettings={whatsappRes.success ? whatsappRes.settings : null}
                pdfSettings={pdfRes.success ? pdfRes.settings : null}
                aiSettings={aiRes.success ? aiRes.settings : null}
            />
        </div>
    )
}
