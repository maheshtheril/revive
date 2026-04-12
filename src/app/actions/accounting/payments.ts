'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { v4 as uuidv4 } from 'uuid'
import { serialize } from "@/lib/utils"
// hms_invoice_status removed (now String)
import { AccountingService } from "@/lib/services/accounting"
import { ensureDefaultAccounts } from "@/lib/account-seeder"

export type PaymentType = 'inbound' | 'outbound';

// Fetch Payments (Receipts or Vendor Payments)
export async function getPayments(type: PaymentType, search?: string, dateFilter?: string) {
    const session = await auth();
    let companyId = session?.user?.companyId;
    const tenantId = session?.user?.tenantId;

    if (!tenantId) return { error: "Unauthorized: No Tenant" };

    if (!companyId) {
        const defaultCompany = await prisma.company.findFirst({
            where: { tenant_id: tenantId }
        });
        if (defaultCompany) companyId = defaultCompany.id;
        else return { error: "Unauthorized: No Company Found" };
    }

    try {
        const whereClause: any = {
            company_id: companyId,
            metadata: {
                path: ['type'],
                equals: type
            }
        };

        if (dateFilter) {
            const startOfDay = new Date(dateFilter);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(dateFilter);
            endOfDay.setHours(23, 59, 59, 999);

            whereClause.created_at = {
                gte: startOfDay,
                lte: endOfDay
            };
        }

        const payments = await prisma.payments.findMany({
            where: whereClause,
            include: { payment_lines: true },
            orderBy: { created_at: 'desc' },
            take: 100
        });

        const enriched = await Promise.all(payments.map(async (p) => {
            let partnerName = 'Unknown';
            if (p.partner_id) {
                if (type === 'inbound') {
                    // Patient
                    const patient = await prisma.hms_patient.findUnique({ where: { id: p.partner_id }, select: { first_name: true, last_name: true } });
                    if (patient) partnerName = `${patient.first_name} ${patient.last_name}`;
                } else {
                    // Supplier
                    const supplier = await prisma.hms_supplier.findUnique({ where: { id: p.partner_id }, select: { name: true } });
                    if (supplier) partnerName = supplier.name;
                }
            } else {
                // Check metadata for direct payee
                const meta = p.metadata as any;
                if (meta?.payee_name) partnerName = meta.payee_name;
            }
            return { ...p, partner_name: partnerName };
        }));

        return { success: true, data: serialize(enriched) };
    } catch (error: any) {
        console.error("Error fetching payments:", error);
        return { error: error.message };
    }
}

export async function getExpenseAccounts() {
    const session = await auth();
    let companyId = session?.user?.companyId;
    const tenantId = session?.user?.tenantId;

    if (!tenantId) return { error: "Unauthorized: No Tenant" };

    if (!companyId) {
        const defaultCompany = await prisma.company.findFirst({
            where: { tenant_id: tenantId }
        });
        if (defaultCompany) companyId = defaultCompany.id;
        else return { error: "Unauthorized: No Company Found" };
    }

    try {
        let accounts = await prisma.accounts.findMany({
            where: {
                company_id: companyId,
                type: 'Expense',
                is_active: true
            },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' }
        });

        // Auto-seed if empty or very few accounts
        if (accounts.length < 3) {
            await ensureDefaultAccounts(companyId, tenantId);

            // Re-fetch after seeding
            accounts = await prisma.accounts.findMany({
                where: {
                    company_id: companyId,
                    type: 'Expense',
                    is_active: true
                },
                select: { id: true, name: true, code: true },
                orderBy: { name: 'asc' }
            });
        }

        return { success: true, data: accounts };
    } catch (e: any) {
        console.error("Error in getExpenseAccounts:", e);
        return { error: e.message };
    }
}

export async function getPayment(id: string) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    try {
        const payment = await prisma.payments.findUnique({
            where: { id },
            include: { payment_lines: true }
        });

        if (!payment) return { error: "Payment not found" };

        // Enrich names
        let partnerName = '';
        if (payment.partner_id) {
            const pMeta = payment.metadata as any;
            if (pMeta?.type === 'inbound') {
                const pat = await prisma.hms_patient.findUnique({ where: { id: payment.partner_id }, select: { first_name: true, last_name: true } });
                if (pat) partnerName = `${pat.first_name} ${pat.last_name}`;
            } else {
                const sup = await prisma.hms_supplier.findUnique({ where: { id: payment.partner_id }, select: { name: true } });
                if (sup) partnerName = sup.name;
            }
        }

        let journalName = '';
        if (payment.journal_id) {
            const jr = await prisma.journals.findUnique({ where: { id: payment.journal_id }, select: { name: true } });
            if (jr) journalName = jr.name;
        }

        const lines = await Promise.all((payment.payment_lines || []).map(async (l: any) => {
            const meta = l.metadata as any;
            let accountName = '';
            if (meta?.account_id) {
                const acc = await prisma.accounts.findUnique({ where: { id: meta.account_id }, select: { name: true } });
                if (acc) accountName = acc.name;
            }
            return {
                id: l.id,
                accountId: meta?.account_id,
                accountName,
                amount: l.amount.toString(),
                description: meta?.description
            };
        }));

        return { 
            success: true, 
            data: { 
                ...serialize(payment),
                partnerName,
                journalName,
                enrichedLines: lines
            } 
        };
    } catch (error: any) {
        console.error("Error fetching payment:", error);
        return { error: error.message };
    }
}

// ... (imports remain)

export async function upsertPayment(data: {
    id?: string;
    type: PaymentType;
    partner_id?: string | null;
    amount: number;
    method: string;
    reference?: string;
    date: Date;
    memo?: string;
    posted?: boolean;
    allocations?: { invoiceId: string; amount: number }[];
    lines?: { accountId: string; amount: number; description?: string }[];
    payeeName?: string;
    journalId?: string;
}) {
    const session = await auth();
    let companyId = session?.user?.companyId;
    const tenantId = session?.user?.tenantId;

    if (!tenantId) return { error: "Unauthorized: No Tenant" };
    if (!companyId) {
        const defaultCompany = await prisma.company.findFirst({ where: { tenant_id: tenantId } });
        if (defaultCompany) companyId = defaultCompany.id;
        else return { error: "Unauthorized: No Company Found" };
    }

    try {
        const lines = data.lines || [];
        let categoryName = "General Expense";
        if (lines.length > 0 && lines[0].accountId) {
            const acc = await prisma.accounts.findUnique({
                where: { id: lines[0].accountId },
                select: { name: true }
            });
            if (acc) categoryName = acc.name;
        }

        const payload = {
            tenant_id: tenantId,
            company_id: companyId,
            partner_id: data.partner_id || null,
            amount: data.amount,
            method: data.method,
            reference: data.reference,
            metadata: {
                type: data.type,
                date: data.date.toISOString(),
                memo: data.memo,
                allocations: data.allocations,
                payee_name: data.payeeName,
                category_name: categoryName
            },
            created_at: data.date,
            journal_id: data.journalId,
        };

        const result = await prisma.$transaction(async (tx) => {
            let payment;
            if (data.id) {
                // --- UPDATE MODE ---
                // 1. Fetch Existing Payment to cleanup old data
                const existing = await tx.payments.findUnique({
                    where: { id: data.id }
                });

                if (!existing) throw new Error("Payment not found");

                // Get lines manually since relation might be missing in client
                const existingLines = await tx.payment_lines.findMany({
                    where: { payment_id: data.id }
                });

                // 2. Reverse Old Allocation Effects
                for (const line of existingLines) {
                    if (line.invoice_id) {
                        if (existing.metadata && (existing.metadata as any).type === 'inbound') {
                            // Revert Sales Invoice
                            await tx.hms_invoice.update({
                                where: { id: line.invoice_id },
                                data: {
                                    total_paid: { decrement: line.amount },
                                    outstanding: { increment: line.amount },
                                    status: 'posted' as any // Revert to 'posted' (unpaid but valid)
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
                                    paid_amount: { decrement: line.amount },
                                    status: 'billed' // Revert to 'billed'
                                }
                            });
                        }
                    }
                }

                // 3. Delete Old Payment Lines
                await tx.payment_lines.deleteMany({ where: { payment_id: data.id } });

                // 4. Delete Old Accounting Entries (Journal)
                const existingJournal = await tx.journal_entries.findFirst({
                    where: { ref: existing.payment_number, tenant_id: tenantId }
                });
                if (existingJournal) {
                    await tx.journal_entry_lines.deleteMany({ where: { journal_entry_id: existingJournal.id } });
                    await tx.journal_entries.delete({ where: { id: existingJournal.id } });
                }

                // 5. Update Payment Header
                payment = await tx.payments.update({
                    where: { id: data.id },
                    data: payload
                });

            } else {
                // --- CREATE MODE ---
                const prefixToUse = data.type === 'inbound' ? 'RCP' : 'PV';
                const lastPayment = await tx.payments.findFirst({
                    where: { tenant_id: tenantId, payment_number: { startsWith: prefixToUse } },
                    orderBy: { created_at: 'desc' },
                    select: { payment_number: true }
                });

                let nextSeq = 1;
                if (lastPayment && lastPayment.payment_number) {
                    const parts = lastPayment.payment_number.split('-');
                    const lastNumVal = parts[parts.length - 1];
                    if (!isNaN(Number(lastNumVal))) nextSeq = Number(lastNumVal) + 1;
                }
                const num = `${prefixToUse}-${nextSeq.toString().padStart(5, '0')}`;

                payment = await tx.payments.create({
                    data: {
                        ...payload,
                        payment_number: num,
                        payment_number_normalized: num,
                        posted: data.posted ?? true
                    }
                });
            }

            // --- COMMON: Create New Lines & Allocations ---
            if (data.allocations && data.allocations.length > 0) {
                for (const alloc of data.allocations) {
                    const allocAmount = Number(alloc.amount);
                    if (allocAmount <= 0) continue;

                    // Create Payment Line
                    await tx.payment_lines.create({
                        data: {
                            tenant_id: (tenantId || payment.tenant_id || '') as string,
                            company_id: (companyId || payment.company_id || '') as string,
                            payment_id: payment.id,
                            invoice_id: alloc.invoiceId,
                            amount: allocAmount,
                        }
                    });

                    if (data.type === 'inbound') {
                        // RECEIPT: Update hms_invoice
                        await tx.hms_invoice_payments.create({
                            data: {
                                tenant_id: (tenantId || payment.tenant_id || '') as string,
                                company_id: (companyId || payment.company_id || '') as string,
                                invoice_id: alloc.invoiceId,
                                amount: allocAmount,
                                method: data.method as any,
                                payment_reference: payment.payment_number,
                                paid_at: data.date
                            }
                        });

                        await tx.hms_invoice.update({
                            where: { id: alloc.invoiceId },
                            data: {
                                total_paid: { increment: allocAmount },
                                outstanding: { decrement: allocAmount }
                            }
                        });

                        const updatedInvoice = await tx.hms_invoice.findUnique({
                            where: { id: alloc.invoiceId },
                            select: { outstanding: true }
                        });
                        if (updatedInvoice && Number(updatedInvoice.outstanding || 0) <= 0) {
                            await tx.hms_invoice.update({ where: { id: alloc.invoiceId }, data: { status: 'paid' as any } });
                        }
                    } else {
                        // VENDOR PAYMENT: Update hms_purchase_invoice
                        await tx.hms_purchase_invoice.update({
                            where: { id: alloc.invoiceId },
                            data: { paid_amount: { increment: allocAmount } }
                        });

                        const updatedBill = await tx.hms_purchase_invoice.findUnique({
                            where: { id: alloc.invoiceId },
                            select: { total_amount: true, paid_amount: true }
                        });
                        if (updatedBill && Number(updatedBill.paid_amount || 0) >= Number(updatedBill.total_amount || 0)) {
                            await tx.hms_purchase_invoice.update({ where: { id: alloc.invoiceId }, data: { status: 'closed' } });
                        }
                    }
                }
            }

            // Handle Direct Expense Lines
            if (data.lines && data.lines.length > 0) {
                for (const line of data.lines) {
                    const lineAmount = Number(line.amount);
                    if (lineAmount <= 0) continue;

                    const account = await tx.accounts.findUnique({
                        where: { id: line.accountId },
                        select: { name: true }
                    });

                    await tx.payment_lines.create({
                        data: {
                            tenant_id: (tenantId || payment.tenant_id || '') as string,
                            company_id: (companyId || payment.company_id || '') as string,
                            payment_id: payment.id,
                            amount: lineAmount,
                            metadata: {
                                account_id: line.accountId,
                                account_name: account?.name || 'Expense',
                                description: line.description
                            }
                        }
                    });
                }
            }

            return payment;
        });

        if (!result) return { error: "Failed to create payment" };

        if (result.posted) {
            await AccountingService.postPaymentEntry(result.id, session.user.id);
        }

        revalidatePath(data.type === 'inbound' ? '/hms/accounting/receipts' : '/hms/accounting/payments');
        revalidatePath('/hms/reception/dashboard');
        return { success: true, data: serialize(result) };

    } catch (error: any) {
        console.error("Error saving payment:", error);
        return { error: error.message };
    }
}

export async function postPayment(id: string) {
    const session = await auth();
    if (!session?.user?.id) return { error: "Unauthorized" };
    try {
        await AccountingService.postPaymentEntry(id, session.user.id);
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function deletePayment(id: string) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;

    if (!tenantId) return { error: "Unauthorized" };

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Get payment 
            const payment = await tx.payments.findUnique({
                where: { id }
            });

            if (!payment) throw new Error("Payment not found");

            // Get lines manually
            const paymentLines = await tx.payment_lines.findMany({
                where: { payment_id: id }
            });

            // 2. Reverse Allocation Effects
            for (const line of paymentLines) {
                if (line.invoice_id) {
                    if (payment.metadata && (payment.metadata as any).type === 'inbound') {
                        // Revert Sales Invoice
                        await tx.hms_invoice.update({
                            where: { id: line.invoice_id },
                            data: {
                                total_paid: { decrement: line.amount },
                                outstanding: { increment: line.amount },
                                status: 'posted' as any
                            }
                        });

                        // Delete hms_invoice_payments record
                        await tx.hms_invoice_payments.deleteMany({
                            where: {
                                invoice_id: line.invoice_id,
                                payment_reference: payment.payment_number
                            }
                        });

                    } else {
                        // Revert Purchase Invoice (Bill)
                        await tx.hms_purchase_invoice.update({
                            where: { id: line.invoice_id },
                            data: {
                                paid_amount: { decrement: line.amount },
                                status: 'billed'
                            }
                        });
                    }
                }
            }

            // 3. Delete Payment Lines
            await tx.payment_lines.deleteMany({ where: { payment_id: id } });

            // 4. Delete Payment 
            await tx.payments.delete({ where: { id } });

            // 5. Reverse Accounting Entry (If posted)
            const journal = await tx.journal_entries.findFirst({
                where: { ref: payment.payment_number, tenant_id: tenantId }
            });
            if (journal) {
                await tx.journal_entry_lines.deleteMany({ where: { journal_entry_id: journal.id } });
                await tx.journal_entries.delete({ where: { id: journal.id } });
            }
        });

        revalidatePath('/hms/accounting/payments');
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting payment:", error);
        return { error: error.message };
    }
}
