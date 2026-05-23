const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const lastApts = await prisma.hms_appointments.findMany({
    where: { token_number: { not: null } },
    orderBy: { created_at: 'desc' },
    take: 1,
    select: { token_number: true }
  })
  console.log('LAST_TOKEN:', lastApts[0]?.token_number)
}

main().catch(console.error).finally(() => prisma.$disconnect())
