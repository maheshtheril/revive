@echo off
set PAGER=
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d hms_db -c "\pset pager off" -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'hms_uom_category';"
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d hms_db -c "\pset pager off" -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'hms_uom';"
