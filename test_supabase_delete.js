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

async function test() {
    console.log("1. Creating Test Client...");
    const testId = "test-delete-" + Date.now();
    const createRes = await request('clientes', {
        id: testId,
        nombre: "Test Delete Verification",
        telefono: "000000000",
        ultima_modificacion: Date.now()
    }, 'POST');

    console.log("Create Status:", createRes.status);
    if (createRes.status !== 201) {
        console.error("Failed to create:", createRes.data);
        return;
    }

    console.log("2. Verifying it exists...");
    const getRes = await request(`clientes?id=eq.${testId}`, null, 'GET');
    console.log("Get Status:", getRes.status);
    console.log("Found:", getRes.data.length > 0);

    console.log("3. Attempting DELETE...");
    const delRes = await request(`clientes?id=eq.${testId}`, null, 'DELETE');
    console.log("Delete Status:", delRes.status);

    // Check if it's really gone
    const checkRes = await request(`clientes?id=eq.${testId}`, null, 'GET');
    console.log("4. Verifying deletion...");
    if (checkRes.data && checkRes.data.length === 0) {
        console.log("SUCCESS: Record was deleted.");
    } else {
        console.log("FAILURE: Record still exists!");
        console.log("Data:", checkRes.data);
    }
}

test();
