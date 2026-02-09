const https = require('https');
const crypto = require('crypto');

// --- CONFIG ---
const SUPABASE_URL = 'https://yihgvgsajrncsamkwjlq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA';

// USER'S SPECIFIC REPAIR ID
const REPAIR_ID = '5a9a7ba0-51c6-4d01-954c-c94edda4a905';
const CLIENT_ID = crypto.randomUUID(); // New Client ID

// --- HELPERS ---
function request(path, method, data) {
    return new Promise((resolve, reject) => {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=representation'
            }
        };

        const req = https.request(`${SUPABASE_URL}${path}`, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
                } else {
                    reject(`Request Failed (${res.statusCode}): ${body}`);
                }
            });
        });

        req.on('error', (e) => reject(e));
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function run() {
    try {
        console.log('1. Inserting Dummy Client...');
        const client = await request('/rest/v1/clientes', 'POST', {
            id: CLIENT_ID,
            nombre: 'Cliente Web',
            telefono: '600123456',
            email: 'cliente@web.com',
            fecha_creacion: Date.now(),
            ultima_modificacion: Date.now()
        });
        console.log('Client Inserted:', client ? 'OK' : 'Error');

        console.log('2. Inserting User Repair...');
        const repair = await request('/rest/v1/reparaciones', 'POST', {
            id: REPAIR_ID,
            cliente_id: CLIENT_ID,
            marca: 'Apple',
            modelo: 'iPhone',
            descripcion: 'Pantalla Rota (Simulado)',
            estado: 'en_proceso',
            precio: 150,
            fecha_creacion: Date.now(),
            ultima_modificacion: Date.now()
        });

        console.log('✅ REPAIR SYNCED SUCCESSFULLY!');
        console.log(`Tracking Link: https://david1932.github.io/reparapp/tracking.html?id=${REPAIR_ID}`);

    } catch (error) {
        console.error('❌ FATAL ERROR:', error);
    }
}

run();
