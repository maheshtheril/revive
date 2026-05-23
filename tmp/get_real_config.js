const { Pool } = require('pg');
const run = async () => {
    const pool = new Pool({ connectionString: 'postgresql://postgres:hms2035@localhost:5432/hms_db' });
    try {
        const res = await pool.query("SELECT id, name, usage, is_active, config FROM hms_print_template WHERE usage = 'sale_bill' ORDER BY updated_at DESC LIMIT 1");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally { await pool.end(); }
};
run();
