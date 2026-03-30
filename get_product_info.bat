@echo off
set PAGER=
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d hms_db -c "\pset pager off" -c "\d hms_product" > product_info.txt
type product_info.txt
