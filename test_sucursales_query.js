const SUPABASE_URL = 'https://yihgvgsajrncsamkwjlq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA';

async function verify() {
    const licenseKey = 'DAVID-MASTER-PRO-2026';
    console.log(`Querying sucursales for licenseKey: ${licenseKey}...`);

    const url = `${SUPABASE_URL}/rest/v1/sucursales?licencia_key=eq.${licenseKey}&select=*`;

    try {
        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Response:', text);

    } catch (e) {
        console.error('Exception:', e);
    }
}

verify();
