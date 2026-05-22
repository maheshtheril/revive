import { prisma } from "@/lib/prisma"
import { CompactInvoiceEditor } from "@/components/billing/invoice-editor-compact"
import { getBillableItems, getTaxConfiguration } from "@/app/actions/billing"
import { auth } from "@/auth"

export default async function InterceptedNewInvoicePage({
    searchParams
}: {
    searchParams: Promise<{
        patientId?: string
        medicines?: string
        items?: string
        appointmentId?: string
    }>
}) {
    const session = await auth();
    if (!session?.user?.companyId || !session?.user?.tenantId) return <div>Unauthorized</div>;

    const { patientId, medicines, items, appointmentId } = await searchParams;
    const tenantId = session.user.tenantId;

    // Parallel data fetching
    const [patients, itemsRes, taxRes, companySettings] = await Promise.all([
        prisma.hms_patient.findMany({
            where: {
                tenant_id: tenantId
            },
            select: {
                id: true,
                first_name: true,
                last_name: true,
                contact: true,
                patient_number: true,
                dob: true,
                gender: true
            },
            orderBy: { updated_at: 'desc' },
            take: 50
        }),
        getBillableItems(),
        getTaxConfiguration(),
        prisma.company_settings.findUnique({
            where: { company_id: session.user.companyId || session.user.tenantId }
        })
    ]);

    const billableItems = itemsRes.success ? itemsRes.data : [];
    const taxConfig = taxRes.success ? taxRes.data : { defaultTax: null, taxRates: [] };

    const initialItems = items ? JSON.parse(decodeURIComponent(items)) : (medicines ? JSON.parse(decodeURIComponent(medicines)) : undefined);

    return (
        <CompactInvoiceEditor
            patients={JSON.parse(JSON.stringify(patients))}
            billableItems={JSON.parse(JSON.stringify(billableItems))}
            taxConfig={JSON.parse(JSON.stringify(taxConfig))}
            initialPatientId={patientId}
            initialMedicines={initialItems}
            appointmentId={appointmentId}
            defaultTaxMode={(companySettings?.hms_billing_mode as any) || 'exclusive'}
            currentUser={session?.user}
        />
    )
}
