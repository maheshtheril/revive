const { PrismaClient } = require('@prisma/client')
// Hardcoded common HMS URL for scratch purposes if env is missing
const url = process.env.DATABASE_URL || 'postgresql://postgres:hms2035@localhost:5432/hms_db'
const prisma = new PrismaClient({
  datasources: {
    db: { url }
  }
})

async function main() {
  const lastApts = await prisma.hms_appointments.findMany({
    where: { token_number: { not: null } },
    orderBy: { created_at: 'desc' },
    take: 5,
    select: { token_number: true, created_at: true, clinician_id: true }
  })
  console.log('LAST TOKENS:', JSON.stringify(lastApts, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
