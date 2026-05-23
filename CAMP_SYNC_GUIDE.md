# Ziona HMS: Automatic Camp & Database Sync Configuration Guide

This guide provides step-by-step instructions for deploying and configuring the bidirectional database sync pipeline on your customer's local hospital server PC. Following these steps will enable automatic, zero-click synchronization between the **Neon Hosted Cloud Database** (public camp registrations) and the **Local Hospital Database** (offline patient registry).

---

## 🏗️ Architecture Overview

```mermaid
graph TD
    A[Public Camp Registration Website] -->|Writes Patient| B(Neon Hosted Cloud DB)
    C[Local Hospital Server PC] -->|1. Runs Task Scheduler every 5 mins| D[SYNC_TO_CLOUD.bat]
    D -->|2. pull_camp_registrations.js| E{Sync Pull}
    B -->|Downloads pending registrations| E
    E -->|Assigns Local ID & saves| F[(Local PostgreSQL DB)]
    D -->|3. smart_sync.js| G{Sync Push Mirror}
    F -->|Dumps offline state| G
    G -->|Pushes mirror & updates cloud| B
```

1. **Patient Registration:** Patients register on the public web link (`/camp-registration`). The data is saved to the **Cloud DB** in a `pending_sync` state.
2. **Local Sync Pull:** The local server script downloads these registrations, checks for duplicates, assigns clinical patient ID sequences (e.g. `PAT-254385`), and writes them to the **Local DB**.
3. **Local Sync Push (Mirror):** The local server dumps the updated offline database and uploads it to update the cloud mirror, ensuring both environments stay perfectly in sync.

---

## 🛠️ Step 1: Local Server Environment Configuration

On the customer's local server PC, open the project folder `C:\2035-HMS\SAAS_ERP` and verify that the `.env` file contains the correct connection strings.

1. Open `C:\2035-HMS\SAAS_ERP\.env` in a text editor.
2. Ensure the following variables are defined correctly:

```env
# The local database connection string (hospital intranet)
DATABASE_URL="postgresql://postgres:your_local_password@localhost:5432/revive_hms?schema=public"

# The hosted Neon Cloud database connection string (Singapore pool link)
CLOUD_DATABASE_URL="postgresql://postgres:your_cloud_password@sg-pooler.neon.tech/revive_db?sslmode=require"

# The tenant identifier for the hospital branch
NEXT_PUBLIC_TENANT_ID="00000000-0000-0000-0000-000000000001"
```

> [!WARNING]
> Verify that the local server has a stable internet connection so it can reach the Neon cloud database pooler URL.

---

## ⚙️ Step 2: Validate the Synchronization Script

Locate the batch file **`SYNC_TO_CLOUD.bat`** in `C:\2035-HMS\SAAS_ERP`. This file coordinates the pull and push operations.

Right-click the file and select **Edit** to ensure the paths and commands are correct:

```batch
@echo off
:: Set working directory to project root
cd /d "C:\2035-HMS\SAAS_ERP"

echo ====================================================
echo             ZIONA HMS - AUTO SYNC PIPELINE
echo ====================================================
echo Starting Camp Pull Sync...

:: 1. Pull camp registrations from Neon Cloud DB to Local DB
node scripts/pull_camp_registrations.js
if %errorlevel% neq 0 (
    echo [ERROR] Pull sync failed. Aborting cloud mirror upload to protect local data integrity.
    exit /b %errorlevel%
)

echo.
echo Starting Database Push Mirror...

:: 2. Push local database mirror up to Neon Cloud DB
node scripts/smart_sync.js
if %errorlevel% neq 0 (
    echo [ERROR] Cloud database upload failed.
    exit /b %errorlevel%
)

echo ====================================================
echo            SYNC PIPELINE COMPLETED SUCCESSFULLY!
echo ====================================================
```

---

## ⏰ Step 3: Configure Windows Task Scheduler (Zero-Click Automation)

To make the synchronization run in the background automatically every 5 minutes without requiring the user to click anything, configure a task in the **Windows Task Scheduler**:

### A. Open Task Scheduler
1. Press the `Windows Key + R` to open the Run dialog.
2. Type **`taskschd.msc`** and press **Enter** (or search for "Task Scheduler" in the Windows start menu).

### B. Create a New Task
1. In the right-hand **Actions** panel, click **Create Task...** (do not click "Create Basic Task", as we need advanced execution privileges).
2. Under the **General** tab:
   * **Name:** `Ziona HMS Data Sync`
   * **Description:** `Automatically syncs cloud camp registrations to local DB and updates cloud mirror every 5 minutes.`
   * **Security Options:** Select **Run whether user is logged on or not**. This ensures the sync runs even if the administrator logs off the server PC.
   * **Privileges:** Check the checkbox for **Run with highest privileges** (required to run PostgreSQL dump commands).
   * **Configure for:** Select **Windows 10** or **Windows Server 2016/2019** (depending on the OS).

### C. Configure Trigger (Time & Schedule)
1. Click the **Triggers** tab, then click **New...**.
2. Set **Begin the task** to **At startup** (so it starts automatically whenever the computer boots) OR **On a schedule** (Daily).
3. Under **Advanced settings**:
   * Check **Repeat task every:** Select **5 minutes** (you can type "5 minutes" manually if it isn't in the dropdown list).
   * Set **for a duration of:** Select **Indefinitely**.
   * Check **Stop task if it runs longer than:** Set to **1 hour** (to prevent hung processes from building up).
   * Ensure **Enabled** is checked.
4. Click **OK**.

### D. Configure Action (Launch Script)
1. Click the **Actions** tab, then click **New...**.
2. Set **Action** to **Start a program**.
3. Under **Program/script**, click **Browse...** and navigate to select:
   `C:\2035-HMS\SAAS_ERP\SYNC_TO_CLOUD.bat`
4. **CRITICAL STEP:** In the **Start in (optional)** field, paste the folder path:
   `C:\2035-HMS\SAAS_ERP`
   *(Without this, Node will fail to find `.env` or your scripts when launched by the system!)*
5. Click **OK**.

### E. Configure Conditions & Settings
1. Click the **Conditions** tab:
   * Uncheck **Start the task only if the computer is on AC power** (ensures it runs if the server is on a UPS battery backup).
2. Click the **Settings** tab:
   * Check **Run task as soon as possible after a scheduled start is missed**.
   * Check **If the running task does not end when requested, force it to stop**.
   * If the task fails, set it to restart automatically: check **If the task fails, restart every:** set to **1 minute**, **Attempt to restart up to:** **3 times**.
3. Click **OK**.
4. The system will prompt you for the Windows Administrator username and password. Enter it so the background service can run when logged off.

---

## 🩺 Step 4: Verification and Monitoring

Once the Task Scheduler is active, you can monitor and verify that data is syncing correctly:

1. **Verify Task Status:** Open Task Scheduler, click **Task Scheduler Library**, select the `Ziona HMS Data Sync` task, and check the **Last Run Time** and **Last Run Result** (should show `0x0` for success).
2. **Verify Local Logs:** The scripts automatically output console logs. You can redirect output in the batch file if you want to keep permanent text logs. Replace the nodes lines in `SYNC_TO_CLOUD.bat` with:
   ```batch
   node scripts/pull_camp_registrations.js >> sync_log.txt 2>&1
   node scripts/smart_sync.js >> sync_log.txt 2>&1
   ```
3. **End-to-End Test:**
   * Open the registration URL: `https://revive-qqom.vercel.app/camp-registration`
   * Fill out the form for a test patient named "Auto Sync Test" and click submit.
   * Wait 5 minutes.
   * Open your local PostgreSQL database (via pgAdmin or your HMS system) and query:
     ```sql
     SELECT * FROM "hms_patient" ORDER BY created_at DESC LIMIT 5;
     ```
   * The patient "Auto Sync Test" should show up in your local system with a sequential patient number (like `PAT-xxxxx`) automatically assigned.

---

## 🚨 Troubleshooting Checklist

* **Error: "Cannot find module..." / "Environment variables not loaded":**
  Ensure the **Start in (optional)** path in Task Scheduler Action properties is set to `C:\2035-HMS\SAAS_ERP`.
* **Error: PGPassword or command pg_dump not recognized:**
  Ensure PostgreSQL command line tools are installed on the local server and added to the Windows System PATH environment variables.
* **Sync not running when user is logged off:**
  Make sure you selected **Run whether user is logged on or not** and checked **Run with highest privileges** in the Task General tab.
* **Slow synchronization:**
  Ensure the local server's network connection is stable. The Singapore Neon pool link is highly optimized, but upload speeds depend on local internet bandwidth.
