const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:hms2035@localhost:5432/hms_db' });
async function main() {
    try {
        await client.connect();
        const res = await client.query('SELECT tenant_id, company_id, COUNT(*) FROM hms_product GROUP BY tenant_id, company_id');
        console.log('Product Groups:', res.rows);
        
        const res2 = await client.query('SELECT tenant_id, company_id, email FROM app_user LIMIT 1');
        console.log('Active User Context:', res2.rows[0]);
        
        const res3 = await client.query('SELECT COUNT(*) FROM hms_product_batch');
        console.log('Total Product Batches:', res3.rows[0].count);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();
