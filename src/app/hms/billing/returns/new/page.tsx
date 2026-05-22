import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getHMSSettings, getPaymentGatewaySettings } from "@/app/actions/settings"
import { getTaxConfiguration, getBillableItems, getInvoice } from "@/app/actions/billing"
import { getInitialInvoiceData } from "@/app/actions/clinical"
import { getUOMs } from "@/app/actions/inventory"
import BillingClientEntry from "../../new/client-entry"

interface PageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function NewSalesReturnPage({ searchParams }: PageProps) {
    const session = await auth();
    if (!session?.user?.id) return null;

    const sp = await searchParams;
    const { patientId, invoiceId } = sp;

    // 1. Parallel Data Fetching
    const [taxRes, uomsRes, gatewayRes, hmsSettingsRes, itemsRes] = await Promise.all([
        getTaxConfiguration(),
        getUOMs(),
        getPaymentGatewaySettings(),
        getHMSSettings(),
        getBillableItems()
    ]);

    // 2. Resolve Incoming Intent (Reference Invoice for Return)
    let initialInvoice = null;
    let initialPatientId = (patientId as string) || '';

    if (invoiceId) {
        const invRes = await getInvoice(invoiceId as string);
        if (invRes) {
            initialInvoice = invRes;
            initialPatientId = invRes.patient_id;
        }
    }

    // 3. Fetch Patients (Optimized)
    const patientList = await prisma.hms_patient.findMany({
        where: {
            company_id: session.user.companyId,
            status: 'active'
        },
        select: {
            id: true,
            first_name: true,
            last_name: true,
            patient_number: true,
            contact: true
        },
        take: 100,
        orderBy: { created_at: 'desc' }
    });

    // 4. Consolidate Props
    const safeProps = {
        patients: JSON.parse(JSON.stringify(patientList.map(p => ({
            id: p.id,
            name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
            phone: (p.contact as any)?.phone || (p.contact as any)?.mobile || '',
            patient_number: p.patient_number
        })))),
        billableItems: JSON.parse(JSON.stringify(itemsRes?.success ? itemsRes.data : [])),
        taxConfig: JSON.parse(JSON.stringify(taxRes?.success ? taxRes.data : { defaultTax: null, taxRates: [] })),
        uoms: JSON.parse(JSON.stringify(uomsRes || [])),
        gatewayConfig: JSON.parse(JSON.stringify(gatewayRes?.success ? gatewayRes.settings : null)),
        initialPatientId,
        initialInvoice: JSON.parse(JSON.stringify(initialInvoice)),
        currency: (session.user as any).currencySymbol || '\u20B9',
        mode: 'return' as const,
        externalProvisionalNo: `SRT-${new Date().getFullYear()}-${String((await prisma.hms_sales_return.count({ where: { company_id: session.user.companyId } })) + 1).padStart(4, '0')}`
    };

    return (
        <main className="min-h-screen bg-slate-950 overflow-hidden">
            <BillingClientEntry {...safeProps} />
        </main>
    );
}
