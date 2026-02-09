const https = require('https');

const SUPABASE_URL = 'https://yihgvgsajrncsamkwjlq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA';
const REPAIR_ID = '5a9a7ba0-51c6-4d01-954c-c94edda4a905';

const options = {
    headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
    }
};

console.log(`Checking Repair ID: ${REPAIR_ID}...`);

https.get(`${SUPABASE_URL}/rest/v1/reparaciones?id=eq.${REPAIR_ID}&select=*`, options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log(`Supabase API Status: ${res.statusCode}`);
        try {
            const json = JSON.parse(data);
            if (Array.isArray(json) && json.length > 0) {
                console.log('✅ REPAIR FOUND IN CLOUD DB');
                console.log('--------------------------------');
                const r = json[0];
                console.log(`Device: ${r.marca || ''} ${r.modelo || r.dispositivo || 'Unknown'}`);
                console.log(`Status: ${r.estado}`);
                console.log(`Problem: ${r.averia || r.problema || r.descripcion || 'N/A'}`);
                console.log('--------------------------------');
                console.log('Result: The tracking link will work perfectly.');
            } else {
                console.log('❌ REPAIR NOT FOUND');
                console.log('The ID is valid UUID format, but it is not yet in Supabase.');
                console.log('Probable cause: Sync has not happened yet or failed.');
            }
        } catch (e) {
            console.error('Error parsing JSON:', e);
        }
    });
}).on('error', (e) => {
    console.error('Network Error:', e);
});
