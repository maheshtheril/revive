const { Pool } = require('pg');

const run = async () => {
    const pool = new Pool({ connectionString: 'postgresql://postgres:hms2035@localhost:5432/hms_db' });

    try {
        const query = `
            SELECT id, name, usage, is_default, updated_at, config->'coordinates' AS coordinates 
            FROM hms_invoice_printer_config 
            WHERE usage = 'sale_bill' 
            ORDER BY updated_at DESC 
            LIMIT 1
        `;
        const res = await pool.query(query);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
};

run();
