@echo off
set PAGER=
echo Checking for duplicates in hms_uom_category:
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d hms_db -c "SELECT tenant_id, company_id, name, count(*) FROM hms_uom_category GROUP BY tenant_id, company_id, name HAVING count(*) > 1;"
echo Checking for duplicates in hms_uom:
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d hms_db -c "SELECT tenant_id, company_id, category_id, name, count(*) FROM hms_uom GROUP BY tenant_id, company_id, category_id, name HAVING count(*) > 1;"
