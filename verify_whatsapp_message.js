const reparacion = {
    id: 'test-uuid-1234',
    cliente_id: 'client-uuid-5678',
    dispositivo: 'iPhone 13',
    precio: 120,
    imei: '354632123456789',
    checklist: { power: true, screen: false }
};

const clienteName = 'Cliente Prueba';
const deviceName = 'iPhone 13';
const price = '120.00€';
// SIMULATING A BAD CONFIGURATION (Localhost)
let trackUrl = 'http://127.0.0.1:5500/tracking.html?id=test-uuid-1234';

// SIMULATING A BAD TEMPLATE (Hardcoded Localhost)
let template = `Hola {CLIENTE}, su {DISPOSITIVO} está listo.
Seguimiento: http://127.0.0.1:5500/tracking.html?id={ID}
Gracias.`;

// --- LOGIC FROM repairs_v2.js ---

// 1. Robust Config Fix Logic (Simulated)
if (!trackUrl || trackUrl.includes('127.0.0.1') || trackUrl.includes('localhost')) {
    console.log('[LOGIC] Bad Tracking URL detected. Forcing GitHub URL.');
    trackUrl = 'https://david1932.github.io/reparapp/tracking.html?id=' + reparacion.id;
}

// 2. Message Generation
let message = template
    .replace(/{CLIENTE}/g, clienteName)
    .replace(/{DISPOSITIVO}/g, deviceName)
    .replace(/{ID}/g, reparacion.id);

// 3. NUCLEAR EXTRA FIX (The code I added)
if (message.includes('127.0.0.1') || message.includes('localhost')) {
    console.log('[LOGIC] Localhost found in message body. Applying nuclear fix.');
    message = message
        .replace(/http:\/\/127\.0\.0\.1:\d+\/tracking\.html\?id=/g, 'https://david1932.github.io/reparapp/tracking.html?id=') // Specific path
        .replace(/http:\/\/127\.0\.0\.1:\d+/g, 'https://david1932.github.io/reparapp/tracking.html'); // General domain
}

console.log('\n--- FINAL GENERATED MESSAGE ---');
console.log(message);
console.log('-------------------------------');

if (message.includes('david1932.github.io')) {
    console.log('VERIFICATION SUCCESS: GitHub URL is present.');
} else {
    console.error('VERIFICATION FAILED: GitHub URL missing.');
}

if (!message.includes('127.0.0.1')) {
    console.log('VERIFICATION SUCCESS: Localhost URL is GONE.');
} else {
    console.error('VERIFICATION FAILED: Localhost URL still present.');
}
