
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { AccountingSettingsForm } from "@/components/settings/accounting-settings-form"
import { ensureDefaultAccounts } from "@/lib/account-seeder"
import { ensureAccountingMenu, ensureAdminMenus } from "@/lib/menu-seeder"
import { ensureDefaultJournals } from "@/lib/journal-seeder"
import { getPaymentMappings } from "@/app/actions/settings"

export const dynamic = 'force-dynamic'

export default async function AccountingSettingsPage() {
    const session = await auth()
    if (!session?.user?.id) redirect('/login')

    // Auto-fix menu existence if missing (Self-Healing)
    try {
        await ensureAccountingMenu();
        await ensureAdminMenus();
    } catch (e) {
        console.error("Menu seeding failed", e);
    }

    const companyId = session.user.companyId;
    if (!companyId) return <div>No company found</div>

    // Self-Healing: Ensure Basic Accounts and Journals Exist
    if (session.user.tenantId) {
        try {
            await ensureDefaultAccounts(companyId, session.user.tenantId);
            await ensureDefaultJournals(companyId, session.user.tenantId);
        } catch (e) {
            console.error("Account/Journal seeding failed", e);
        }
    }

    // 1. Fetch Existing Settings
    const settings = await prisma.company_accounting_settings.findUnique({
        where: { company_id: companyId }
    })

    // 2. Fetch Chart of Accounts
    const accounts = await prisma.accounts.findMany({
        where: {
            company_id: companyId,
            is_active: true
        },
        orderBy: { code: 'asc' },
        select: { id: true, code: true, name: true, type: true }
    })

    // 3. Fetch Tax Rates
    const rawTaxRates = await prisma.tax_rates.findMany({
        where: {
            is_active: true
        },
        orderBy: { rate: 'asc' },
        select: { id: true, name: true, rate: true }
    })

    const taxRates = rawTaxRates.map(tr => ({
        ...tr,
        rate: Number(tr.rate || 0)
    }))

    // 4. Fetch Journals (NEW)
    const journals = await prisma.journals.findMany({
        where: { company_id: companyId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true }
    })

    // 5. Determine Tax Label (Priority: Database Setting -> Country Fallback -> Default)
    let taxLabel = "Tax";

    // Check Company Settings for overrides
    const companySettings = await prisma.company_settings.findUnique({
        where: { company_id: companyId },
        include: { tax_types: true, company: true }
    });

    let countryName = '';
    if (companySettings?.company?.country_id) {
        const countryRow = await prisma.countries.findUnique({
            where: { id: companySettings.company.country_id }
        });
        if (countryRow?.name) countryName = countryRow.name;
    }

    if (companySettings?.tax_types?.name) {
        taxLabel = companySettings.tax_types.name;
    } else if (countryName) {
        if (['India', 'Canada', 'Australia', 'New Zealand'].includes(countryName)) taxLabel = "GST";
        else if (['United Kingdom', 'United Arab Emirates', 'Saudi Arabia', 'Germany', 'France', 'Italy', 'Netherlands'].includes(countryName)) taxLabel = "VAT";
        else if (countryName === 'United States') taxLabel = "Sales Tax";
    }

    // 6. Fetch Payment Method Mappings
    const mappingRes = await getPaymentMappings();
    const paymentMappings = mappingRes.success ? mappingRes.mappings : {};

    return (
        <AccountingSettingsForm
            settings={{
                ...settings,
                default_tax_mode: companySettings?.hms_billing_mode || 'exclusive'
            }}
            accounts={accounts}
            taxRates={taxRates}
            taxLabel={taxLabel}
            journals={journals}
            paymentMappings={paymentMappings}
        />
    )
}
