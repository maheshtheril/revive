import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const tenantId = '00000000-0000-0000-0000-000000000000' // Use default or find active
  const companyId = '00000000-0000-0000-0000-000000000000' // Use default or find active

  // Find actual tenant/company if possible
  const firstUser = await prisma.app_user.findFirst()
  const activeTenantId = firstUser?.tenant_id || tenantId
  const activeCompanyId = firstUser?.company_id || companyId

  console.log(`Using Tenant: ${activeTenantId}, Company: ${activeCompanyId}`)

  const testGroups = [
    { name: 'Hematology (Mispa Plus)', description: 'Complete Blood Count and related tests' },
    { name: 'Biochemistry (Cipla)', description: 'Blood Sugar, Kidney and Liver Function' }
  ]

  for (const group of testGroups) {
    await prisma.hms_lab_test_group.upsert({
      where: {
        company_id_name: {
          company_id: activeCompanyId,
          name: group.name
        }
      },
      update: {},
      create: {
        tenant_id: activeTenantId,
        company_id: activeCompanyId,
        name: group.name,
        description: group.description
      }
    })
  }

  const groups = await prisma.hms_lab_test_group.findMany({
    where: { company_id: activeCompanyId }
  })

  const hemGroup = groups.find(g => g.name.includes('Hematology'))?.id
  const bioGroup = groups.find(g => g.name.includes('Biochemistry'))?.id

  const tests = [
    // Mispa Plus (Hematology)
    { name: 'Hemoglobin (Hb)', units: 'g/dL', range: { min: 12.0, max: 16.0 }, groupId: hemGroup },
    { name: 'Total WBC Count', units: 'cells/cu.mm', range: { min: 4000, max: 11000 }, groupId: hemGroup },
    { name: 'Red Blood Cell Count', units: 'million/cu.mm', range: { min: 4.5, max: 5.5 }, groupId: hemGroup },
    { name: 'Platelet Count', units: 'lakhs/cu.mm', range: { min: 1.5, max: 4.5 }, groupId: hemGroup },
    { name: 'PCV (Hematocrit)', units: '%', range: { min: 36, max: 48 }, groupId: hemGroup },
    { name: 'MCV', units: 'fL', range: { min: 80, max: 100 }, groupId: hemGroup },
    
    // Cipla (Biochemistry)
    { name: 'Blood Glucose (Random)', units: 'mg/dL', range: { min: 70, max: 140 }, groupId: bioGroup },
    { name: 'Serum Creatinine', units: 'mg/dL', range: { min: 0.6, max: 1.2 }, groupId: bioGroup },
    { name: 'Serum Urea', units: 'mg/dL', range: { min: 15, max: 45 }, groupId: bioGroup },
    { name: 'SGOT (AST)', units: 'U/L', range: { min: 5, max: 40 }, groupId: bioGroup },
    { name: 'SGPT (ALT)', units: 'U/L', range: { min: 5, max: 40 }, groupId: bioGroup },
    { name: 'Total Bilirubin', units: 'mg/dL', range: { min: 0.1, max: 1.2 }, groupId: bioGroup }
  ]

  for (const test of tests) {
    if (!test.groupId) continue;
    await prisma.hms_lab_test.upsert({
        where: {
            company_id_name: {
                company_id: activeCompanyId,
                name: test.name
            }
        },
        update: {
            units: test.units,
            reference_range: test.range as any,
            group_id: test.groupId
        },
        create: {
            tenant_id: activeTenantId,
            company_id: activeCompanyId,
            name: test.name,
            units: test.units,
            reference_range: test.range as any,
            group_id: test.groupId
        }
    })
  }

  console.log('Successfully seeded Analyzer tests!')
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
