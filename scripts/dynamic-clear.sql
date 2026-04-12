DO $$ 
DECLARE 
    r RECORD; 
BEGIN 
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename LIKE 'hms_%' 
          -- PRESERVE CONFIGURATION TABLES
          AND tablename NOT IN (
            'hms_module', 
            'hms_permission', 
            'hms_role', 
            'hms_role_permission', 
            'hms_product', 
            'hms_category', 
            'hms_uom', 
            'hms_doctor', 
            'hms_department', 
            'hms_hospital'
          )
    ) LOOP 
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE'; 
    END LOOP; 
END $$;
