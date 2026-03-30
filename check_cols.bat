@echo off
set PAGER=
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d hms_db -c "\pset pager off" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'hms_uom_category';"
