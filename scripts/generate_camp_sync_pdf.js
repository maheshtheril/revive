const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

async function run() {
    const pdfPath = path.join(__dirname, '..', 'CAMP_SYNC_GUIDE.pdf');
    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 60, bottom: 60, left: 50, right: 50 },
        bufferPages: true
    });
    
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);
    
    // Helper to check page break
    function checkPageBreak(neededHeight) {
        if (doc.y + neededHeight > 750) {
            doc.addPage();
            doc.y = 60;
        }
    }
    
    // Style Helpers
    function addHeading(text) {
        checkPageBreak(35);
        doc.y += 12;
        doc.fillColor('#4f46e5').fontSize(12).font('Helvetica-Bold').text(text);
        doc.y += 6;
    }
    
    function addParagraph(text) {
        doc.fontSize(9.5).font('Helvetica');
        const height = doc.heightOfString(text, { width: 495, lineGap: 3.5 });
        checkPageBreak(height + 10);
        doc.fillColor('#334155').text(text, {
            lineGap: 3.5,
            width: 495
        });
        doc.y += 6;
    }
    
    function addBullet(text) {
        const bulletText = `•  ${text}`;
        doc.fontSize(9.5).font('Helvetica');
        const height = doc.heightOfString(bulletText, { width: 475, lineGap: 3.5 });
        checkPageBreak(height + 10);
        doc.fillColor('#334155').text(bulletText, 70, doc.y, {
            lineGap: 3.5,
            width: 475
        });
        doc.x = 50;
        doc.y += 5;
    }
    
    function addSubBullet(text) {
        const bulletText = `-  ${text}`;
        doc.fontSize(9).font('Helvetica');
        const height = doc.heightOfString(bulletText, { width: 455, lineGap: 3 });
        checkPageBreak(height + 8);
        doc.fillColor('#475569').text(bulletText, 90, doc.y, {
            lineGap: 3,
            width: 455
        });
        doc.x = 50;
        doc.y += 5;
    }
    
    function addCodeBlock(code) {
        const lines = code.split('\n');
        const height = lines.length * 11 + 16;
        checkPageBreak(height + 15);
        
        const startY = doc.y;
        doc.rect(50, startY, 495, height).fill('#1e293b');
        
        doc.fillColor('#cbd5e1').fontSize(8).font('Courier');
        let currentY = startY + 8;
        for (const line of lines) {
            doc.text(line, 65, currentY);
            currentY += 11;
        }
        doc.y = startY + height + 10;
    }
    
    function addWarningBlock(text) {
        doc.fontSize(9.5).font('Helvetica');
        const contentHeight = doc.heightOfString(text, { width: 465, lineGap: 3 });
        const height = contentHeight + 35;
        checkPageBreak(height + 10);
        
        const startY = doc.y;
        doc.rect(50, startY, 495, height).fill('#fffbeb');
        doc.rect(50, startY, 4, height).fill('#d97706');
        
        doc.fillColor('#78350f').fontSize(9.5).font('Helvetica-Bold').text('WARNING / IMPORTANT NOTICE:', 65, startY + 8);
        doc.font('Helvetica').fillColor('#78350f').text(text, 65, startY + 22, {
            lineGap: 3,
            width: 465
        });
        doc.y = startY + height + 10;
    }
    
    // Draw Title Block on page 1
    doc.rect(50, 60, 495, 80).fill('#0f172a');
    doc.fillColor('#6366f1').fontSize(9).font('Helvetica-Bold').text('ADMINISTRATION & DEPLOYMENT MANUAL', 70, 75, { characterSpacing: 1.5 });
    doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text('Ziona HMS: Automatic Camp Sync', 70, 90);
    doc.fillColor('#94a3b8').fontSize(9).font('Helvetica').text('Zero-Click Background Sync Setup Guide for Local Hospital Server', 70, 115);
    
    doc.y = 160;
    
    // --- CONTENT RENDERING ---
    addHeading('1. Architecture & Bidirectional Sync Logic');
    addParagraph('The camp registration synchronization runs fully automatically between the public cloud portal and the offline hospital intranet database. This zero-click implementation maintains data consistency without requiring manual button clicks or administrator triggers.');
    
    addParagraph('Here is how the data flows seamlessly across both systems:');
    addBullet('Patient Camp Registration: Patients scan the QR code at the camp on their phones and fill in the registration details at https://revive-qqom.vercel.app/camp-registration. These records are stored in the Neon Hosted Cloud DB with a status of "pending_sync" and a source identifier of "camp_cloud".');
    addBullet('Local Sync Pull: Every 5 minutes, the local hospital server automatically runs scripts/pull_camp_registrations.js. This connects securely to the Neon Cloud DB, fetches all "pending_sync" patients, and processes them one-by-one.');
    addSubBullet('Duplicate Check: The script automatically screens local records by unique IDs, matching phone numbers, and emails to prevent duplicate entries.');
    addSubBullet('Clinical ID Generation: For each unique patient, the script generates a local clinical sequential patient ID (e.g., PAT-1025) according to the hospital prefix settings.');
    addSubBullet('Intranet Insertion: The patient record is inserted directly into the local PostgreSQL DB with the status marked as "active".');
    addBullet('Local Sync Push (Mirroring): Immediately after pulling, the server runs smart_sync.js. This takes a backup of the updated local database state and pushes it to the Neon Hosted Cloud DB, overwriting it. Because the pulled records now have "active" status and generated IDs, they overwrite the "pending_sync" states on the cloud. The system is now 100% in sync.');
    
    addWarningBlock('Do not delete the .env file or modify files in scripts/ on the local server, as these run the backend sync procedures. Any breaking changes will cause data differences between the online camp registrations and the local hospital records.');
    
    addHeading('2. Local Server Environment Setup');
    addParagraph('Configure the environment settings on the customer\'s local server PC to allow scripts to communicate with both the local database and the cloud database:');
    addBullet('Navigate to the project root folder C:\\2035-HMS\\SAAS_ERP on the local server.');
    addBullet('Open the .env file in a text editor (e.g., Notepad).');
    addBullet('Verify or configure the following three parameters:');
    
    addCodeBlock(
`# The local database connection string (hospital intranet)
DATABASE_URL="postgresql://postgres:your_local_password@localhost:5432/revive_hms?schema=public"

# The hosted Neon Cloud database connection string (Singapore pooler link)
CLOUD_DATABASE_URL="postgresql://postgres:your_cloud_password@sg-pooler.neon.tech/revive_db?sslmode=require"

# The unique branch/tenant identifier for this hospital location
NEXT_PUBLIC_TENANT_ID="00000000-0000-0000-0000-000000000001"`
    );
    
    addWarningBlock('Verify that the local server has a stable internet connection. The CLOUD_DATABASE_URL requires a secure SSL handshake (sslmode=require). Ensure outgoing traffic on port 5432 is not blocked by local firewalls.');
    
    addHeading('3. Verification of the Sync Batch Script');
    addParagraph('The automated task scheduler runs a single batch script that orchestrates the sync pipeline. Open the script file C:\\2035-HMS\\SAAS_ERP\\SYNC_TO_CLOUD.bat and ensure it is formatted exactly as follows:');
    
    addCodeBlock(
`@echo off
:: Force change directory to project root folder
cd /d "C:\\2035-HMS\\SAAS_ERP"

echo ====================================================
echo             ZIONA HMS - AUTO SYNC PIPELINE
echo ====================================================
echo Starting Camp Pull Sync...

:: 1. Run local pull script to fetch registrations
node scripts/pull_camp_registrations.js
if %errorlevel% neq 0 (
    echo [ERROR] Pull sync failed. Aborting cloud mirror to protect local data.
    exit /b %errorlevel%
)

echo.
echo Starting Database Push Mirror...

:: 2. Run push script to upload local mirror to cloud
node scripts/smart_sync.js
if %errorlevel% neq 0 (
    echo [ERROR] Cloud database upload failed.
    exit /b %errorlevel%
)

echo ====================================================
echo            SYNC PIPELINE COMPLETED SUCCESSFULLY!
echo ====================================================`
    );
    
    addHeading('4. Step-by-Step Windows Task Scheduler Configuration');
    addParagraph('To execute the sync script in the background automatically and silently without requiring any user click, register it as a system task in Windows Task Scheduler:');
    
    addBullet('A. Open Windows Task Scheduler:');
    addSubBullet('Press the Win + R keys to open the Run dialog box.');
    addSubBullet('Type taskschd.msc and press Enter.');
    
    addBullet('B. Create New System Task:');
    addSubBullet('In the right-hand Actions panel, click Create Task... (do NOT use "Create Basic Task").');
    addSubBullet('Under the General tab, enter the name: Ziona HMS Data Sync');
    addSubBullet('Set the description to: Automatically syncs cloud camp registrations to local DB and updates cloud mirror every 5 minutes.');
    addSubBullet('Select the security option: Run whether user is logged on or not. This is critical for servers.');
    addSubBullet('Check the box: Run with highest privileges. This allows PostgreSQL command line tools to export data.');
    addSubBullet('Under Configure for, select Windows 10 or Windows Server 2016/2019.');
    
    addBullet('C. Configure Task Timing (Triggers Tab):');
    addSubBullet('Click the Triggers tab, then click New....');
    addSubBullet('Set Begin the task to: At startup (runs immediately when the PC boots) or On a schedule.');
    addSubBullet('Under Advanced settings, check Repeat task every: and type or select 5 minutes.');
    addSubBullet('Set the duration of to: Indefinitely.');
    addSubBullet('Check Stop task if it runs longer than: and set to 1 hour.');
    addSubBullet('Make sure the Enabled checkbox at the bottom is checked, then click OK.');
    
    addBullet('D. Configure Execution Script (Actions Tab):');
    addSubBullet('Click the Actions tab, then click New....');
    addSubBullet('Set Action to: Start a program.');
    addSubBullet('Under Program/script, click Browse... and select C:\\2035-HMS\\SAAS_ERP\\SYNC_TO_CLOUD.bat');
    addSubBullet('CRITICAL FIELD: In the Start in (optional) field, paste: C:\\2035-HMS\\SAAS_ERP');
    addSubBullet('Note: Leaving the "Start in" field blank is the #1 reason background tasks fail, as Node will be unable to locate the .env configuration file.');
    addSubBullet('Click OK.');
    
    addBullet('E. Configure Reliability Settings (Conditions & Settings Tabs):');
    addSubBullet('In the Conditions tab: Uncheck "Start the task only if the computer is on AC power" so synchronization continues during power outages using UPS backup power.');
    addSubBullet('In the Settings tab: Check "Run task as soon as possible after a scheduled start is missed".');
    addSubBullet('Check "If the running task does not end when requested, force it to stop".');
    addSubBullet('Check "If the task fails, restart every:" and set to 1 minute, with attempts set to 3 times.');
    addSubBullet('Click OK to finalize the task. You will be prompted to enter the Windows Administrator password to register the background service.');
    
    addHeading('5. Diagnostics, Verification & Monitoring');
    addParagraph('Follow these validation steps to ensure that the synchronization pipeline is operating correctly:');
    
    addBullet('Verify Windows Task Status: Open Task Scheduler, click Task Scheduler Library, and locate Ziona HMS Data Sync. Ensure the status is "Ready", the Last Run Time matches the last 5-minute interval, and the Last Run Result displays (0x0).');
    
    addBullet('Configuring Log History: To maintain a permanent record of all database synchronizations, right-click the SYNC_TO_CLOUD.bat file, click Edit, and redirect the command outputs to a text log. Change the script execution lines to:');
    addCodeBlock(
`node scripts/pull_camp_registrations.js >> sync_log.txt 2>&1
node scripts/smart_sync.js >> sync_log.txt 2>&1`
    );
    addParagraph('This creates a sync_log.txt file in the root folder containing live timestamps, connections, and diagnostic logs.');
    
    addBullet('Perform End-to-End Test:');
    addSubBullet('Open the public camp registration website on any browser: https://revive-qqom.vercel.app/camp-registration');
    addSubBullet('Register a test patient with first name "Automatic" and last name "Sync Test".');
    addSubBullet('Wait 5 minutes without touching the server.');
    addSubBullet('Log into pgAdmin or run a query against your local database:');
    addSubBullet('SQL: SELECT id, patient_number, first_name, status FROM "hms_patient" ORDER BY created_at DESC LIMIT 3;');
    addSubBullet('Confirm that "Automatic Sync Test" is visible in the local database with a generated sequential patient ID prefix (e.g. PAT-1002) and status marked as "active".');
    
    addHeading('6. Troubleshooting Checklist');
    addBullet('Error: "Cannot find module..." or "Environment variables not loaded":');
    addSubBullet('Fix: Ensure the "Start in (optional)" directory in the Task Scheduler Action tab is explicitly set to C:\\2035-HMS\\SAAS_ERP.');
    addBullet('Error: "pg_dump is not recognized as an internal or external command":');
    addSubBullet('Fix: The PostgreSQL bin directory must be added to the Windows System PATH environment variables (e.g., C:\\Program Files\\PostgreSQL\\15\\bin).');
    addBullet('Error: Task fails to run when the Administrator logs off:');
    addSubBullet('Fix: Open task properties and verify that "Run whether user is logged on or not" is selected, and that "Run with highest privileges" is checked.');
    addBullet('Error: "password authentication failed for user":');
    addSubBullet('Fix: Open the .env file and ensure that database credentials and special characters in passwords are correctly written.');
    
    // Draw headers and footers on all buffered pages
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        const pageNum = i + 1;
        const totalPages = range.count;
        
        // Draw header
        if (pageNum > 1) {
            doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, 45).lineTo(545, 45).stroke();
            
            doc.fillColor('#4f46e5').fontSize(7.5).font('Helvetica-Bold');
            doc.text('ZIONA HMS - CAMP & DATABASE SYNC', 50, 32);
            
            doc.font('Helvetica').fillColor('#94a3b8');
            doc.text('ADMINISTRATOR MANUAL', 50, 32, { align: 'right', width: 495 });
        }
        
        // Draw footer
        doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, 790).lineTo(545, 790).stroke();
        
        doc.fillColor('#64748b').fontSize(7.5).font('Helvetica');
        doc.text('© 2026 ZIONA HMS - CONFIDENTIAL DOCUMENT', 50, 800);
        doc.text(`Page ${pageNum} of ${totalPages}`, 50, 800, { align: 'right', width: 495 });
    }
    
    doc.end();
    
    stream.on('finish', () => {
        console.log('PDF written successfully to ' + pdfPath);
    });
}

// Execute the renderer
run().catch(console.error);
