@echo off
set PAGER=
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d hms_db -c "\pset pager off" -c "SELECT COUNT(*) FROM menu_items;"
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d hms_db -c "\pset pager off" -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'hms_db';"
