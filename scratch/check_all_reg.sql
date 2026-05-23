SELECT p.name, p.price, p.is_service, t.name as tenant_name, t.email
FROM hms_product p 
JOIN "Tenant" t ON p.tenant_id = t.id 
WHERE p.name ILIKE '%Reg%';
