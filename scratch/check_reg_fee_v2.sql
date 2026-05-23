SELECT p.name, p.price, p.is_service, t.name as tenant_name 
FROM hms_product p 
JOIN tenant t ON p.tenant_id = t.id 
WHERE t.email = 'revivemedicity2025@gmail.com' 
AND p.name ILIKE '%Reg%';
