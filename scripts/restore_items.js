const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const client = new Client({ connectionString: 'postgresql://postgres:hms2035@localhost:5432/hms_db', ssl: false });

const TENANT_ID = '41537389-7316-4a86-97a3-de21ff9833f7';
const COMPANY_ID = '4bdc907d-d960-4ab5-8a8b-17ffb71b07d8';
const LOCATION_ID = 'c1bc0cf9-a4c5-4f4a-acb3-8494f8c38958'; // Main Warehouse

async function main() {
    const dataPath = path.join(__dirname, '../medicines_batch_1.json');
    if (!fs.existsSync(dataPath)) {
        console.error(`Data file not found at ${dataPath}`);
        return;
    }
    const medicines = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    try {
        await client.connect();
        console.log(`Restoring ${medicines.length} medicines for Tenant: ${TENANT_ID}...`);

        for (const med of medicines) {
            const sku = med.name.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase() + '-' + med.packing.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase();
            
            // 1. Check or Insert Product
            const checkRes = await client.query('SELECT id FROM hms_product WHERE tenant_id = $1 AND sku = $2', [TENANT_ID, sku]);
            
            let productId;
            if (checkRes.rows.length === 0) {
                productId = crypto.randomUUID();
                await client.query(
                    'INSERT INTO hms_product (id, tenant_id, company_id, sku, name, description, price, uom, is_stockable, is_service, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                    [productId, TENANT_ID, COMPANY_ID, sku, med.name, `${med.name} - ${med.packing}`, med.mrp, med.packing, true, false, true]
                );
                console.log(`Inserted Product: ${med.name}`);
            } else {
                productId = checkRes.rows[0].id;
                await client.query(
                    'UPDATE hms_product SET price = $1, uom = $2, is_active = true WHERE id = $3',
                    [med.mrp, med.packing, productId]
                );
                console.log(`Updated Product: ${med.name}`);
            }

            // 2. Create Batch
            const batchId = crypto.randomUUID();
            const batchNo = 'BAT-' + Math.random().toString(36).substring(2, 8).toUpperCase();
            
            const batchCheck = await client.query('SELECT id FROM hms_product_batch WHERE product_id = $1 AND company_id = $2', [productId, COMPANY_ID]);
            
            if (batchCheck.rows.length === 0) {
                await client.query(
                    'INSERT INTO hms_product_batch (id, tenant_id, company_id, product_id, batch_no, expiry_date, qty_on_hand, mrp, cost) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                    [batchId, TENANT_ID, COMPANY_ID, productId, batchNo, new Date('2028-12-31'), 1000, med.mrp, med.mrp * 0.7]
                );
                
                // 3. Update Stock Levels
                // Note: hms_stock_levels unique constraint is (tenant_id, company_id, product_id, batch_id, location_id)
                await client.query(
                    'INSERT INTO hms_stock_levels (id, tenant_id, company_id, product_id, batch_id, location_id, quantity) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [crypto.randomUUID(), TENANT_ID, COMPANY_ID, productId, batchId, LOCATION_ID, 1000]
                );
            }
        }

        console.log('Restoration completed. Items should now be visible in HMS.');
    } catch (err) {
        console.error('Restoration failed:', err);
    } finally {
        await client.end();
    }
}

main();
