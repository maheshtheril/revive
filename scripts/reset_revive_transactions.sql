-- FINAL RESET TRANSACTION DATA FOR REVIVE MEDICITY (TENANT SCOPED)
-- TARGET: ALL OP BOOKINGS, BILLINGS, CLINICAL RECORDS, AND LAB ORDERS

BEGIN;

-- Verified ID for REVIVE MEDICITY HOSPITAL
-- Tenant ID: 4093885e-c22d-4d0b-8c3f-3b8d179caa2a

DELETE FROM hms_invoice WHERE tenant_id = '4093885e-c22d-4d0b-8c3f-3b8d179caa2a';
DELETE FROM payments WHERE tenant_id = '4093885e-c22d-4d0b-8c3f-3b8d179caa2a';
DELETE FROM hms_appointments WHERE tenant_id = '4093885e-c22d-4d0b-8c3f-3b8d179caa2a';
DELETE FROM prescription WHERE tenant_id = '4093885e-c22d-4d0b-8c3f-3b8d179caa2a';
DELETE FROM hms_lab_order WHERE tenant_id = '4093885e-c22d-4d0b-8c3f-3b8d179caa2a';

-- Clear Patient Specific Records (Using patient sub-query for safe scoping)
DELETE FROM doctor_note WHERE patient_id IN (SELECT id FROM hms_patient WHERE tenant_id = '4093885e-c22d-4d0b-8c3f-3b8d179caa2a');
DELETE FROM hms_vitals WHERE patient_id IN (SELECT id FROM hms_patient WHERE tenant_id = '4093885e-c22d-4d0b-8c3f-3b8d179caa2a');
DELETE FROM hms_medication_order WHERE patient_id IN (SELECT id FROM hms_patient WHERE tenant_id = '4093885e-c22d-4d0b-8c3f-3b8d179caa2a');

DELETE FROM hms_stock_ledger WHERE tenant_id = '4093885e-c22d-4d0b-8c3f-3b8d179caa2a';
DELETE FROM hms_stock_move WHERE tenant_id = '4093885e-c22d-4d0b-8c3f-3b8d179caa2a';

UPDATE hms_stock_levels SET quantity = 0, reserved = 0 WHERE tenant_id = '4093885e-c22d-4d0b-8c3f-3b8d179caa2a';
UPDATE hms_product_batch SET qty_on_hand = 0 WHERE tenant_id = '4093885e-c22d-4d0b-8c3f-3b8d179caa2a';

COMMIT;

-- VERIFICATION
SELECT 
    (SELECT count(*) FROM hms_invoice WHERE tenant_id = '4093885e-c22d-4d0b-8c3f-3b8d179caa2a') as remaining_invoices,
    (SELECT count(*) FROM hms_appointments WHERE tenant_id = '4093885e-c22d-4d0b-8c3f-3b8d179caa2a') as remaining_appointments;
