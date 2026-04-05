'use server';

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getHMSSettings, getPaymentGatewaySettings } from "@/app/actions/settings"
import { getInitialInvoiceData, getTaxConfiguration } from "@/app/actions/billing"
import { getUOMs } from "@/app/actions/inventory"
import BillingClientEntry from "./client-entry"

interface PageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function NewInvoicePage({ searchParams }: PageProps) {
    const session = await auth();
    if (!session?.user?.id) return null;

    const sp = await searchParams;
    const { patientId, appointmentId, medicines, items } = sp;

    // 1. Parallel Data Fetching for Maximum Speed
    const [taxRes, uomsRes, gatewayRes, hmsSettingsRes] = await Promise.all([
        getTaxConfiguration(),
        getUOMs(),
        getPaymentGatewaySettings(),
        getHMSSettings()
    ]);

    // 2. Resolve Incoming Intent (Prescriptions, Items, etc)
    let initialMedicines: any[] = [];
    try {
        if (medicines) {
            initialMedicines = JSON.parse(decodeURIComponent(medicines as string));
        }
    } catch (e) {
        console.log("[BILLING-PAGE] Failed to parse medicines from URL:", e);
    }

    let itemsFromUrl: any[] = [];
    try {
        if (items) {
            itemsFromUrl = JSON.parse(decodeURIComponent(items as string));
        }
    } catch (e) {
        console.log("[BILLING-PAGE] Failed to parse items from URL:", e);
    }

    const initialItems = [...initialMedicines, ...itemsFromUrl];

    // 3. Conditional Data Fetching
    let draftInvoice = null;
    if (appointmentId) {
        const apptData = await getInitialInvoiceData(appointmentId as string, session.user.tenantId);
        if (apptData?.success && apptData.data) {
            draftInvoice = apptData.data;
        }
    }

    const effectivePatientId = (patientId as string) || (draftInvoice as any)?.patientId || '';

    // 4. Consolidate Items (URL + Prescription/Nursing items)
    const consolidatedMedicines = [
        ...initialItems,
        ...(draftInvoice as any)?.initialItems || []
    ];

    // 5. Fetch Patients (Optimized)
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

    // 6. Serialize and Sanitize for Client Hydration
    const safeProps = {
        patients: JSON.parse(JSON.stringify(patientList.map(p => ({
            id: p.id,
            name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
            phone: (p.contact as any)?.phone || (p.contact as any)?.mobile || '',
            patient_number: p.patient_number
        })))),
        billableItems: [], // Placeholder as real items come from SearchableSelect's filter
        taxConfig: JSON.parse(JSON.stringify(taxRes?.success ? taxRes.data : { defaultTax: null, taxRates: [] })),
        uoms: JSON.parse(JSON.stringify(uomsRes || [])),
        gatewayConfig: JSON.parse(JSON.stringify(gatewayRes?.success ? gatewayRes.settings : null)),
        initialPatientId: effectivePatientId,
        initialMedicines: JSON.parse(JSON.stringify(consolidatedMedicines)),
        appointmentId: (appointmentId as string) || '',
        initialInvoice: JSON.parse(JSON.stringify((draftInvoice as any)?.initialInvoice || null)),
        pendingConsumablesCount: (draftInvoice as any)?.pendingConsumablesCount || 0,
        currency: (session.user as any).currencySymbol || '₹',
        allowRateEdit: hmsSettingsRes?.success ? hmsSettingsRes.settings.allowRateEdit : true,
        isRegistrationFee: Boolean(effectivePatientId && !appointmentId && consolidatedMedicines.some(i => i.isRegistration || i.name?.includes('Registration')))
    };

    return (
        <main className="min-h-screen bg-[#0a0a0a] overflow-hidden">
            <BillingClientEntry {...safeProps} />
        </main>
    );
}
