import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { MASTER_TAX_RATES, COUNTRY_TAX_CONFIGS, GLOBAL_DEFAULT_TAXES } from "@/lib/tax-master-data";

export async function ensureGlobalTaxes(tx?: any) {
    const db = tx || prisma;
    const count = await db.tax_rates.count();
    if (count > 0) return { success: true, message: "Taxes already exist" };

    console.log("[TaxSeed] Seeding global master taxes...");
    const logs: string[] = [];

    for (const r of MASTER_TAX_RATES) {
        // 1. Ensure Tax Type
        let taxType = await db.tax_types.findFirst({ where: { name: r.type } });
        if (!taxType) {
            taxType = await db.tax_types.create({
                data: {
                    id: crypto.randomUUID(),
                    name: r.type,
                    description: `${r.name} Class`,
                    is_active: true
                }
            });
            logs.push(`Created Tax Type: ${r.type}`);
        }

        // 2. Ensure Tax Rate
        let taxRate = await db.tax_rates.findFirst({
            where: { tax_type_id: taxType.id, rate: r.rate }
        });
        if (!taxRate) {
            await db.tax_rates.create({
                data: {
                    id: crypto.randomUUID(),
                    tax_type_id: taxType.id,
                    name: r.name,
                    rate: r.rate,
                    is_active: true
                }
            });
            logs.push(`Created Tax Rate: ${r.name}`);
        }
    }

    // 3. Seed Country Mappings (Global/Master)
    for (const config of COUNTRY_TAX_CONFIGS) {
        const country = await db.countries.findFirst({ where: { iso2: config.countryIso2 } });
        if (!country) continue;

        for (const taxName of config.taxNames) {
            const rate = await db.tax_rates.findFirst({ where: { name: taxName } });
            if (!rate) continue;

            const exists = await db.country_tax_mappings.findFirst({
                where: { country_id: country.id, tax_rate_id: rate.id }
            });

            if (!exists) {
                await db.country_tax_mappings.create({
                    data: {
                        id: crypto.randomUUID(),
                        country_id: country.id,
                        tax_type_id: rate.tax_type_id,
                        tax_rate_id: rate.id,
                        is_active: true
                    }
                });
                logs.push(`Mapped ${taxName} to ${country.name}`);
            }
        }
    }

    return { success: true, logs };
}

export async function seedCompanyTaxes(companyId: string, tx?: any) {
    const db = tx || prisma;
    
    // 1. Ensure Global Master Data exists
    await ensureGlobalTaxes(db);

    const company = await db.company.findUnique({
        where: { id: companyId }
    });

    if (!company) return { error: "Company not found" };

    let countryRow = null;
    if (company.country_id) {
        countryRow = await db.countries.findUnique({ where: { id: company.country_id } });
    }

    const tenantId = company.tenant_id;
    const existingMaps = await db.company_tax_maps.count({ where: { company_id: companyId } });
    if (existingMaps > 0) return { success: true, message: "Company taxes already mapped" };

    console.log(`[TaxSeed] Mapping default taxes for Company: ${company.name} (${countryRow?.name || 'Global'})`);
    
    // 2. Determine which taxes to map
    const countryIso = countryRow?.iso2 || 'IN'; // Fallback to IN if not set
    const config = COUNTRY_TAX_CONFIGS.find(c => c.countryIso2 === countryIso);
    const taxNamesToMap = config ? config.taxNames : GLOBAL_DEFAULT_TAXES;

    const logs: string[] = [];

    for (const name of taxNamesToMap) {
        const rateRow = await db.tax_rates.findFirst({ where: { name } });
        if (!rateRow) continue;

        await db.company_tax_maps.create({
            data: {
                id: crypto.randomUUID(),
                tenant_id: tenantId,
                company_id: companyId,
                tax_rate_id: rateRow.id,
                tax_type_id: rateRow.tax_type_id,
                is_active: true,
                is_default: rateRow.rate === 0
            } as any
        });
        logs.push(`Linked ${name}`);
    }

    return { success: true, logs };
}
