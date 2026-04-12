-- SURGICAL CLEANUP USING TRUNCATE CASCADE
TRUNCATE TABLE 
    hms_invoice,
    hms_payment_transaction,
    hms_accounting_voucher,
    hms_stock_ledger_entry,
    hms_purchase_bill,
    hms_purchase_order,
    hms_lab_order,
    hms_prescription,
    hms_vital_sign,
    hms_appointments,
    hms_patient,
    hms_outbox
CASCADE;
