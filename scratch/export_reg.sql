COPY (
    SELECT p.name, p.price, t.name as tenant, t.email
    FROM hms_product p 
    JOIN "Tenant" t ON p.tenant_id = t.id 
    WHERE p.name ILIKE '%Reg%'
) TO 'c:\2035-HMS\SAAS_ERP\scratch\reg_products.csv' WITH CSV HEADER;
