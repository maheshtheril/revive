import { CompactInvoiceEditor } from "@/components/billing/invoice-editor-compact"
import { getHMSSettings } from "@/app/actions/settings"
import { getBillableItems, getTaxConfiguration, getUoms } from "@/app/actions/billing"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { DEFAULT_REGISTRATION_FEE, REG_FEE_SKU, REG_FEE_DESCRIPTION } from "@/lib/hms-constants"

export const dynamic = 'force-dynamic'

export default async function RegistrationVoucherPage() {
    const session = await auth();
    if (!session?.user?.tenantId) return <div>Unauthorized</div>;

    // 1. Fetch Clinical & Financial Settings
    const hmsSettings = await getHMSSettings();
    const settings = hmsSettings.success ? (hmsSettings.settings as any) : null;

    // 2. Fetch Master Data for Editor
    const [patients, itemsRes, taxRes, uomsRes, companySettings] = await Promise.all([
        prisma.hms_patient.findMany({
            where: { tenant_id: session.user.tenantId },
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
            take: 20
        }),
        getBillableItems(),
        getTaxConfiguration(),
        getUoms(),
        prisma.company_settings.findFirst({
            where: { tenant_id: session.user.tenantId },
            include: { currencies: true }
        })
    ]);

    const billableItems = itemsRes.success ? itemsRes.data : [];
    const taxConfig = taxRes.success ? taxRes.data : { defaultTax: null, taxRates: [] };
    const uoms = (uomsRes as any).success ? (uomsRes as any).data : [];
    const currency = companySettings?.currencies?.symbol || session.user.currencySymbol || '₹';

    // 3. Prepare Initial Item (Registration Fee)
    const initialItems = [];
    if (settings?.registrationProductId) {
        initialItems.push({
            id: settings.registrationProductId,
            name: settings.registrationProductName,
            price: Number(settings.registrationFee),
            quantity: 1,
            type: 'service'
        });
    } else {
        // Fallback if settings missing
        initialItems.push({
            id: REG_FEE_SKU,
            name: REG_FEE_DESCRIPTION,
            price: Number(settings?.registrationFee || DEFAULT_REGISTRATION_FEE),
            quantity: 1,
            type: 'service'
        });
    }

    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50">
            <CompactInvoiceEditor
                patients={JSON.parse(JSON.stringify(patients))}
                billableItems={JSON.parse(JSON.stringify(billableItems))}
                taxConfig={JSON.parse(JSON.stringify(taxConfig))}
                uoms={JSON.parse(JSON.stringify(uoms))}
                currency={currency}
                initialMedicines={initialItems}
            />
        </div>
    )
}
