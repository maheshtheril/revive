const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason,
    delay,
    fetchLatestBaileysVersion,
    Browsers
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const qrcodeImage = require('qrcode'); // Added for image generation
const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const logStream = fs.createWriteStream(path.join(__dirname, 'bridge.log'), { flags: 'a' });
const logger = pino({ level: 'debug' }, logStream);
const cors = require('cors'); // Added for frontend access
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
const port = 8081; // Matched to .env

let sock;
let isConnected = false;
let latestQr = null;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth_info'));
    let version;
    try {
        const v = await fetchLatestBaileysVersion();
        version = v.version;
        console.log(`[INFO] Using latest WA version v${version.join('.')}`);
    } catch (e) {
        version = [2, 3000, 1015901307]; // Hardcoded fallback
        console.log(`[WARNING] Failed to fetch latest version, using fallback v${version.join('.')}`);
    }
    
    sock = makeWASocket({
        version,
        auth: state,
        logger,
        browser: ['Chrome (Linux)', 'Chrome', '110.0.5481.177'],
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        retryRequestDelayMs: 5000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            latestQr = qr;
            console.log('\n--- SCAN THIS QR CODE WITH WHATSAPP (VALID FOR 40 SECONDS) ---');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const error = lastDisconnect?.error;
            const code = error?.output?.statusCode || error?.code;
            const shouldReconnect = code !== DisconnectReason.loggedOut;
            
            console.log(`\n[WARNING] Connection closed (Reason: ${code}, Error: ${error?.message || 'Unknown'})`);
            isConnected = false;
            latestQr = null;

            if (shouldReconnect) {
                console.log('[INFO] Stream dropped by WhatsApp. Waiting 5s before safely reconnecting internally...');
                await delay(5000);
                connectToWhatsApp();
            } else {
                console.log('[FATAL] You have been logged out or session corrupted. Auto-cleaning "auth_info" directory for a fresh scan...');
                try {
                    const authPath = path.join(__dirname, 'auth_info');
                    if (fs.existsSync(authPath)) {
                        fs.rmSync(authPath, { recursive: true, force: true });
                    }
                    console.log('[SUCCESS] Old session wiped. Restarting bridge to generate new QR Code...');
                } catch (e) {
                    console.error('[ERROR] Could not delete auth_info automatically:', e);
                }
                process.exit(1); 
            }
        } else if (connection === 'open') {
            console.log('\n[SUCCESS] WhatsApp Connected!');
            isConnected = true;
            latestQr = null;
        }
    });
}

// API Endpoints for the HMS App
app.get('/status', (req, res) => {
    res.json({ connected: isConnected, hasQr: !!latestQr });
});

app.get('/qr', async (req, res) => {
    if (isConnected) return res.status(400).send('Already connected');
    if (!latestQr) return res.status(404).send('QR code not generated yet. Please wait or restart.');
    
    try {
        const qrImage = await qrcodeImage.toDataURL(latestQr);
        const img = Buffer.from(qrImage.split(',')[1], 'base64');
        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': img.length
        });
        res.end(img);
    } catch (err) {
        res.status(500).send('Error generating QR image');
    }
});

app.post('/logout', async (req, res) => {
    console.log('[INFO] Logout requested...');
    try {
        const authPath = path.join(__dirname, 'auth_info');
        if (isConnected && sock) {
            await sock.logout();
            // Baileys might not exit immediately, but the connection event will handle cleanup
            res.json({ success: true, message: 'Logged out. Bridge will restart shortly.' });
        } else {
            if (fs.existsSync(authPath)) {
                fs.rmSync(authPath, { recursive: true, force: true });
            }
            res.json({ success: true, message: 'Session data cleared.' });
            process.exit(0); // Exit so it can be restarted by the .bat loop or manually
        }
    } catch (err) {
        console.error('[ERROR] Logout failed:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/send-message', async (req, res) => {
    if (!isConnected) return res.status(500).json({ error: 'WhatsApp not connected' });
    
    const { number, message, pdfBase64, filename } = req.body;
    const jid = `${number}@s.whatsapp.net`;

    try {
        console.log(`[SEND] To: ${jid} (Type: ${pdfBase64 ? 'Document' : 'Text'})`);
        if (pdfBase64) {
            const buffer = Buffer.from(pdfBase64, 'base64');
            await sock.sendMessage(jid, { 
                document: buffer, 
                mimetype: 'application/pdf', 
                fileName: filename || 'Invoice.pdf',
                caption: message 
            });
        } else {
            await sock.sendMessage(jid, { text: message });
        }
        console.log(`[SUCCESS] Sent to ${jid}`);
        res.json({ success: true });
    } catch (err) {
        console.error(`[FAILURE] Send to ${jid} failed:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`[BRIDGE] Running on Port ${port} (Available on all network IPs)`);
    connectToWhatsApp();
});

