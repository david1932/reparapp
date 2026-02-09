const https = require('https');
const crypto = require('crypto');

const SUPABASE_URL = 'https://yihgvgsajrncsamkwjlq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA';

const REPAIR_ID = crypto.randomUUID();
const CLIENT_ID = crypto.randomUUID();

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
    // 1. Create Dummy Client
    try {
        await request('/rest/v1/clientes', 'POST', {
            id: CLIENT_ID,
            nombre: 'Test Schema',
            fecha_creacion: Date.now(),
            ultima_modificacion: Date.now()
        });
        console.log('Client OK');
    } catch (e) { console.warn('Client Error (might exist):', e); }

    // 2. Test Fields
    const fieldsToTest = [
        { name: 'observaciones', val: 'Test Obs' },
        { name: 'solucion', val: 'Test Solucion' },
        { name: 'fecha_estimada', val: Date.now() },
        { name: 'checklist', val: { test: true } },
        { name: 'parts', val: [{ name: 'part1', price: 10 }] }
    ];

    for (const field of fieldsToTest) {
        console.log(`Testing field: ${field.name}...`);
        const payload = {
            id: crypto.randomUUID(),
            cliente_id: CLIENT_ID,
            marca: 'Test',
            modelo: 'Test',
            descripcion: 'Test Schema Field',
            estado: 'pendiente',
            fecha_creacion: Date.now(),
            ultima_modificacion: Date.now()
        };

        // Add the specific field
        payload[field.name] = field.val;

        try {
            await request('/rest/v1/reparaciones', 'POST', payload);
            console.log(`✅ Field '${field.name}' EXISTS.`);
        } catch (error) {
            if (error.includes('Could not find the') && error.includes(field.name)) {
                console.error(`❌ Field '${field.name}' DOES NOT EXIST.`);
            } else {
                console.error(`error testing ${field.name}:`, error);
            }
        }
    }
}

run();
