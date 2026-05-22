'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

export async function lockAccountingPeriod(dateStr: string | null, supervisorPin?: string | null) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    const companyId = session.user.companyId;
    const tenantId = session.user.tenantId;

    try {
        const lockDate = dateStr ? new Date(dateStr) : null;
        const cleanPin = supervisorPin ? supervisorPin.trim() : null;

        const existing = await prisma.company_accounting_settings.findUnique({
            where: { company_id: companyId }
        });

        if (existing) {
            await prisma.company_accounting_settings.update({
                where: { id: existing.id },
                data: { 
                    lock_date: lockDate,
                    ...(cleanPin !== null && { localization: cleanPin })
                }
            });
        } else {
            await prisma.company_accounting_settings.create({
                data: {
                    tenant_id: tenantId!,
                    company_id: companyId,
                    lock_date: lockDate,
                    localization: cleanPin || "2035",
                    fiscal_year_start: new Date(new Date().getFullYear(), 0, 1),
                    fiscal_year_end: new Date(new Date().getFullYear(), 11, 31)
                }
            });
        }

        revalidatePath('/settings/accounting');
        return { success: true };
    } catch (error: any) {
        console.error("Error locking period & PIN:", error);
        return { error: error.message || "Failed to update period and PIN" };
    }
}

export async function updateAccountingSettings(data: any) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    const companyId = session.user.companyId;
    const tenantId = session.user.tenantId;

    try {
        const {
            // General
            fiscal_year_start,
            fiscal_year_end,
            currency_precision,
            rounding_method,
            retained_earnings_account_id,
            default_tax_mode,

            // Journals
            sales_journal_id,
            purchase_journal_id,
            bank_journal_id,
            cash_journal_id,
            general_journal_id,

            // Sales
            ar_account_id,
            sales_account_id,
            output_tax_account_id,
            default_sale_tax_id,
            sales_discount_account_id,

            // Purchases
            ap_account_id,
            purchase_account_id,
            input_tax_account_id,
            purchase_discount_account_id,

            // Inventory
            inventory_asset_account_id,
            cogs_account_id,
            stock_adjustment_account_id,

            // Advanced
            exchange_gain_loss_account_id
        } = data;

        await Promise.all([
            // 1. Update Accounting Settings
            (async () => {
                const existing = await prisma.company_accounting_settings.findUnique({
                    where: { company_id: companyId }
                });

                const payload = {
                    tenant_id: tenantId!,
                    company_id: companyId,
                    fiscal_year_start: fiscal_year_start ? new Date(fiscal_year_start) : new Date(new Date().getFullYear(), 0, 1),
                    fiscal_year_end: fiscal_year_end ? new Date(fiscal_year_end) : new Date(new Date().getFullYear(), 11, 31),
                    currency_precision: currency_precision ? parseInt(currency_precision) : 2,
                    rounding_method: rounding_method || 'ROUND_HALF_UP',
                    retained_earnings_account_id: retained_earnings_account_id || null,
                    sales_journal_id: sales_journal_id || null,
                    purchase_journal_id: purchase_journal_id || null,
                    bank_journal_id: bank_journal_id || null,
                    cash_journal_id: cash_journal_id || null,
                    general_journal_id: general_journal_id || null,
                    ar_account_id: ar_account_id || null,
                    sales_account_id: sales_account_id || null,
                    output_tax_account_id: output_tax_account_id || null,
                    default_sale_tax_id: default_sale_tax_id || null,
                    sales_discount_account_id: sales_discount_account_id || null,
                    ap_account_id: ap_account_id || null,
                    purchase_account_id: purchase_account_id || null,
                    input_tax_account_id: input_tax_account_id || null,
                    purchase_discount_account_id: purchase_discount_account_id || null,
                    inventory_asset_account_id: inventory_asset_account_id || null,
                    cogs_account_id: cogs_account_id || null,
                    stock_adjustment_account_id: stock_adjustment_account_id || null,
                    exchange_gain_loss_account_id: exchange_gain_loss_account_id || null
                };

                if (existing) {
                    await prisma.company_accounting_settings.update({
                        where: { id: existing.id },
                        data: {
                            ...payload,
                            // For update, we can be more selective if needed, but payload is fine
                            fiscal_year_start: fiscal_year_start ? new Date(fiscal_year_start) : undefined,
                            fiscal_year_end: fiscal_year_end ? new Date(fiscal_year_end) : undefined
                        }
                    });
                } else {
                    await prisma.company_accounting_settings.create({
                        data: payload
                    });
                }
            })(),

            // 2. Sync with Company Settings for Billing Mode
            (async () => {
                const compSettings = await prisma.company_settings.findUnique({
                    where: { company_id: companyId }
                });
                if (compSettings) {
                    await prisma.company_settings.update({
                        where: { company_id: companyId },
                        data: { hms_billing_mode: default_tax_mode || 'exclusive' }
                    });
                } else {
                    const firstCurr = await prisma.currencies.findFirst({ where: { is_active: true } });
                    if (!firstCurr) return; // safety check
                    await prisma.company_settings.create({
                        data: {
                            tenant: { connect: { id: tenantId! } },
                            company: { connect: { id: companyId } },
                            currencies: { connect: { id: firstCurr.id } },
                            hms_billing_mode: default_tax_mode || 'exclusive'
                        }
                    });
                }
            })()
        ]);

        revalidatePath('/settings/accounting');
        return { success: true };
    } catch (error: any) {
        console.error("Error updating settings:", error);
        return { error: error.message || "Failed to update settings" };
    }
}
