const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:hms2035@localhost:5432/hms_db' });

const ZIONA_COMPANY_ID = '00000000-0000-0000-0000-000000000002';
const TENANT_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
    try {
        await client.connect();
        
        console.log('Generating History for Ziona Hospital...');

        // 1. Create a Location if not exists
        let locationId = '00000000-0000-0000-0000-000000000010'; // Fixed ID for test location
        await client.query(`
            INSERT INTO global_stock_location (id, tenant_id, company_id, name, is_active)
            VALUES ($1, $2, $3, 'Ziona Main Store', true)
            ON CONFLICT (id) DO NOTHING
        `, [locationId, TENANT_ID, ZIONA_COMPANY_ID]);

        // 2. Get the products we just created
        const products = await client.query('SELECT id, name, uom FROM hms_product WHERE company_id = $1', [ZIONA_COMPANY_ID]);

        if (products.rows.length === 0) {
            console.log('No products found in Ziona Hospital. Run the sync script first.');
            return;
        }

        const moveTypes = [
            { type: 'in', label: 'Initial Stock', qty: 100 },
            { type: 'out', label: 'Dispensed', qty: -5 },
            { type: 'receipt', label: 'Purchase P-101', qty: 50 },
            { type: 'sale', label: 'Sale INV-502', qty: -2 },
            { type: 'adjustment', label: 'Audit Correction', qty: 1 }
        ];

        for (const product of products.rows) {
            console.log(`Adding moves for ${product.name}...`);
            
            for (let i = 0; i < moveTypes.length; i++) {
                const move = moveTypes[i];
                // Offset date so they appear at different times
                const moveDate = new Date();
                moveDate.setHours(moveDate.getHours() - (i * 2)); 

                await client.query(`
                    INSERT INTO hms_stock_ledger (
                        id, tenant_id, company_id, product_id, movement_type, qty, uom, reference, to_location_id, created_at
                    ) VALUES (
                        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9
                    )
                `, [
                    TENANT_ID, ZIONA_COMPANY_ID, product.id, 
                    move.type, move.qty, product.uom, 
                    move.label, locationId, moveDate
                ]);
            }
        }

        console.log('\n--- SUCCESS ---');
        console.log(`Added ${products.rows.length * moveTypes.length} ledger entries.`);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();
