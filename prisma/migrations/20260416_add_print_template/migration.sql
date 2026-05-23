-- Fix: Ensure company_id is NOT NULL so the UNIQUE constraint works correctly.
-- NULL != NULL in PostgreSQL, so any row with company_id = NULL bypasses the unique check.

-- Step 1: Fill in any existing NULLs using tenant's main company
UPDATE hms_print_template t
SET company_id = (
    SELECT c.id FROM company c WHERE c.tenant_id = t.tenant_id LIMIT 1
)
WHERE t.company_id IS NULL;

-- Step 2: Make company_id NOT NULL
ALTER TABLE hms_print_template
    ALTER COLUMN company_id SET NOT NULL;

-- Step 3: Purge duplicates BEFORE adding constraint
-- Keep the row with the highest updated_at for each (tenant, company, name, usage) group
DELETE FROM hms_print_template a
USING hms_print_template b
WHERE a.tenant_id   = b.tenant_id
  AND a.company_id  = b.company_id
  AND lower(a.name) = lower(b.name)
  AND a.usage       = b.usage
  AND a.id          <> b.id
  AND a.updated_at  < b.updated_at;

-- Also clean up ties (same updated_at) by keeping highest id alphabetically
DELETE FROM hms_print_template a
USING hms_print_template b
WHERE a.tenant_id   = b.tenant_id
  AND a.company_id  = b.company_id
  AND lower(a.name) = lower(b.name)
  AND a.usage       = b.usage
  AND a.id          <> b.id
  AND a.id          < b.id;

-- Step 4: Drop old constraint, add clean one (non-case-sensitive via expression is better)
ALTER TABLE hms_print_template
    DROP CONSTRAINT IF EXISTS uq_hms_print_template_branch_lock;

ALTER TABLE hms_print_template
    ADD CONSTRAINT uq_hms_print_template_branch_lock
    UNIQUE (tenant_id, company_id, name, usage);
