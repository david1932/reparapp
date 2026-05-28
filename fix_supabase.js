/**
 * FIX: Delete ghost "Cliente General" + upload 19 facturas
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SUPABASE_HOST = 'yihgvgsajrncsamkwjlq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA';

function generateUUID() { return crypto.randomUUID(); }

function request(method, endpoint, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: SUPABASE_HOST,
            path: `/rest/v1/${endpoint}`,
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
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, data: data }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
        req.end();
    });
}

async function main() {
    console.log('=== FIX SUPABASE ===\n');

    // 1. Delete "Cliente General" ghosts (DNI = 00000000T)
    console.log('1. Borrando "Cliente General" fantasma (DNI=00000000T)...');
    const del = await request('DELETE', 'clientes?nombre=eq.Cliente%20General');
    console.log(`   Status: ${del.status}, borrados: ${Array.isArray(del.data) ? del.data.length : '?'}`);

    // Verify clientes count
    const cRes = await request('GET', 'clientes?select=id');
    console.log(`   Clientes ahora: ${Array.isArray(cRes.data) ? cRes.data.length : '?'}`);

    // 2. Upload facturas from JSON
    console.log('\n2. Subiendo 19 facturas...');

    const jsonPath = path.join(__dirname, 'Reparappantigua.json');
    const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // Need client map: get current clients from Supabase by DNI to match  
    const clientsRes = await request('GET', 'clientes?select=id,dni,nombre');
    const supaClients = clientsRes.data;

    // Build DNI -> UUID map from Supabase
    const dniMap = new Map();
    for (const c of supaClients) {
        if (c.dni) dniMap.set(c.dni.toLowerCase(), c.id);
    }

    // Build old ID -> DNI map from JSON
    const oldIdToDni = new Map();
    for (const c of json.clientes) {
        if (c.dni) oldIdToDni.set(String(c.id), c.dni.toLowerCase());
    }

    // Build old ID -> Supabase UUID
    const clientMap = new Map();
    for (const c of json.clientes) {
        const dni = c.dni ? c.dni.toLowerCase() : null;
        if (dni && dniMap.has(dni)) {
            clientMap.set(String(c.id), dniMap.get(dni));
        }
    }
    console.log(`   Clientes mapeados por DNI: ${clientMap.size} de ${json.clientes.length}`);

    const facPayloads = [];
    for (const f of (json.facturas || [])) {
        const clientId = clientMap.get(String(f.clienteId));
        if (!clientId) {
            console.log(`   ⚠️ Factura ${f.numero}: cliente ${f.clienteId} no mapeado`);
            continue;
        }

        let items = [];
        try {
            const rawItems = typeof f.itemsJson === 'string' ? JSON.parse(f.itemsJson) : (f.itemsJson || []);
            items = rawItems.map(item => ({
                descripcion: item.description || '',
                cantidad: item.quantity || 1,
                precio: item.unitPrice || 0,
                total: (item.quantity || 1) * (item.unitPrice || 0)
            }));
        } catch (e) { }

        const subtotal = items.reduce((sum, i) => sum + i.total, 0);
        const iva = f.total - subtotal;

        facPayloads.push({
            id: generateUUID(),
            cliente_id: clientId,
            numero: f.numero || '',
            fecha: new Date(f.fecha || Date.now()).toISOString(),
            subtotal: subtotal,
            iva: iva > 0 ? iva : 0,
            total: f.total || 0,
            items: items,
            fecha_creacion: f.fecha || Date.now(),
            ultima_modificacion: Date.now()
        });
    }

    if (facPayloads.length > 0) {
        const res = await request('POST', 'facturas', facPayloads);
        if (res.status >= 200 && res.status < 300) {
            console.log(`   ✅ Facturas subidas: ${facPayloads.length}`);
        } else {
            console.log(`   ❌ Error (${res.status}):`, JSON.stringify(res.data).substring(0, 300));
        }
    }

    // 3. Final count
    console.log('\n3. Verificación final:');
    const fc = await request('GET', 'clientes?select=id');
    const fr = await request('GET', 'reparaciones?select=id');
    const ff = await request('GET', 'facturas?select=id');
    console.log(`   Clientes:     ${Array.isArray(fc.data) ? fc.data.length : '?'}`);
    console.log(`   Reparaciones: ${Array.isArray(fr.data) ? fr.data.length : '?'}`);
    console.log(`   Facturas:     ${Array.isArray(ff.data) ? ff.data.length : '?'}`);
}

main().catch(e => console.error('💥', e));
