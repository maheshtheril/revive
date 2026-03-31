import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { ReceptionActionCenter } from "@/components/hms/reception/reception-action-center"
import { redirect } from "next/navigation"
import { getBranches, getCurrentCompany } from "@/app/actions/company"
import { getBillableItems, getTaxConfiguration, getUoms } from "@/app/actions/billing"

export const dynamic = 'force-dynamic'

// [OPTIMIZED SERIALIZATION] Standard serializable types handled efficiently
function serialize(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(serialize);
    if (obj instanceof Date) return obj;

    // Prisma Decimals usually have a toJSON or toNumber method
    if (typeof obj.toNumber === 'function') {
        return obj.toNumber();
    }

    const newObj: any = {};
    for (const key in obj) {
        newObj[key] = serialize(obj[key]);
    }
    return newObj;
}

export default async function ReceptionDashboardPage() {
    const session = await auth()
    if (!session?.user?.id) {
        return <div className="p-10 text-slate-500 font-bold bg-white rounded-3xl m-10 shadow-2xl border-4 border-dashed border-slate-200 flex flex-col items-center gap-4">
            <div className="text-4xl text-slate-300">🔐</div>
            YOU ARE NOT LOGGED IN. PLEASE GO TO <a href="/login" className="text-blue-500 underline">LOGIN PAGE</a> FIRST.
            <div className="text-xs font-mono bg-slate-50 p-2 rounded">Path: src/app/hms/reception/dashboard/page.tsx</div>
        </div>
    }

    try {

        const tenantId = session.user.tenantId as string
        const companyId = session.user.companyId as string

        if (!tenantId || !companyId) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
                    <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
                    <p>Your account is not fully setup. Please contact admin to assign a Company/Branch.</p>
                </div>
            )
        }

        const branchesRes = await getBranches()
        const branches = branchesRes.success ? branchesRes.data : []
        const currentCompany = await getCurrentCompany()
        const isAdmin = !!session?.user?.isAdmin || !!session?.user?.isTenantAdmin
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const todayEnd = new Date()
        todayEnd.setHours(23, 59, 59, 999)

        // Parallel Data Fetching
        const [
            appointmentsRaw,
            patientsList,
            doctorsList,
            todayPaymentsList,
            todayExpensesList,
            draftCountVal,
            availableBedsCount,
            activeAdmissions,
            itemsRes,
            taxRes,
            uomsRes,
            companySettings
        ] = await Promise.all([
            prisma.hms_appointments.findMany({
                where: {
                    tenant_id: tenantId,
                    starts_at: { gte: todayStart, lte: todayEnd }
                },
                select: {
                    id: true,
                    patient_id: true,
                    clinician_id: true,
                    starts_at: true,
                    ends_at: true,
                    status: true,
                    type: true,
                    priority: true,
                    notes: true,
                    hms_patient: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            patient_number: true,
                            dob: true,
                            gender: true,
                            contact: true
                        }
                    },
                    hms_clinician: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            hms_specializations: { select: { name: true } }
                        }
                    },
                    prescription: { select: { id: true } },
                    hms_invoice: { select: { id: true, status: true, total: true, outstanding_amount: true } },
                    hms_lab_order: { select: { id: true, status: true } }
                },
                orderBy: { starts_at: 'desc' }
            }),
            prisma.hms_patient.findMany({
                where: { tenant_id: tenantId },
                take: 20, // Reduced from 100 for performance
                orderBy: { created_at: 'desc' },
                select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    patient_number: true,
                    dob: true,
                    gender: true,
                    contact: true
                }
            }),
            prisma.hms_clinicians.findMany({
                where: { is_active: true, tenant_id: tenantId },
                select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    hms_specializations: { select: { name: true } },
                    role: true,
                    consultation_start_time: true,
                    consultation_end_time: true,
                    consultation_slot_duration: true
                },
                orderBy: { first_name: 'asc' }
            }),
            prisma.hms_invoice_payments.findMany({
                where: {
                    tenant_id: tenantId,
                    paid_at: { gte: todayStart, lte: todayEnd }
                },
                select: {
                    id: true,
                    amount: true,
                    method: true,
                    paid_at: true,
                    payment_reference: true,
                    hms_invoice: {
                        select: {
                            invoice_number: true,
                            hms_patient: { select: { first_name: true, last_name: true } }
                        }
                    }
                },
                orderBy: { paid_at: 'desc' }
            }),
            prisma.payments.findMany({
                where: {
                    tenant_id: tenantId,
                    metadata: { path: ['type'], equals: 'outbound' },
                    created_at: { gte: todayStart, lte: todayEnd }
                },
                select: {
                    id: true,
                    amount: true,
                    payment_number: true,
                    reference: true,
                    created_at: true,
                    method: true
                },
                orderBy: { created_at: 'desc' }
            }),
            prisma.hms_invoice.count({
                where: { company_id: companyId, status: 'draft' as any }
            }),
            prisma.hms_bed.count({
                where: { tenant_id: tenantId, status: 'available' }
            }),
            prisma.hms_admission.findMany({
                where: { tenant_id: tenantId, status: 'admitted' },
                select: { patient_id: true, ward: true, bed: true }
            }),
            getBillableItems(),
            getTaxConfiguration(),
            getUoms(),
            prisma.company_settings.findUnique({
                where: { company_id: companyId },
                select: {
                    currencies: {
                        select: { symbol: true, code: true }
                    }
                }
            })
        ]);

        const billableItems = itemsRes.success ? itemsRes.data : [];
        const taxConfig = taxRes.success ? taxRes.data : { defaultTax: null, taxRates: [] };
        const uoms = (uomsRes as any).success ? (uomsRes as any).data : [];
        const currency = companySettings?.currencies?.symbol || session.user.currencySymbol || '₹';


        // Fetch Vitals & Tags
        const appointmentIds = appointmentsRaw.map(a => a.id);
        const [vitalsRaw, tagsRaw] = await Promise.all([
            prisma.hms_vitals.findMany({
                where: { encounter_id: { in: appointmentIds }, tenant_id: tenantId },
                select: { 
                    encounter_id: true,
                    temperature: true,
                    pulse: true,
                    respiration: true,
                    systolic: true,
                    diastolic: true,
                    spo2: true,
                    weight: true,
                    height: true
                }
            }),
            prisma.hms_appointment_tags.findMany({
                where: { appointment_id: { in: appointmentIds }, tenant_id: tenantId },
                select: { appointment_id: true, tag: true }
            })
        ]);

        const vitalsMap: Record<string, any> = {};
        vitalsRaw.forEach(v => {
            if (v.encounter_id) vitalsMap[v.encounter_id] = v;
        });

        const tagsMap: Record<string, string[]> = {};
        tagsRaw.forEach(t => {
            if (!tagsMap[t.appointment_id]) tagsMap[t.appointment_id] = [];
            tagsMap[t.appointment_id].push(t.tag);
        });

        // Calculate Total Collection
        const totalCollection = todayPaymentsList.reduce((sum, p) => sum + Number(p.amount), 0);
        const collectionBreakdown = todayPaymentsList.reduce((acc, p) => {
            const method = p.method as string || 'Other';
            acc[method] = (acc[method] || 0) + Number(p.amount);
            return acc;
        }, {} as Record<string, number>);

        // Transform appointments to friendly format
        const formattedAppointments = appointmentsRaw.map(apt => {
            const invoices = (apt.hms_invoice || []).map((inv: any) => ({
                ...inv,
                total: Number(inv.total || 0),
                outstanding_amount: Number(inv.outstanding_amount || 0)
            }));
            const labs = apt.hms_lab_order || [];

            const hasPendingInvoice = invoices.some(inv => inv.status !== 'paid' && inv.status !== 'cancelled');
            const isPaid = invoices.length > 0 && invoices.every(inv => inv.status === 'paid');
            const hasPendingLabs = labs.some(l => l.status !== 'completed' && l.status !== 'partial' && l.status !== 'verified');

            const admission = activeAdmissions.find(a => a.patient_id === apt.patient_id);

            return {
                id: apt.id,
                patient_id: apt.patient_id,
                clinician_id: apt.clinician_id,
                start_time: apt.starts_at,
                status: apt.status,
                priority: apt.priority, // Important for highlighting
                type: apt.type, // Visit Type (consultation, emergency, etc.)
                notes: apt.notes, // Appointment notes
                patient: apt.hms_patient,
                clinician: apt.hms_clinician,
                // Enhanced Status Flags
                hasVitals: !!vitalsMap[apt.id],
                vitals: vitalsMap[apt.id] || null,
                hasPrescription: apt.prescription && apt.prescription.length > 0,
                tags: tagsMap[apt.id] || [],
                invoiceStatus: hasPendingInvoice ? 'pending' : (isPaid ? 'paid' : 'none'),
                labStatus: labs.length > 0 ? (hasPendingLabs ? 'pending' : 'completed') : 'none',
                assigned_ward: admission?.ward,
                assigned_bed: admission?.bed,
                hms_invoice: invoices // Re-inject serialized invoices
            };
        });

        const totalExpenses = todayExpensesList.reduce((sum, e) => sum + Number(e.amount), 0);

        // SERIALIZATION FIX: Convert Decimals in Payments and Expenses
        const serializedPayments = todayPaymentsList.map(p => ({
            ...p,
            amount: Number(p.amount || 0)
        }));

        const serializedExpenses = todayExpensesList.map(e => ({
            ...e,
            amount: Number(e.amount || 0)
        }));

        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 max-w-7xl mx-auto space-y-6">
                {/* ShiftManager moved to Action Center */}
                <ReceptionActionCenter
                    todayAppointments={serialize(formattedAppointments)}
                    patients={serialize(patientsList)}
                    doctors={serialize(doctorsList)}
                    dailyCollection={totalCollection}
                    collectionBreakdown={collectionBreakdown}
                    todayPayments={serialize(serializedPayments)}
                    todayExpenses={serialize(serializedExpenses)}
                    totalExpenses={totalExpenses}
                    draftCount={draftCountVal}
                    availableBeds={availableBedsCount}
                    branches={serialize(branches || [])}
                    isAdmin={isAdmin}
                    billableItems={serialize(billableItems)}
                    taxConfig={serialize(taxConfig)}
                    uoms={serialize(uoms)}
                    currency={currency}
                    hospitalInfo={serialize(currentCompany)}
                />
            </div>
        )
    } catch (err: any) {
        console.error("DASHBOARD CRASH:", err);
        return (
            <div className="p-10 border-4 border-dashed border-red-500 rounded-3xl bg-red-50 text-red-900 m-6">
                <h1 className="text-3xl font-black mb-4">CRITICAL SYSTEM ERROR</h1>
                <p className="font-bold mb-2">The Reception Dashboard failed to load due to a server-side exception.</p>
                <div className="bg-red-950 text-red-100 p-6 rounded-xl font-mono text-sm overflow-auto max-h-[400px]">
                    <p className="font-black text-red-400 mb-2">ERROR MESSAGE:</p>
                    {err.message || String(err)}
                    <p className="font-black text-red-400 mt-4 mb-2">STACK TRACE:</p>
                    {err.stack || "No stack trace available"}
                </div>
                <p className="mt-6 text-sm italic">Please share the above error details with support.</p>
            </div>
        )
    }
}
