const SUPABASE_URL = 'https://yihgvgsajrncsamkwjlq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA';

async function verify() {
    console.log(`Testing if 'clientes' table accepts 'dni' column...`);

    const url = `${SUPABASE_URL}/rest/v1/clientes`;
    const payload = {
        id: '11111111-2222-3333-4444-555555555555',
        nombre: 'DNI Test Client',
        dni: '12345678X',
        fecha_creacion: Date.now(),
        ultima_modificacion: Date.now()
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(payload)
        });

        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Response:', text);

        // Delete it after testing if it succeeded
        if (response.ok) {
            await fetch(`${url}?id=eq.${payload.id}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });
            console.log('Cleaned up test client.');
        }

    } catch (e) {
        console.error('Exception:', e);
    }
}

verify();
