@echo off
set PAGER=
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d hms_db -c "\pset pager off" -c "SELECT id, name, created_at FROM tenant ORDER BY created_at DESC LIMIT 5;"
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d hms_db -c "\pset pager off" -c "SELECT id, tenant_id, name, created_at FROM company ORDER BY created_at DESC LIMIT 5;"
