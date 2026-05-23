import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const encounter = await prisma.hms_encounter.findFirst({
    where: { status: 'active' },
    select: { id: true, patient_id: true }
  });
  console.log("Recent Encounter:", JSON.stringify(encounter, null, 2));
  await prisma.$disconnect();
}

main();
