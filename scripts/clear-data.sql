-- 1. CLEAR FINANCIAL DATA (Dependent tables first)
DELETE FROM hms_payment_allocations;
DELETE FROM hms_payment_transaction;
DELETE FROM hms_invoice_item;
DELETE FROM hms_invoice;
DELETE FROM hms_accounting_voucher_item;
DELETE FROM hms_accounting_voucher;

-- 2. CLEAR PURCHASING & INVENTORY
DELETE FROM hms_stock_ledger_entry;
DELETE FROM hms_purchase_bill_item;
DELETE FROM hms_purchase_bill;
DELETE FROM hms_purchase_order_item;
DELETE FROM hms_purchase_order;

-- 3. CLEAR CLINICAL DATA
DELETE FROM hms_lab_result;
DELETE FROM hms_lab_order_line;
DELETE FROM hms_lab_order_lines;
DELETE FROM hms_lab_order;
DELETE FROM hms_medication_administration;
DELETE FROM hms_medication_order;
DELETE FROM hms_prescription_items;
DELETE FROM hms_prescription;
DELETE FROM hms_vital_reading;
DELETE FROM hms_vital_sign;

-- 4. CLEAR PATIENTS & APPOINTMENTS
DELETE FROM hms_appointments;
DELETE FROM hms_patient;

-- 5. CLEAR OTHER TRANSACTIONAL RAILS
DELETE FROM hms_outbox;
