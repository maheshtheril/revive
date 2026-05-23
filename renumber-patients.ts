
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = 'revivemedicity2025@gmail.com';
  console.log(`Starting re-numbering for: ${email}`);

  // 1. Find the user and tenant
  const user = await prisma.app_user.findFirst({
    where: { email },
    select: { tenant_id: true, company_id: true }
  });

  if (!user) {
    console.error('User not found');
    return;
  }

  const tenantId = user.tenant_id;
  const companyId = user.company_id;

  console.log(`Found Tenant ID: ${tenantId}, Company ID: ${companyId}`);

  // 2. Get the prefix from company metadata
  const company = await prisma.company.findUnique({
    where: { id: companyId || undefined },
    select: { metadata: true }
  });

  const meta = (company?.metadata as any) || {};
  const prefix = meta.patient_id_prefix || 'PAT';
  const startNumber = meta.patient_id_start_number || 10000;

  console.log(`Using Prefix: ${prefix}, Start Number: ${startNumber}`);

  // 3. Fetch all patients for this tenant, sorted by creation date
  const patients = await prisma.hms_patient.findMany({
    where: { tenant_id: tenantId },
    orderBy: { created_at: 'asc' },
    select: { id: true, first_name: true, patient_number: true }
  });

  console.log(`Found ${patients.length} patients to re-number.`);

  // 4. Update each patient
  let currentNumber = Number(startNumber);
  for (const patient of patients) {
    const newNumber = `${prefix}-${currentNumber}`;
    console.log(`Updating ${patient.first_name}: ${patient.patient_number} -> ${newNumber}`);
    
    await prisma.hms_patient.update({
      where: { id: patient.id },
      data: { patient_number: newNumber }
    });
    
    currentNumber++;
  }

  console.log('Re-numbering complete! 🚀');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
