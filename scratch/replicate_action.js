const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:hms2035@localhost:5432/hms_db' });

const ZIONA_COMPANY_ID = '00000000-0000-0000-0000-000000000002';

async function main() {
    try {
        await client.connect();
        
        const query = ''; // Empty query to see everything
        const today = new Date().toISOString().split('T')[0];
        const from = new Date(today);
        from.setUTCHours(0, 0, 0, 0);
        const to = new Date(today);
        to.setUTCHours(23, 59, 59, 999);

        console.log('--- REPLICATING ACTION LOGIC ---');
        console.log('Company:', ZIONA_COMPANY_ID);
        console.log('Date Filter:', from.toISOString(), 'to', to.toISOString());

        const sql = `
            SELECT sl.*, p.name as product_name, p.sku 
            FROM hms_stock_ledger sl
            LEFT JOIN hms_product p ON sl.product_id = p.id
            WHERE sl.company_id = $1
            AND sl.created_at >= $2
            AND sl.created_at <= $3
            ORDER BY sl.created_at DESC
        `;

        const res = await client.query(sql, [ZIONA_COMPANY_ID, from, to]);
        console.log('Results Found:', res.rows.length);
        
        if (res.rows.length > 0) {
            console.log('First Item:', res.rows[0].product_name, 'at', res.rows[0].created_at);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();
