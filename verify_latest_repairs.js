const SUPABASE_URL = 'https://yihgvgsajrncsamkwjlq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA';

async function verify() {
    console.log(`Checking latest 15 repairs in Supabase...`);

    const url = `${SUPABASE_URL}/rest/v1/reparaciones?select=id,dispositivo,marca,modelo,estado,problema,fecha_creacion,ultima_modificacion&order=ultima_modificacion.desc&limit=15`;

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
            console.log('Result: No repairs found in Supabase.');
        } else {
            console.log(`Found ${data.length} repairs:`);
            console.table(data);
        }

    } catch (e) {
        console.error('Exception:', e);
    }
}

verify();
