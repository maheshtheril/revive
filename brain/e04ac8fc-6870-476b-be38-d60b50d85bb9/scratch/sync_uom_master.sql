-- [SERIOUS-DATABASE-MIGRATION] 
-- Copy UOM Master from Global Medicare to Revive Medicity

DO $$
DECLARE
    source_company_id UUID := 'd19cd294-cec2-43a8-a953-376938132323';
    target_company_id UUID := '6f7514ce-4b63-4ed9-a59e-c6e7cb1b2f57';
    target_tenant_id UUID := '4093885e-c22d-4d0b-8c3f-3b8d179caa2a';
BEGIN
    -- 1. Sync Categories
    INSERT INTO hms_uom_category (id, tenant_id, company_id, name, created_at)
    SELECT gen_random_uuid(), target_tenant_id, target_company_id, name, NOW()
    FROM hms_uom_category
    WHERE company_id = source_company_id
    ON CONFLICT (tenant_id, company_id, name) DO NOTHING;

    -- 2. Sync UOMs
    INSERT INTO hms_uom (id, tenant_id, company_id, category_id, name, uom_type, ratio, rounding, is_active, created_at)
    SELECT 
        gen_random_uuid(), 
        target_tenant_id, 
        target_company_id,
        (SELECT id FROM hms_uom_category WHERE company_id = target_company_id AND name = (SELECT name FROM hms_uom_category WHERE id = sc.category_id)),
        sc.name,
        sc.uom_type,
        sc.ratio,
        sc.rounding,
        sc.is_active,
        NOW()
    FROM hms_uom sc
    WHERE sc.company_id = source_company_id
    ON CONFLICT (tenant_id, company_id, category_id, name) DO NOTHING;

    -- 3. Repair Product Links
    UPDATE hms_product p
    SET uom_id = (SELECT id FROM hms_uom WHERE company_id = target_company_id AND name = p.uom)
    WHERE company_id = target_company_id
    AND uom_id IS NULL;

    RAISE NOTICE 'UOM Master Synced and Product Links Repaired.';
END $$;
