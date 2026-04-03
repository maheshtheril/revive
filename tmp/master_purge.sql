
-- ☢️ MASTER NUCLEAR PURGE SCRIPT (SQL)
-- DANGER: This will PERMANENTLY delete ALL Purchasing, Inventory, and Financial Ledger data.

-- 1. KILL SPECIFIC GHOST (GRN-2026-0001)
DELETE FROM "journal_entry_lines" WHERE "journal_entry_id" IN (SELECT "id" FROM "journal_entries" WHERE "ref" = 'GRN-2026-0001');
DELETE FROM "journal_entries" WHERE "ref" = 'GRN-2026-0001';
DELETE FROM "hms_purchase_receipt_line" WHERE "receipt_id" IN (SELECT "id" FROM "hms_purchase_receipt" WHERE "name" = 'GRN-2026-0001');
DELETE FROM "hms_purchase_receipt" WHERE "name" = 'GRN-2026-0001';

-- 2. TOTAL PURCHASING WIPE
TRUNCATE TABLE 
    "hms_purchase_return_line", 
    "hms_purchase_return", 
    "hms_purchase_invoice_line", 
    "hms_purchase_invoice", 
    "hms_purchase_receipt_line", 
    "hms_purchase_receipt" 
CASCADE;

-- 3. TOTAL INVENTORY WIPE
TRUNCATE TABLE 
    "hms_stock_ledger", 
    "hms_stock_levels", 
    "hms_product_batch", 
    "hms_stock_move" 
CASCADE;

-- 4. RESET PRODUCT COSTS 
UPDATE "hms_product" SET "default_cost" = 0, "price" = 0;

-- 5. TOTAL ACCOUNTING CLEAR
TRUNCATE TABLE 
    "hms_accounts_ledger", 
    "journal_entry_lines", 
    "journal_entries", 
    "journal_lines" 
CASCADE;
