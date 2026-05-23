const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:hms2035@localhost:5432/hms_db' });

async function check() {
    await client.connect();
    console.log('--- TENANTS ---');
    const tenants = await client.query('SELECT id, slug, name FROM tenant');
    console.table(tenants.rows);

    console.log('--- USERS ---');
    const users = await client.query('SELECT email, "tenantId", "companyId" FROM app_user');
    console.table(users.rows);

    console.log('--- PATIENT DATA PER TENANT ---');
    const patients = await client.query('SELECT tenant_id, count(*) FROM hms_patient GROUP BY tenant_id');
    console.table(patients.rows);

    console.log('--- PRODUCT DATA PER TENANT ---');
    const products = await client.query('SELECT tenant_id, count(*) FROM hms_product GROUP BY tenant_id');
    console.table(products.rows);

    await client.end();
}

check();
