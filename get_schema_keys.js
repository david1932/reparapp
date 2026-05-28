const https = require('https');

const SUPABASE_URL = 'https://yihgvgsajrncsamkwjlq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA';

function request(path) {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        };

        const req = https.request(`${SUPABASE_URL}${path}`, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function run() {
    try {
        console.log('Fetching a repair row to see keys...');
        const repairs = await request('/rest/v1/reparaciones?limit=1');
        console.log('Repair row keys:', repairs.length > 0 ? Object.keys(repairs[0]) : 'No rows found');
        if (repairs.length > 0) {
            console.log('Sample row data:', repairs[0]);
        }
    } catch (e) {
        console.error(e);
    }
}

run();
