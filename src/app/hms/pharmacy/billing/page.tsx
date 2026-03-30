import { prisma } from "@/lib/prisma"
import { BillingClientEntry } from "@/components/billing/billing-client-entry"
import { getBillableItems, getTaxConfiguration, getUoms } from "@/app/actions/billing"
import { auth } from "@/auth"

export default async function PharmacyBillingPage({
    searchParams
}: {
    searchParams: Promise<{
        patientId?: string
    }>
}) {
    const session = await auth();
    if (!session?.user?.tenantId) return <div>Unauthorized</div>;

    const { patientId } = await searchParams;
    const tenantId = session.user.tenantId;

    let [patients, itemsRes, taxRes, uomsRes, companySettings] = await Promise.all([
        prisma.hms_patient.findMany({
            where: { tenant_id: tenantId },
            select: {
                id: true,
                first_name: true,
                last_name: true,
                contact: true,
                patient_number: true,
                dob: true,
                gender: true,
                metadata: true
            },
            orderBy: { updated_at: 'desc' },
            take: 50
        }),
        getBillableItems(),
        getTaxConfiguration(),
        getUoms(),
        prisma.company_settings.findUnique({
            where: { company_id: session.user.companyId || session.user.tenantId },
            include: { currencies: true }
        })
    ]);

    if (patientId && !patients.find(p => p.id === patientId)) {
        const specialPatient = await prisma.hms_patient.findUnique({
            where: { id: patientId },
            select: {
                id: true,
                first_name: true,
                last_name: true,
                contact: true,
                patient_number: true,
                dob: true,
                gender: true,
                metadata: true
            }
        });
        if (specialPatient) (patients as any).unshift(specialPatient);
    }

    const billableItems = itemsRes.success ? itemsRes.data : [];
    const taxConfig = taxRes.success ? taxRes.data : { defaultTax: null, taxRates: [] };
    const uoms = (uomsRes as any).success ? (uomsRes as any).data : [];
    const currency = companySettings?.currencies?.symbol || session.user.currencySymbol || '₹';

    // 1. Fetch prescription if patientId is provided
    let initialItems: Array<{ id: string; name: string; price: number; quantity: number; type: string }> = [];
    if (patientId) {
        const latestPrescription = await prisma.prescription.findFirst({
            where: {
                patient_id: patientId,
                tenant_id: tenantId
            },
            include: {
                prescription_items: {
                    include: {
                        hms_product: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        if (latestPrescription) {
            initialItems = latestPrescription.prescription_items.map(pi => ({
                id: pi.medicine_id,
                name: pi.hms_product?.name || 'Unknown Medicine',
                price: Number(pi.hms_product?.price) || 0,
                quantity: (pi.morning + pi.afternoon + pi.evening + pi.night) * (pi.days || 1),
                type: 'item'
            }));
        }
    }

    return (
        <div className="p-4 sm:p-8">
            <div className="mb-6 flex items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white leading-tight">Pharmacy Billing</h1>
                    <p className="text-slate-500 text-sm">Create bills for prescribed medicines and OTC sales.</p>
                </div>
            </div>

            <BillingClientEntry
                patients={JSON.parse(JSON.stringify(patients))}
                billableItems={JSON.parse(JSON.stringify(billableItems))}
                uoms={JSON.parse(JSON.stringify(uoms))}
                taxConfig={JSON.parse(JSON.stringify(taxConfig))}
                initialPatientId={patientId}
                initialMedicines={initialItems}
                currency={currency}
                defaultTaxMode={(companySettings?.hms_billing_mode as any) || 'exclusive'}
            />
        </div>
    )
}
