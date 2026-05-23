const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:hms2035@localhost:5432/hms_db' });

const ZIONA_COMPANY_ID = '00000000-0000-0000-0000-000000000002';

async function main() {
    try {
        await client.connect();
        
        console.log('--- CHECKING ZIONA DATA ---');
        
        const res1 = await client.query('SELECT COUNT(*) FROM hms_product WHERE company_id = $1', [ZIONA_COMPANY_ID]);
        console.log('Ziona Product Count:', res1.rows[0].count);

        const res2 = await client.query('SELECT COUNT(*) FROM hms_stock_ledger WHERE company_id = $1', [ZIONA_COMPANY_ID]);
        console.log('Ziona Ledger Count:', res2.rows[0].count);

        const res3 = await client.query(`
            SELECT sl.movement_type, sl.qty, sl.created_at, p.name 
            FROM hms_stock_ledger sl 
            JOIN hms_product p ON sl.product_id = p.id 
            WHERE sl.company_id = $1 
            LIMIT 5
        `, [ZIONA_COMPANY_ID]);
        console.table(res3.rows);

        const res4 = await client.query('SELECT id, name FROM company');
        console.log('\n--- ALL COMPANIES ---');
        console.table(res4.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();
