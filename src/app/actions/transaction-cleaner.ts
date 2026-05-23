'use server'

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

/**
 * Surgical Clinical Data Wipe
 * Removes all visit-related transactions for the current tenant.
 * Keeps Product Masters, Suppliers, and Account setup intact.
 */
export async function clearClinicalTransactions() {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) return { error: "Unauthorized" };

    try {
        console.log(`[TRANSACTION-CLEANER] Initiating clinical wipe for tenant: ${tenantId}`);

        const where = { tenant_id: tenantId as any };

        // 1. Clear Billing Data
        // Cascade will handle invoice_lines and invoice_payments in many cases, but we do it explicitly to be safe
        await prisma.hms_invoice_lines.deleteMany({ where });
        await prisma.hms_invoice_payments.deleteMany({ where });
        await prisma.hms_invoice_history.deleteMany({ where });
        await prisma.hms_invoice.deleteMany({ where });

        // 2. Clear Nursing & Pharmacy Consumption
        await prisma.hms_stock_move.deleteMany({ where });
        await prisma.hms_stock_ledger.deleteMany({ where });
        
        // Reset stock levels to zero for a fresh start
        await prisma.hms_stock_levels.updateMany({
            where,
            data: { quantity: 0 }
        });

        // 3. Clear Doctor's Clinical Records
        await prisma.prescription_items.deleteMany({ 
            where: { 
                prescription: { tenant_id: tenantId as any } 
            } 
        });
        await prisma.prescription.deleteMany({ where });

        // 4. Clear Laboratory Records
        await prisma.hms_lab_order_line.deleteMany({ where });
        await prisma.hms_lab_order_lines.deleteMany({ where });
        await prisma.hms_lab_order.deleteMany({ where });

        // 5. Clear Patient Vitals
        await prisma.hms_vitals.deleteMany({ where });

        // 6. Optional: Reset Appointment Statuses (or keep them but mark as draft?)
        // The user wants "fresh data entry", so we'll reset appointment status to 'scheduled' 
        // to allow re-entry of clinical notes.
        await prisma.hms_appointments.updateMany({
            where,
            data: { status: 'scheduled' }
        });

        console.log(`[TRANSACTION-CLEANER] Wipe complete.`);

        revalidatePath('/hms/billing');
        revalidatePath('/hms/nursing');
        revalidatePath('/hms/doctor/dashboard');
        revalidatePath('/hms/prescriptions');

        return { 
            success: true, 
            message: "Clinical Slate Cleaned. All prescriptions, invoices, and consumptions have been wiped for a fresh start." 
        };

    } catch (error: any) {
        console.error("[TRANSACTION-CLEANER] Failed:", error);
        return { error: `Wipe failed: ${error.message}` };
    }
}
