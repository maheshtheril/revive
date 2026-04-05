INSERT INTO hms_product_category (id, tenant_id, company_id, name)
SELECT gen_random_uuid(), tenant_id, id, 'Pharmacy' FROM company
WHERE NOT EXISTS (SELECT 1 FROM hms_product_category WHERE name = 'Pharmacy' AND company_id = company.id);

INSERT INTO hms_product_category (id, tenant_id, company_id, name)
SELECT gen_random_uuid(), tenant_id, id, 'Surgical' FROM company
WHERE NOT EXISTS (SELECT 1 FROM hms_product_category WHERE name = 'Surgical' AND company_id = company.id);

INSERT INTO hms_product_category (id, tenant_id, company_id, name)
SELECT gen_random_uuid(), tenant_id, id, 'Lab Service' FROM company
WHERE NOT EXISTS (SELECT 1 FROM hms_product_category WHERE name = 'Lab Service' AND company_id = company.id);

INSERT INTO hms_product_category (id, tenant_id, company_id, name)
SELECT gen_random_uuid(), tenant_id, id, 'Medical Services' FROM company
WHERE NOT EXISTS (SELECT 1 FROM hms_product_category WHERE name = 'Medical Services' AND company_id = company.id);

INSERT INTO hms_product_category (id, tenant_id, company_id, name)
SELECT gen_random_uuid(), tenant_id, id, 'Registration Fee' FROM company
WHERE NOT EXISTS (SELECT 1 FROM hms_product_category WHERE name = 'Registration Fee' AND company_id = company.id);
