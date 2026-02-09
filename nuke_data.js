const https = require('https');

const SUPABASE_URL = 'https://yihgvgsajrncsamkwjlq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA';

function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: SUPABASE_URL.replace('https://', '').replace('/', ''),
            path: `/rest/v1/${path}`,
            method: method,
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : null;
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function nuke() {

    const tables = ['facturas', 'reparaciones', 'clientes'];

    for (const table of tables) {

        // 1. Get all IDs
        const getRes = await request(`${table}?select=id`, null, 'GET');

        if (getRes.status !== 200) {
            console.error(`❌ Error leyendo ${table}:`, getRes.data);
            continue;
        }

        const items = getRes.data;
        if (!items || items.length === 0) {
            continue;
        }


        // 2. Delete loop
        let deletedCount = 0;
        for (const item of items) {
            const delRes = await request(`${table}?id=eq.${item.id}`, null, 'DELETE');
            if (delRes.status === 204 || delRes.status === 200) {
                process.stdout.write(".");
                deletedCount++;
            } else {
                process.stdout.write("X");
                console.error(`\n❌ Error borrando ID ${item.id}:`, delRes.data);
            }
        }
    }

}

nuke();
