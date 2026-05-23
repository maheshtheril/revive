const { Pool } = require('pg');

const run = async () => {
    const pool = new Pool({ connectionString: 'postgresql://postgres:hms2035@localhost:5432/hms_db' });

    try {
        const query = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `;
        const res = await pool.query(query);
        console.log(JSON.stringify(res.rows.map(r => r.table_name), null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
};

run();
