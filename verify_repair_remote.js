
const SUPABASE_URL = 'https://yihgvgsajrncsamkwjlq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA';

async function verify() {
    const id = 'adc8d373-0530-4558-b5bd-de9ded8c3249';
    console.log(`Checking for repair ID: ${id}...`);

    const url = `${SUPABASE_URL}/rest/v1/reparaciones?id=eq.${id}&select=*`;

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
            const text = await response.text();
            console.error('Body:', text);
            return;
        }

        const data = await response.json();

        if (data.length === 0) {
            console.log('Result: NOT FOUND in Supabase.');
        } else {
            console.log('Result: FOUND in Supabase!');
            console.log('Data:', JSON.stringify(data[0], null, 2));
        }

    } catch (e) {
        console.error('Exception:', e);
    }
}

verify();
