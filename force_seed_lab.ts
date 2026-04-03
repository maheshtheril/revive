import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const companies = await prisma.crm_company.findMany()
    for (const company of companies) {
        console.log(`Seeding for company: ${company.name}`)
        const tenantId = company.tenant_id
        const companyId = company.id

        const standardTests = [
            // Hematology
            { name: 'Complete Blood Count (CBC)', price: 400, units: 'cells/mcL', reference_range: 'Hb: 12-16, WBC: 4-11, Plt: 1.5-4.5' },
            { name: 'ESR (Westergren)', price: 150, units: 'mm/hr', reference_range: 'Male: 0-15, Female: 0-20' },
            { name: 'Blood Grouping & Rh Type', price: 200, units: '—', reference_range: 'A/B/O/AB Pos/Neg' },
            { name: 'HbA1c (Glycated Hb)', price: 650, units: '%', reference_range: 'Non-Diabetic: < 5.7' },
            { name: 'Blood Glucose (Fasting)', price: 150, units: 'mg/dL', reference_range: '70 - 100' },
            { name: 'Liver Function Test (LFT)', price: 950, units: 'U/L', reference_range: 'ALT: 7-55, AST: 8-48' },
            { name: 'Kidney Function Test (KFT)', price: 750, units: 'mg/dL', reference_range: 'Creatinine: 0.7-1.3' },
            { name: 'Lipid Profile (Full)', price: 850, units: 'mg/dL', reference_range: 'Chol: <200, HDL: >40, LDL: <100' },
            { name: 'Thyroid Profile (T3, T4, TSH)', price: 950, units: '—', reference_range: 'TSH: 0.4 - 4.0' },
            { name: 'Urine Routine & Microscopic', price: 200, units: '—', reference_range: 'Normal' },
             { name: 'Malaria Parasite (MP/Card)', price: 350, units: '—', reference_range: 'Negative' },
            { name: 'Dengue NS1 Antigen', price: 850, units: '—', reference_range: 'Negative' },
        ]

        for (const test of standardTests) {
            const existing = await prisma.hms_lab_test.findFirst({
                where: { name: test.name, company_id: companyId }
            })
            if (!existing) {
                await prisma.hms_lab_test.create({
                    data: {
                        ...test,
                        tenant_id: tenantId!,
                        company_id: companyId,
                        is_active: true
                    }
                })
            } else {
                // Update price at least
                await prisma.hms_lab_test.update({
                    where: { id: existing.id },
                    data: { price: test.price }
                })
            }
        }
    }
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
