const os = require('os');
const fs = require('fs');
const path = require('path');

function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Filter for external IPv4 addresses (ignore 127.0.0.1 and internal/VMware/VirtualBox adapters if possible)
            if (iface.family === 'IPv4' && !iface.internal) {
                if (name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('ethernet') || name.toLowerCase().includes('en0') || name.toLowerCase().includes('eth0')) {
                    return iface.address;
                }
            }
        }
    }
    // Fallback if specific name match failed
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

function updateEnvFile() {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
        console.warn('⚠️ No .env file found at:', envPath);
        return;
    }

    let envContent = fs.readFileSync(envPath, 'utf8');

    // Check if auto-config is skipped
    if (envContent.includes('SKIP_IP_CONFIG=true')) {
        console.log('📌 Local IP Auto-Config is skipped (SKIP_IP_CONFIG=true).');
        return;
    }

    const currentIp = getLocalIpAddress();
    const port = process.env.PORT || 3002;
    const newUrl = `http://${currentIp}:${port}`;

    console.log(`\n====================================================================`);
    console.log(`🌐 ZIONA LAN AUTO-CONFIG: DETECTED SERVER IP -> ${currentIp}`);
    console.log(`====================================================================`);

    let modified = false;

    // Update NEXT_PUBLIC_APP_URL
    if (envContent.match(/NEXT_PUBLIC_APP_URL=("[^"]*"|[^\n]*)/)) {
        envContent = envContent.replace(/NEXT_PUBLIC_APP_URL=("[^"]*"|[^\n]*)/, `NEXT_PUBLIC_APP_URL="${newUrl}"`);
        modified = true;
    }

    // Update NEXTAUTH_URL
    if (envContent.match(/NEXTAUTH_URL=("[^"]*"|[^\n]*)/)) {
        envContent = envContent.replace(/NEXTAUTH_URL=("[^"]*"|[^\n]*)/, `NEXTAUTH_URL="${newUrl}"`);
        modified = true;
    }

    // Update AUTH_URL
    if (envContent.match(/AUTH_URL=("[^"]*"|[^\n]*)/)) {
        envContent = envContent.replace(/AUTH_URL=("[^"]*"|[^\n]*)/, `AUTH_URL="${newUrl}"`);
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(envPath, envContent, 'utf8');
        console.log(`✅ Successfully synced .env URLs to: ${newUrl}`);
    }

    console.log(`\n📲 CLIENT ACCESS URL (Doctor / Nurse / Reception PCs):`);
    console.log(`   👉 ${newUrl}\n`);
}

updateEnvFile();
