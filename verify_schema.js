const SUPABASE_URL = 'https://yihgvgsajrncsamkwjlq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA';

async function verify() {
    console.log(`Checking columns in Supabase...`);

    const url = `${SUPABASE_URL}/rest/v1/reparaciones?select=*&limit=1`;

    try {
        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            return;
        }

        const data = await response.json();
        if (data.length > 0) {
            console.log('Columns in reparaciones table:', Object.keys(data[0]));
            console.log('Sample record details:', JSON.stringify(data[0], null, 2));
        } else {
            console.log('No records found in reparaciones.');
        }

    } catch (e) {
        console.error('Exception:', e);
    }
}

verify();
