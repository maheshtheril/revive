import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function list() {
  const result: any[] = await prisma.$queryRaw`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'`
  console.log(result.map((r: any) => r.tablename).join(', '))
  await prisma.$disconnect()
}
list()
