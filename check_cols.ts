import { prisma } from './src/lib/prisma'

async function check() {
  try {
    const res = await (prisma as any).$queryRaw`SELECT mobile, country_id, subdivision_id FROM app_user LIMIT 1`;
    console.log("Columns exist!");
  } catch (e: any) {
    console.log("Error checking columns: " + e.message);
  }
}

check().then(() => process.exit(0));
