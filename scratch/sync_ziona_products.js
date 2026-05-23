const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:hms2035@localhost:5432/hms_db' });

const ZIONA_COMPANY_ID = '00000000-0000-0000-0000-000000000002';
const GLOBAL_COMPANY_ID = 'd19cd294-cec2-43a8-a953-376938132323';
const TENANT_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
    try {
        await client.connect();
        
        console.log('Cloning items for Ziona Hospital...');
        
        // 1. Get 10 sample items from Global Medicare
        const res = await client.query(`
            SELECT name, sku, description, price, uom, currency 
            FROM hms_product 
            WHERE company_id = $1 
            LIMIT 10
        `, [GLOBAL_COMPANY_ID]);

        if (res.rows.length === 0) {
            console.log('No source products found in Global Medicare.');
            return;
        }

        for (const item of res.rows) {
            const newSku = `${item.sku}-Z`; // Append -Z to avoid SKU conflict in the same tenant
            
            try {
                await client.query(`
                    INSERT INTO hms_product (
                        id, tenant_id, company_id, name, sku, description, price, uom, currency, is_active, is_stockable
                    ) VALUES (
                        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, true, true
                    ) ON CONFLICT DO NOTHING
                `, [TENANT_ID, ZIONA_COMPANY_ID, item.name, newSku, item.description, item.price, item.uom, item.currency]);
                
                console.log(`Cloned: ${item.name} as ${newSku}`);
            } catch (err) {
                console.error(`Failed to clone ${item.name}:`, err.message);
            }
        }

        console.log('\n--- VERIFICATION ---');
        const check = await client.query('SELECT name, sku FROM hms_product WHERE company_id = $1', [ZIONA_COMPANY_ID]);
        console.table(check.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();
