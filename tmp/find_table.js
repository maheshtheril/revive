const { Pool } = require('pg');
const run = async () => {
    const pool = new Pool({ connectionString: 'postgresql://postgres:hms2035@localhost:5432/hms_db' });
    try {
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%config%'");
        console.log(res.rows);
        const res2 = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%hms_inv%'");
        console.log(res2.rows);
    } finally { await pool.end(); }
};
run();
