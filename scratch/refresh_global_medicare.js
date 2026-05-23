const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:hms2035@localhost:5432/hms_db' });

const GLOBAL_ID = 'd19cd294-cec2-43a8-a953-376938132323';
const ZIONA_ID = '00000000-0000-0000-0000-000000000002';

async function main() {
    try {
        await client.connect();
        
        // 1. Update existing Global Medicare entries to NOW
        await client.query('UPDATE hms_stock_ledger SET created_at = NOW() WHERE company_id = $1', [GLOBAL_ID]);
        
        // 2. Clone Ziona entries to Global Medicare
        await client.query(`
            INSERT INTO hms_stock_ledger (id, tenant_id, company_id, product_id, movement_type, qty, uom, reference, created_at)
            SELECT gen_random_uuid(), tenant_id, $1, product_id, movement_type, qty, uom, reference, NOW() 
            FROM hms_stock_ledger 
            WHERE company_id = $2
        `, [GLOBAL_ID, ZIONA_ID]);
        
        console.log('Global Medicare data successfully refreshed.');
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();
