require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL;
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TENANT_ID = '80831ccf-14f5-462f-a9d8-47ae2977a3fc';
const COMPANY_ID = '40e79ce1-d568-4acc-bbfc-2c879a8549a9';

async function main() {
  const dataPath = path.join(__dirname, '../medicines_batch_1.json');
  if (!fs.existsSync(dataPath)) {
    console.error(`Data file not found at ${dataPath}`);
    return;
  }
  const medicines = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  if (!TENANT_ID || !COMPANY_ID) {
    console.error('TENANT_ID or COMPANY_ID is missing!');
    return;
  }

  console.log(`Importing ${medicines.length} medicines...`);

  for (const med of medicines) {
    // Generate a simple SKU
    const sku = med.name.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase() + '-' + med.packing.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase();
    
    try {
      const existing = await prisma.hms_product.findFirst({
        where: {
          tenant_id: TENANT_ID,
          sku: sku
        }
      });

      if (!existing) {
        await prisma.hms_product.create({
          data: {
            tenant_id: TENANT_ID,
            company_id: COMPANY_ID,
            sku: sku,
            name: med.name,
            description: `${med.name} - Packing: ${med.packing}`,
            price: med.mrp,
            uom: med.packing,
            is_stockable: true,
            is_service: false,
            is_active: true
          }
        });
        console.log(`Inserted: ${med.name}`);
      } else {
        await prisma.hms_product.update({
          where: { id: existing.id },
          data: {
            price: med.mrp,
            uom: med.packing,
            description: `${med.name} - Packing: ${med.packing}`
          }
        });
        console.log(`Updated: ${med.name}`);
      }
    } catch (err) {
      console.error(`Error processing ${med.name}:`, err.message);
    }
  }

  console.log('Import completed.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
