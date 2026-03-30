@echo off
set PAGER=
echo Altering hms_uom_category...
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d hms_db -c "ALTER TABLE hms_uom_category ALTER COLUMN id TYPE uuid USING (id::uuid);"
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d hms_db -c "ALTER TABLE hms_uom_category ALTER COLUMN tenant_id TYPE uuid USING (tenant_id::uuid);"
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d hms_db -c "ALTER TABLE hms_uom_category ALTER COLUMN company_id TYPE uuid USING (company_id::uuid);"
echo Altering hms_uom...
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d hms_db -c "ALTER TABLE hms_uom ALTER COLUMN id TYPE uuid USING (id::uuid);"
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d hms_db -c "ALTER TABLE hms_uom ALTER COLUMN tenant_id TYPE uuid USING (tenant_id::uuid);"
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d hms_db -c "ALTER TABLE hms_uom ALTER COLUMN company_id TYPE uuid USING (company_id::uuid);"
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d hms_db -c "ALTER TABLE hms_uom ALTER COLUMN category_id TYPE uuid USING (category_id::uuid);"
