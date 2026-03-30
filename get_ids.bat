@echo off
set PAGER=
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d hms_db -c "\pset pager off" -c "SELECT id, name FROM tenant;"
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d hms_db -c "\pset pager off" -c "SELECT id, tenant_id, name FROM company;"
