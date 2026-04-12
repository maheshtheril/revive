'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { AccountingService } from "@/lib/services/accounting"
import { serialize } from "@/lib/utils"

// ... imports

export async function recordExpense(data: {
    id?: string; // Optional ID for updates
    amount: number;
    categoryId: string; // The Expense Account ID
    payeeName: string;
    memo?: string;
    date: Date;
    method?: string; // defaulting to 'cash'
    reference?: string;
    journalId?: string;
}) {
    const session = await auth();
    const companyId = session?.user?.companyId;
    const tenantId = session?.user?.tenantId;

    if (!tenantId || !companyId) {
        return { error: "Unauthorized: Missing Company or Tenant ID" };
    }

    try {
        // 1. Get Expense Category Name for Metadata
        const account = await prisma.accounts.findUnique({
            where: { id: data.categoryId },
            select: { name: true, code: true }
        });

        if (!account) return { error: "Invalid Expense Category" };

        const categoryName = account.name;

        // 2. Handle ID Logic (Create vs Update)
        const result = await prisma.$transaction(async (tx) => {
            let payment;
            let paymentNumber;

            if (data.id) {
                // --- UPDATE MODE ---
                const existing = await tx.payments.findUnique({ where: { id: data.id } });
                if (!existing) throw new Error("Expense not found");

                paymentNumber = existing.payment_number;

                // 1. Fetch lines manually
                const existingLines = await tx.payment_lines.findMany({ where: { payment_id: data.id } });

                // 2. Reverse Old Allocation Effects (if any existed, e.g. switching from Bill Pay)
                for (const line of existingLines) {
                    if (line.invoice_id) {
                        if (existing.metadata && (existing.metadata as any).type === 'inbound') {
                            // Revert Sales Invoice
                            await tx.hms_invoice.update({
                                where: { id: line.invoice_id },
                                data: {
                                    total_paid: { decrement: line.amount || 0 },
                                    outstanding: { increment: line.amount || 0 },
                                    status: 'posted'
                                }
                            });
                            await tx.hms_invoice_payments.deleteMany({
                                where: { invoice_id: line.invoice_id, payment_reference: existing.payment_number }
                            });
                        } else {
                            // Revert Purchase Invoice
                            await tx.hms_purchase_invoice.update({
                                where: { id: line.invoice_id },
                                data: {
                                    paid_amount: { decrement: line.amount || 0 },
                                    status: 'billed'
                                }
                            });
                        }
                    }
                }

                // 3. Delete existing lines (Refresh lines)
                await tx.payment_lines.deleteMany({ where: { payment_id: data.id } });

                // 4. Remove existing Journal Entry (will be re-posted)
                const existingJournal = await tx.journal_entries.findFirst({
                    where: { ref: existing.payment_number, tenant_id: tenantId }
                });
                if (existingJournal) {
                    await tx.journal_entry_lines.deleteMany({ where: { journal_entry_id: existingJournal.id } });
                    await tx.journal_entries.delete({ where: { id: existingJournal.id } });
                }

                // C. Update Payment Header
                payment = await tx.payments.update({
                    where: { id: data.id },
                    data: {
                        amount: data.amount,
                        method: data.method || 'cash',
                        reference: data.reference,
                        created_at: data.date, // Update date
                        metadata: {
                            type: 'outbound',
                            date: data.date.toISOString(),
                            memo: data.memo,
                            payee_name: data.payeeName,
                            category_name: categoryName,
                            category_code: account.code
                        },
                        journal_id: data.journalId,
                    }
                });

            } else {
                // --- CREATE MODE ---

                // Generate Payment Voucher Number (PV-XXXXX)
                const prefix = 'PV';
                const lastPayment = await tx.payments.findFirst({
                    where: {
                        tenant_id: tenantId,
                        payment_number: { startsWith: prefix }
                    },
                    orderBy: { created_at: 'desc' },
                    select: { payment_number: true }
                });

                let nextSeq = 1;
                if (lastPayment && lastPayment.payment_number) {
                    const parts = lastPayment.payment_number.split('-');
                    const lastNumVal = parts[parts.length - 1];
                    if (!isNaN(Number(lastNumVal))) {
                        nextSeq = Number(lastNumVal) + 1;
                    }
                }

                paymentNumber = `${prefix}-${nextSeq.toString().padStart(5, '0')}`;

                payment = await tx.payments.create({
                    data: {
                        tenant_id: tenantId,
                        company_id: companyId,
                        amount: data.amount,
                        method: data.method || 'cash',
                        reference: data.reference,
                        payment_number: paymentNumber,
                        payment_number_normalized: paymentNumber,
                        posted: true, // Auto-post expenses
                        metadata: {
                            type: 'outbound',
                            date: data.date.toISOString(),
                            memo: data.memo,
                            payee_name: data.payeeName,
                            category_name: categoryName,
                            category_code: account.code
                        },
                        created_at: data.date,
                        journal_id: data.journalId,
                    }
                });
            }

            // 3. Create Payment Line (Expense Line) - Common for Create/Update
            await tx.payment_lines.create({
                data: {
                    tenant_id: tenantId,
                    company_id: companyId,
                    payment_id: payment.id,
                    amount: data.amount,
                    metadata: {
                        account_id: data.categoryId,
                        account_name: categoryName,
                        description: data.memo
                    }
                }
            });

            return payment;
        });

        if (!result) return { error: "Failed to record expense" };

        // 4. Post to Accounting (General Ledger) - Re-post for updates too
        await AccountingService.postPaymentEntry(result.id, session.user.id);

        revalidatePath('/hms/reception/dashboard');
        revalidatePath('/hms/accounting/expenses');
        revalidatePath('/hms/accounting/payments');

        return { success: true, data: serialize(result) };

    } catch (error: any) {
        console.error("Error recording expense:", error);
        return { error: error.message };
    }
}
