'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

export async function lockAccountingPeriod(dateStr: string | null) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

    try {
        const lockDate = dateStr ? new Date(dateStr) : null;

        await (prisma.company_accounting_settings.upsert as any)({
            where: { company_id: session.user.companyId },
            create: {
                tenant_id: session.user.tenantId!,
                company_id: session.user.companyId!,
                lock_date: lockDate,
                // Required defaults for new entries
                fiscal_year_start: new Date(new Date().getFullYear(), 0, 1), // Jan 1st 
                fiscal_year_end: new Date(new Date().getFullYear(), 11, 31) // Dec 31st
            },
            update: {
                lock_date: lockDate
            }
        });

        revalidatePath('/settings/accounting');
        return { success: true };
    } catch (error: any) {
        console.error("Error locking period:", error);
        return { error: error.message || "Failed to lock period" };
    }
}

export async function updateAccountingSettings(data: any) {
    const session = await auth();
    if (!session?.user?.companyId) return { error: "Unauthorized" };

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
            (prisma.company_accounting_settings.upsert as any)({
                where: { company_id: session.user.companyId },
                create: {
                    tenant_id: session.user.tenantId!,
                    company_id: session.user.companyId!,
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
                },
                update: {
                    fiscal_year_start: fiscal_year_start ? new Date(fiscal_year_start) : undefined,
                    fiscal_year_end: fiscal_year_end ? new Date(fiscal_year_end) : undefined,
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
                }
            }),

            // 2. Sync with Company Settings for Billing Mode
            prisma.company_settings.update({
                where: { company_id: session.user.companyId },
                data: { hms_billing_mode: default_tax_mode || 'exclusive' }
            })
        ]);

        revalidatePath('/settings/accounting');
        return { success: true };
    } catch (error: any) {
        console.error("Error updating settings:", error);
        return { error: error.message || "Failed to update settings" };
    }
}
