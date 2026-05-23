const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:hms2035@localhost:5432/hms_db' });
async function main() {
    try {
        await client.connect();
        console.log('--- RECENT PRODUCTS ---');
        const res = await client.query('SELECT name, sku, created_at FROM hms_product ORDER BY created_at DESC LIMIT 5');
        console.table(res.rows);
        
        console.log('\n--- RECENT STOCK LEDGER ENTRIES ---');
        const res2 = await client.query(`
            SELECT p.name, sl.movement_type, sl.qty, sl.created_at 
            FROM hms_product_stock_ledger sl 
            JOIN hms_product p ON sl.product_id = p.id 
            ORDER BY sl.created_at DESC LIMIT 5
        `);
        console.table(res2.rows);

        if (res2.rows.length > 0) {
            const lastDate = new Date(res2.rows[0].created_at);
            const fromDate = new Date(lastDate);
            fromDate.setDate(lastDate.getDate() - 30);
            console.log(`\nSuggested Filter Range: ${fromDate.toISOString().split('T')[0]} to ${lastDate.toISOString().split('T')[0]}`);
        } else {
            console.log('\nNo stock movements found. Suggested date range: 2026-04-01 to 2026-05-11');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();
