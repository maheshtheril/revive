const { Client } = require('pg');
const client = new Client({
  connectionString: "postgresql://postgres:hms2035@localhost:5432/hms_db"
});

async function migrate() {
  await client.connect();
  console.log('Migrating hms_clinicians columns to JSONB...');
  
  await client.query(`
    DO $$ 
    BEGIN
        -- Migrate document_urls
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'hms_clinicians' 
            AND column_name = 'document_urls' 
            AND data_type = 'ARRAY'
        ) THEN
            ALTER TABLE hms_clinicians 
            ALTER COLUMN document_urls 
            SET DATA TYPE jsonb 
            USING to_jsonb(document_urls);
            
            ALTER TABLE hms_clinicians 
            ALTER COLUMN document_urls 
            SET DEFAULT '[]'::jsonb;
            
            RAISE NOTICE 'Converted document_urls to JSONB';
        END IF;

        -- Migrate working_days
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'hms_clinicians' 
            AND column_name = 'working_days' 
            AND data_type = 'ARRAY'
        ) THEN
            ALTER TABLE hms_clinicians 
            ALTER COLUMN working_days 
            SET DATA TYPE jsonb 
            USING to_jsonb(working_days);
            
            ALTER TABLE hms_clinicians 
            ALTER COLUMN working_days 
            SET DEFAULT '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]'::jsonb;
            
            RAISE NOTICE 'Converted working_days to JSONB';
        END IF;
    END $$;
  `);

  console.log('Migration completed successfully.');
  await client.end();
}

migrate().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
