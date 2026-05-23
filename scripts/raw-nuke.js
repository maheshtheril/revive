const { Client } = require('pg');

async function fix() {
    const client = new Client({ connectionString: 'postgresql://postgres:hms2035@localhost:5432/hms_db' });
    await client.connect();
    
    console.log("Connected to DB...");
    const res = await client.query("SELECT id, name, usage, company_id, is_default, config FROM hms_print_template WHERE usage = 'sale_bill'");
    console.log("Found templates:", res.rows.length);

    let updated = 0;
    for (const row of res.rows) {
        if (!row.config) continue;
        let str = typeof row.config === 'string' ? row.config : JSON.stringify(row.config);
        
        if (str.toLowerCase().includes('payable') || str.toLowerCase().includes('final payable')) {
             console.log(`[!] FOUND 'PAYABLE' IN TEMPLATE ID: ${row.id} (Company: ${row.company_id})`);
             
             str = str.replace(/Final Payable/gi, "GRAND TOTAL")
                      .replace(/FINAL PAYABLE/g, "GRAND TOTAL")
                      .replace(/Payable/gi, "Total")
                      .replace(/PAYABLE/g, "TOTAL");
             
             await client.query("UPDATE hms_print_template SET config = $1 WHERE id = $2", [JSON.parse(str), row.id]);
             updated++;
             console.log("   > NUKED!");
        }
    }
    
    console.log(`\n=== NUCLEAR OVERRIDE COMPLETE: ${updated} TEMPLATES FIXED ===`);
    await client.end();
}

fix().catch(console.error);
