@echo off
set PAGER=
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d hms_db -c "\pset pager off" -c "\d tenant_module" > tenant_module_info.txt
type tenant_module_info.txt
