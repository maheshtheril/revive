import { prisma } from "@/lib/prisma"
import { CompactInvoiceEditor } from "@/components/billing/invoice-editor-compact"
import { getBillableItems, getTaxConfiguration } from "@/app/actions/billing"
import { auth } from "@/auth"
import { notFound } from "next/navigation"

export default async function InterceptedEditInvoicePage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.companyId || !session?.user?.tenantId) return <div>Unauthorized</div>;

    // [RESOLUTION] Highly Resilient Dual-Lookup Strategy for ID Resilience
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    // Parallel data fetching
    const [invoice, patients, itemsRes, taxRes, companySettings] = await Promise.all([
        prisma.hms_invoice.findFirst({
            where: {
                OR: [
                    isUuid ? { id: id } : { id: 'NOT_A_UUID' },
                    { invoice_number: id },
                    { invoice_no: id }
                ],
                // Security: Restrict to tenant unless platform admin/admin
                tenant_id: session.user.isAdmin ? undefined : (session.user.tenantId as string)
            },
            include: {
                hms_patient: true,
                hms_invoice_lines: true,
                hms_invoice_payments: true
            }
        }),
        prisma.hms_patient.findMany({
            where: { tenant_id: session.user.tenantId as string },
            select: { id: true, first_name: true, last_name: true, contact: true, patient_number: true, dob: true, gender: true },
            orderBy: { updated_at: 'desc' },
            take: 100
        }),
        getBillableItems(),
        getTaxConfiguration(),
        prisma.company_settings.findUnique({
            where: { company_id: session.user.companyId || session.user.tenantId }
        })
    ]);

    if (!invoice) return notFound();

    const billableItems = itemsRes.success ? itemsRes.data : [];
    const taxConfig = taxRes.success ? taxRes.data : { defaultTax: null, taxRates: [] };

    // [INTEGRITY-CHECK] Check for pending nursing items
    let pendingConsumablesCount = 0;
    if (invoice.appointment_id) {
        pendingConsumablesCount = await prisma.hms_stock_move.count({
            where: {
                source_reference: invoice.appointment_id,
                source: 'Nursing Consumption (Pending)'
            }
        });
    }

    return (
        <CompactInvoiceEditor
            patients={JSON.parse(JSON.stringify(patients))}
            billableItems={JSON.parse(JSON.stringify(billableItems))}
            taxConfig={JSON.parse(JSON.stringify(taxConfig))}
            initialInvoice={JSON.parse(JSON.stringify(invoice))}
            pendingConsumablesCount={pendingConsumablesCount}
            defaultTaxMode={(companySettings?.hms_billing_mode as any) || 'exclusive'}
            currentUser={session?.user}
        />
    )
}
