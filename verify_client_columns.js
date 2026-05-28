const SUPABASE_URL = 'https://yihgvgsajrncsamkwjlq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA';

async function verify() {
    console.log(`Checking columns in 'clientes' table...`);

    const url = `${SUPABASE_URL}/rest/v1/clientes?select=*&limit=1`;

    try {
        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        // Even if empty, let's look at response headers or content
        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Body:', text);

    } catch (e) {
        console.error('Exception:', e);
    }
}

verify();
