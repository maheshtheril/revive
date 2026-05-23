-- NUCLEAR CLINICAL WIPE (The Easy Way)
TRUNCATE 
    hms_invoice, 
    prescription, 
    hms_stock_move, 
    hms_stock_ledger, 
    hms_vitals, 
    hms_lab_order 
CASCADE;

-- Reset Stock Levels
UPDATE hms_stock_levels SET quantity = 0;

-- Reset Appointment Status
UPDATE hms_appointments SET status = 'scheduled';
