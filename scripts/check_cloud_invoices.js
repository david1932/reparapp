const https = require('https');

const SUPABASE_URL = 'https://yihgvgsajrncsamkwjlq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA';

function request(endpoint) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'count=exact'
            }
        };

        https.get(`${SUPABASE_URL}/rest/v1/${endpoint}`, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                // Get count from header if available
                const contentRange = res.headers['content-range'];
                let count = 'Unknown';
                if (contentRange) {
                    count = contentRange.split('/')[1];
                }

                try {
                    const json = JSON.parse(data);
                    resolve({ count, data: json, status: res.statusCode });
                } catch (e) {
                    resolve({ count, data: data, status: res.statusCode });
                }
            });
        }).on('error', (err) => reject(err));
    });
}

async function check() {
    console.log('--- Checking Cloud Invoices ---');
    try {
        // Check count
        const invoices = await request('facturas?select=*&limit=5&order=fecha.desc');

        console.log(`Status Code: ${invoices.status}`);
        console.log(`Total Count (Content-Range): ${invoices.count}`);

        if (Array.isArray(invoices.data)) {
            console.log(`Num fetched: ${invoices.data.length}`);
            if (invoices.data.length > 0) {
                console.log('Last 5 Invoices:');
                invoices.data.forEach(inv => {
                    console.log(` - ID: ${inv.id} | Num: ${inv.numero} | Fecha: ${inv.fecha} | Total: ${inv.total} | Deleted: ${inv.deleted}`);
                });
            } else {
                console.log('No invoices returned in valid array.');
            }
        } else {
            console.log('Response is not an array:', invoices.data);
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

check();
