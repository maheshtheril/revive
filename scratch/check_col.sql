SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'hms_clinicians' AND column_name = 'salutation';
