@echo off
setlocal enabledelayedexpansion
title ZIONA HMS - DIRECT DATABASE FIX (ROBUST VERSION)
color 0B

echo ===================================================
echo   ZIONA HMS - FORCE DATABASE MENU RECOVERY
echo ===================================================
echo.

:: 1. FIND PSQL
set PSQL_PATH=psql
if not exist "!PSQL_PATH!.exe" (
    echo Searching for PostgreSQL installation...
    for /d %%d in ("C:\Program Files\PostgreSQL\*") do (
        if exist "%%d\bin\psql.exe" (
            set PSQL_PATH="%%d\bin\psql.exe"
            echo   Found at !PSQL_PATH!
        )
    )
)

:: 2. DATABASE URL CHECK
if "%DATABASE_URL%" == "" (
    set DATABASE_URL="postgresql://postgres:hms2035@localhost:5432/hms_db"
)

echo.
echo [1/3] Recovering Module Structure...
!PSQL_PATH! %DATABASE_URL% -c "UPDATE modules SET is_active = true, name = 'Inventory & Procurement' WHERE module_key = 'inventory';"
!PSQL_PATH! %DATABASE_URL% -c "UPDATE modules SET is_active = true, name = 'Hospital' WHERE module_key = 'hms';"
!PSQL_PATH! %DATABASE_URL% -c "UPDATE modules SET is_active = true, name = 'Gateway of Tally' WHERE module_key = 'finance';"

echo [2/3] Force-Enabling Inventory for All Tenants...
!PSQL_PATH! %DATABASE_URL% -c "INSERT INTO tenant_module (id, tenant_id, module_key, enabled, created_at, updated_at) SELECT gen_random_uuid(), id, 'inventory', true, now(), now() FROM tenant ON CONFLICT (tenant_id, module_key) DO UPDATE SET enabled = true;"

echo [3/3] Restoring Procurement Menus (Global Mode)...
!PSQL_PATH! %DATABASE_URL% -c "DELETE FROM menu_items WHERE key IN ('inv-procurement', 'inv-suppliers', 'inv-po', 'inv-receipts', 'inv-returns');"
!PSQL_PATH! %DATABASE_URL% -c "INSERT INTO menu_items (id, label, url, key, module_key, icon, sort_order, is_global, permission_code) VALUES (gen_random_uuid(), 'Procurement', '#', 'inv-procurement', 'inventory', 'ShoppingCart', 15, true, NULL);"
!PSQL_PATH! %DATABASE_URL% -c "INSERT INTO menu_items (id, label, url, key, module_key, icon, parent_id, sort_order, is_global, permission_code) SELECT gen_random_uuid(), 'Suppliers', '/hms/purchasing/suppliers', 'inv-suppliers', 'inventory', 'Truck', id, 10, true, NULL FROM menu_items WHERE key = 'inv-procurement';"
!PSQL_PATH! %DATABASE_URL% -c "INSERT INTO menu_items (id, label, url, key, module_key, icon, parent_id, sort_order, is_global, permission_code) SELECT gen_random_uuid(), 'Purchase Orders', '/hms/purchasing/orders', 'inv-po', 'inventory', 'FileText', id, 20, true, NULL FROM menu_items WHERE key = 'inv-procurement';"
!PSQL_PATH! %DATABASE_URL% -c "INSERT INTO menu_items (id, label, url, key, module_key, icon, parent_id, sort_order, is_global, permission_code) SELECT gen_random_uuid(), 'Goods Receipts', '/hms/purchasing/receipts', 'inv-receipts', 'inventory', 'ClipboardList', id, 30, true, NULL FROM menu_items WHERE key = 'inv-procurement';"
!PSQL_PATH! %DATABASE_URL% -c "INSERT INTO menu_items (id, label, url, key, module_key, icon, parent_id, sort_order, is_global, permission_code) SELECT gen_random_uuid(), 'Purchase Returns', '/hms/purchasing/returns', 'inv-returns', 'inventory', 'Undo2', id, 40, true, NULL FROM menu_items WHERE key = 'inv-procurement';"

echo.
echo ===================================================
echo   SUCCESS: Database Menus Restored!
echo   1. Log out of the ERP.
echo   2. Log back in (Admin user).
echo   3. Everything should be visible now.
echo ===================================================
pause
