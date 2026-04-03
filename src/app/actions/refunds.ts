'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import { AccountingService } from '@/lib/services/accounting'

/**
 * Calculates a patient's current advance balance.
 * Balance = Total Payments Received - Total Invoices Applied
 */
export async function getPatientAdvanceBalance(patientId: string) {
    const session = await auth();
    const companyId = session?.user?.companyId || session?.user?.tenantId;
    if (!companyId) return { success: false, error: "Unauthorized" };

    try {
        // 1. Get all Inbound Payments (Receipts)
        const payments = await prisma.payments.findMany({
            where: {
                partner_id: patientId,
                company_id: companyId,
                metadata: {
                    path: ['type'],
                    equals: 'inbound'
                }
            },
            select: { amount: true }
        });

        // 2. Get all Outbound Payments (Refunds)
        const refunds = await prisma.payments.findMany({
            where: {
                partner_id: patientId,
                company_id: companyId,
                metadata: {
                    path: ['type'],
                    equals: 'outbound'
                }
            },
            select: { amount: true }
        });

        // 3. Get all Invoice-Applied Payments (recorded in hms_invoice_payments)
        // This is tricky because some payments are direct to invoices and don't hit the "advance" ledger properly.
        // We look at the unallocated amount of each receipt.
        
        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const totalRefunded = refunds.reduce((sum, p) => sum + Number(p.amount), 0);

        // For simplicity: Advance = Total Credits - Total Debits in the AR Account for this patient
        const ledgerSummary = await prisma.journal_entry_lines.aggregate({
            where: {
                partner_id: patientId,
                company_id: companyId,
                account_chart: {
                    code: '1200' // Accounts Receivable (or Advance Acc)
                }
            },
            _sum: {
                debit: true,
                credit: true
            }
        });

        // AR/Advance is naturally a Debit for what they OWE us.
        // If Credit > Debit, it means they have an Advance.
        const debits = Number(ledgerSummary._sum.debit || 0);
        const credits = Number(ledgerSummary._sum.credit || 0);
        
        const advanceBalance = credits - debits;

        return { success: true, balance: Math.max(0, advanceBalance) };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Performs a financial refund of a customer's advance payment.
 * Creates an Outbound Payment record and a Journal Entry.
 */
export async function refundPatientAdvance(data: {
    patientId: string,
    amount: number,
    method: 'cash' | 'bank_transfer' | 'upi',
    reference?: string,
    notes?: string
}) {
    const session = await auth();
    const companyId = session?.user?.companyId || session?.user?.tenantId;
    const tenantId = session?.user?.tenantId;
    const userId = session?.user?.id;

    if (!companyId || !tenantId) return { success: false, error: "Unauthorized" };

    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Generate Payment Number
            const count = await tx.payments.count({ where: { company_id: companyId } });
            const pNumber = `REF-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

            // 2. Create Outbound Payment Record
            const payment = await tx.payments.create({
                data: {
                    id: crypto.randomUUID(),
                    tenant_id: tenantId,
                    company_id: companyId,
                    partner_id: data.patientId,
                    payment_number: pNumber,
                    amount: data.amount,
                    method: data.method,
                    reference: data.reference || 'Advance Refund',
                    posted: true,
                    posted_at: new Date(),
                    created_by: userId,
                    metadata: {
                        type: 'outbound',
                        is_refund: true,
                        notes: data.notes
                    }
                }
            });

            return payment;
        });

        // 3. Post to Accounting (Outbound JE)
        // Debit AR/Patient Account (to reduce credit)
        // Credit Bank/Cash Account (to record payout)
        const postResult = await AccountingService.postPaymentEntry(result.id, userId);

        if (!postResult.success) {
             return { success: true, data: result, warning: `Refund created but accounting failed: ${postResult.error}` };
        }

        revalidatePath('/hms/billing/advances');
        revalidatePath('/hms/billing/patients');
        
        return { success: true, data: result };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
