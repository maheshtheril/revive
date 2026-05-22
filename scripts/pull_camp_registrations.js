const { Client } = require('pg');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env file
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
} else {
    console.error('[ERROR] .env file not found.');
    process.exit(1);
}

const localDbUrl = process.env.DATABASE_URL;
const cloudDbUrl = process.env.CLOUD_DATABASE_URL;

if (!localDbUrl || !cloudDbUrl) {
    console.error('[ERROR] DATABASE_URL or CLOUD_DATABASE_URL is not set in environment variables.');
    process.exit(1);
}

// Helper to normalized phone strings
function normalizePhone(phone) {
    if (!phone) return '';
    return phone.replace(/\s+/g, '').replace(/[-()]/g, '');
}

async function getNextPatientNumber(client, companyId, tenantId) {
    try {
        const resComp = await client.query('SELECT metadata FROM company WHERE id = $1', [companyId || tenantId]);
        const companyData = resComp.rows[0];
        const meta = companyData?.metadata || {};
        
        const prefix = meta.patient_id_prefix || 'PAT';
        const mode = meta.patient_id_mode || 'timestamp';
        const startNumber = Number(meta.patient_id_start_number) || 1000;

        if (mode === 'sequential') {
            const resPatient = await client.query(
                `SELECT patient_number FROM hms_patient 
                 WHERE (company_id = $1 OR tenant_id = $2) AND patient_number LIKE $3 
                 ORDER BY created_at DESC LIMIT 1`,
                [companyId, tenantId, `${prefix}-%`]
            );
            const lastPatient = resPatient.rows[0];

            let nextSeq = startNumber;
            if (lastPatient?.patient_number) {
                const parts = lastPatient.patient_number.split('-');
                const lastSeqStr = parts[parts.length - 1];
                const lastSeq = parseInt(lastSeqStr, 10);
                if (!isNaN(lastSeq)) {
                    nextSeq = Math.max(lastSeq + 1, startNumber);
                }
            }
            return `${prefix}-${nextSeq}`;
        }

        // Default timestamp mode
        return `${prefix}-${Date.now().toString().slice(-6)}`;
    } catch (err) {
        console.error('[ERROR] Failed to generate next patient number:', err.message);
        throw err;
    }
}

async function run() {
    console.log('\n=========================================');
    console.log('   ZIONA HMS - CAMP REGISTRATION SYNC');
    console.log('=========================================\n');

    console.log('Connecting to databases...');
    
    // Connect to Cloud DB
    const cloudClient = new Client({
        connectionString: cloudDbUrl,
        ssl: { rejectUnauthorized: false }
    });

    // Connect to Local DB
    const localClient = new Client({
        connectionString: localDbUrl
    });

    try {
        await cloudClient.connect();
        await cloudClient.query('SET search_path TO public');
        console.log('[SUCCESS] Connected to Cloud Database (Neon).');

        await localClient.connect();
        await localClient.query('SET search_path TO public');
        console.log('[SUCCESS] Connected to Local Database.');

        // 1. Fetch pending sync patients from Cloud DB
        console.log('\nFetching pending registrations from Cloud...');
        const resPending = await cloudClient.query(
            `SELECT * FROM hms_patient 
             WHERE status = 'pending_sync' AND source_system = 'camp_cloud'`
        );

        const pendingPatients = resPending.rows;
        console.log(`Found ${pendingPatients.length} pending registration(s).`);

        if (pendingPatients.length === 0) {
            console.log('No new camp registrations to pull.');
            return;
        }

        let pulledCount = 0;
        let skippedCount = 0;

        // 2. Loop and sync each patient
        for (const patient of pendingPatients) {
            console.log(`\nProcessing patient: ${patient.first_name} ${patient.last_name || ''}`);

            const phone = patient.contact?.phone;
            const email = patient.contact?.email;

            // Check if patient ID already exists locally
            const resIdCheck = await localClient.query(
                `SELECT id, patient_number FROM hms_patient WHERE id = $1`,
                [patient.id]
            );

            if (resIdCheck.rows.length > 0) {
                console.log(`[SKIP] Patient with ID ${patient.id} already exists locally (Patient Number: ${resIdCheck.rows[0].patient_number}).`);
                skippedCount++;
                continue;
            }

            // Check by phone number or email if they exist locally
            let duplicateFound = false;
            if (phone) {
                const normPhone = normalizePhone(phone);
                const resPhoneCheck = await localClient.query(
                    `SELECT id, first_name, last_name, patient_number FROM hms_patient 
                     WHERE replace(replace(replace(contact->>'phone', ' ', ''), '-', ''), '(', '') LIKE $1`,
                    [`%${normPhone}%`]
                );
                
                if (resPhoneCheck.rows.length > 0) {
                    const dup = resPhoneCheck.rows[0];
                    console.log(`[DUPLICATE] Patient with phone ${phone} already exists locally: ${dup.first_name} ${dup.last_name || ''} (ID: ${dup.patient_number}).`);
                    duplicateFound = true;
                }
            }

            if (!duplicateFound && email) {
                const resEmailCheck = await localClient.query(
                    `SELECT id, first_name, last_name, patient_number FROM hms_patient 
                     WHERE contact->>'email' = $1`,
                    [email.trim()]
                );

                if (resEmailCheck.rows.length > 0) {
                    const dup = resEmailCheck.rows[0];
                    console.log(`[DUPLICATE] Patient with email ${email} already exists locally: ${dup.first_name} ${dup.last_name || ''} (ID: ${dup.patient_number}).`);
                    duplicateFound = true;
                }
            }

            if (duplicateFound) {
                // If it is a duplicate locally, we don't insert it again, but we will still clear it from cloud pending status 
                // in standard synchronization (or we can delete/mark it locally synced so it updates).
                // For now, skip local insertion.
                skippedCount++;
                continue;
            }

            // 3. Generate Patient Number locally
            const nextPatientNum = await getNextPatientNumber(localClient, patient.company_id, patient.tenant_id);
            console.log(`Assigning local sequence ID: ${nextPatientNum}`);

            // Update metadata to show it was synced and when
            const updatedMetadata = {
                ...(patient.metadata || {}),
                synced_at: new Date().toISOString(),
                original_status_cloud: patient.status
            };

            // 4. Insert locally
            await localClient.query(
                `INSERT INTO hms_patient (
                    id, tenant_id, company_id, patient_number, first_name, last_name, 
                    dob, gender, contact, metadata, created_by, created_at, updated_at, 
                    status, source_system, blood_group, accounting_group, branch_id
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
                )`,
                [
                    patient.id,
                    patient.tenant_id,
                    patient.company_id,
                    nextPatientNum,
                    patient.first_name,
                    patient.last_name,
                    patient.dob,
                    patient.gender,
                    JSON.stringify(patient.contact),
                    JSON.stringify(updatedMetadata),
                    patient.created_by,
                    patient.created_at,
                    new Date(),
                    'active', // local patient becomes active
                    patient.source_system,
                    patient.blood_group,
                    patient.accounting_group,
                    patient.branch_id
                ]
            );

            console.log(`[SUCCESS] Patient synced locally.`);
            pulledCount++;
        }

        console.log(`\nSync Summary: ${pulledCount} pulled, ${skippedCount} skipped/duplicates.`);
        console.log('=========================================\n');

    } catch (err) {
        console.error('[ERROR] Pull operation failed:', err.message);
        process.exit(1);
    } finally {
        await cloudClient.end();
        await localClient.end();
    }
}

run();
