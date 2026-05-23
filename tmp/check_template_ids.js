const { Pool } = require('pg');
const run = async () => {
    const pool = new Pool({ connectionString: 'postgresql://postgres:hms2035@localhost:5432/hms_db' });
    try {
        const res = await pool.query("SELECT id, tenant_id, company_id, name, usage FROM hms_print_template WHERE id = '09223ee1-8609-49a5-aece-3501fbab982a'");
        console.log(JSON.stringify(res.rows[0], null, 2));
    } catch (e) {
        console.error(e);
    } finally { await pool.end(); }
};
run();
