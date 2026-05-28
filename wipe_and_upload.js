/**
 * WIPE SUPABASE + UPLOAD ONLY REPARAPPANTIGUA.JSON
 * 
 * 1. Borra TODAS las facturas, reparaciones y clientes de Supabase
 * 2. Verifica que quede vacío
 * 3. Sube los 14 clientes, 19 reparaciones y 19 facturas del JSON
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SUPABASE_URL = 'yihgvgsajrncsamkwjlq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA';

// JSON path — try both locations
const JSON_PATHS = [
    path.join(__dirname, 'Reparappantigua.json'),
    'C:\\Users\\David\\AndroidStudioProjects\\ReparAppPremium\\Reparappantigua.json'
];

function generateUUID() {
    return crypto.randomUUID();
}

function request(method, endpoint, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: SUPABASE_URL,
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
                try {
                    const parsed = data ? JSON.parse(data) : null;
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
        req.end();
    });
}

async function countTable(table) {
    const res = await request('GET', `${table}?select=id`);
    return Array.isArray(res.data) ? res.data.length : -1;
}

async function deleteAll(table) {
    // Use neq filter to delete ALL rows in one shot
    const res = await request('DELETE', `${table}?id=neq.00000000-0000-0000-0000-000000000000`);
    return res;
}

async function upsert(table, items) {
    // Batch upsert
    const res = await request('POST', `${table}`, JSON.stringify(items));
    return res;
}

// =============================================
// MAIN
// =============================================
async function main() {
    console.log('='.repeat(60));
    console.log('  WIPE SUPABASE + UPLOAD REPARAPPANTIGUA.JSON');
    console.log('='.repeat(60));

    // ---- STEP 1: WIPE ----
    console.log('\n📛 PASO 1: BORRANDO TODO DE SUPABASE...\n');

    const tables = ['facturas', 'reparaciones', 'clientes'];

    for (const table of tables) {
        const before = await countTable(table);
        console.log(`  ${table}: ${before} registros encontrados`);

        if (before > 0) {
            // Delete all rows
            const delRes = await deleteAll(table);
            if (delRes.status >= 200 && delRes.status < 300) {
                console.log(`  ✅ ${table}: DELETE OK (status ${delRes.status})`);
            } else {
                // Fallback: delete one by one
                console.log(`  ⚠️ Bulk delete failed (${delRes.status}), borrando uno por uno...`);
                const getRes = await request('GET', `${table}?select=id`);
                if (Array.isArray(getRes.data)) {
                    for (const item of getRes.data) {
                        await request('DELETE', `${table}?id=eq.${item.id}`);
                        process.stdout.write('.');
                    }
                    console.log(' Done');
                }
            }
        }

        // Verify empty
        const after = await countTable(table);
        if (after === 0) {
            console.log(`  ✅ ${table}: VERIFICADO VACÍO (0 registros)`);
        } else {
            console.log(`  ❌ ${table}: AÚN TIENE ${after} REGISTROS — ABORTANDO`);
            process.exit(1);
        }
    }

    console.log('\n✅ SUPABASE COMPLETAMENTE LIMPIO\n');

    // ---- STEP 2: LOAD JSON ----
    console.log('📦 PASO 2: CARGANDO JSON...\n');

    let jsonPath = null;
    for (const p of JSON_PATHS) {
        if (fs.existsSync(p)) { jsonPath = p; break; }
    }
    if (!jsonPath) {
        console.error('❌ No se encontró Reparappantigua.json');
        process.exit(1);
    }

    console.log(`  Archivo: ${jsonPath}`);
    const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    console.log(`  Clientes:      ${json.clientes?.length || 0}`);
    console.log(`  Reparaciones:  ${json.reparaciones?.length || 0}`);
    console.log(`  Facturas:      ${json.facturas?.length || 0}`);

    // ---- STEP 3: CONVERT & UPLOAD ----
    console.log('\n🚀 PASO 3: SUBIENDO A SUPABASE...\n');

    // Map old IDs to new UUIDs
    const clientMap = new Map();

    // 3a. Clientes
    const clientPayloads = [];
    for (const c of (json.clientes || [])) {
        const newId = generateUUID();
        clientMap.set(String(c.id), newId);

        clientPayloads.push({
            id: newId,
            nombre: `${c.nombre || ''} ${c.apellido || ''}`.trim(),
            telefono: c.telefono || '',
            email: c.email || '',
            dni: c.dni || '',
            direccion: c.direccion || '',
            notas: '',
            fecha_creacion: c.fechaRegistro || Date.now(),
            ultima_modificacion: Date.now()
        });
    }

    if (clientPayloads.length > 0) {
        const res = await upsert('clientes', clientPayloads);
        if (res.status >= 200 && res.status < 300) {
            console.log(`  ✅ Clientes subidos: ${clientPayloads.length}`);
        } else {
            console.log(`  ❌ Error subiendo clientes (${res.status}):`, JSON.stringify(res.data).substring(0, 200));
        }
    }

    // 3b. Reparaciones
    const repPayloads = [];
    for (const r of (json.reparaciones || [])) {
        const clientId = clientMap.get(String(r.clienteId));
        if (!clientId) {
            console.log(`  ⚠️ Reparación ${r.id}: cliente ${r.clienteId} no encontrado, saltando`);
            continue;
        }

        // Map estado
        let estado = 'pendiente';
        const oldState = (r.estado || '').toUpperCase();
        if (['LISTO', 'ENTREGADO', 'TERMINADO'].includes(oldState)) estado = 'completada';
        else if (['EN PROCESO', 'REPARANDO'].includes(oldState)) estado = 'en_proceso';

        repPayloads.push({
            id: generateUUID(),
            cliente_id: clientId,
            descripcion: r.descripcionProblema || '',
            estado: estado,
            precio: r.costoEstimado || 0,
            precio_final: r.costoFinal || r.costoEstimado || 0,
            marca: r.marca || '',
            modelo: r.modelo || '',
            solucion: r.descripcionSolucion || '',
            fecha_creacion: r.fechaAdmision || Date.now(),
            ultima_modificacion: Date.now()
        });
    }

    if (repPayloads.length > 0) {
        const res = await upsert('reparaciones', repPayloads);
        if (res.status >= 200 && res.status < 300) {
            console.log(`  ✅ Reparaciones subidas: ${repPayloads.length}`);
        } else {
            console.log(`  ❌ Error subiendo reparaciones (${res.status}):`, JSON.stringify(res.data).substring(0, 200));
        }
    }

    // 3c. Facturas
    const facPayloads = [];
    for (const f of (json.facturas || [])) {
        const clientId = clientMap.get(String(f.clienteId));
        if (!clientId) {
            console.log(`  ⚠️ Factura ${f.id}: cliente ${f.clienteId} no encontrado, saltando`);
            continue;
        }

        // Parse items
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

        // Calculate subtotal from items
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
        const res = await upsert('facturas', facPayloads);
        if (res.status >= 200 && res.status < 300) {
            console.log(`  ✅ Facturas subidas: ${facPayloads.length}`);
        } else {
            console.log(`  ❌ Error subiendo facturas (${res.status}):`, JSON.stringify(res.data).substring(0, 200));
        }
    }

    // ---- STEP 4: VERIFY ----
    console.log('\n🔍 PASO 4: VERIFICACIÓN FINAL...\n');

    const finalClientes = await countTable('clientes');
    const finalReparaciones = await countTable('reparaciones');
    const finalFacturas = await countTable('facturas');

    console.log(`  Clientes:      ${finalClientes} (esperado: ${json.clientes?.length || 0})`);
    console.log(`  Reparaciones:  ${finalReparaciones} (esperado: ${json.reparaciones?.length || 0})`);
    console.log(`  Facturas:      ${finalFacturas} (esperado: ${json.facturas?.length || 0})`);

    const allOk = finalClientes === (json.clientes?.length || 0) &&
        finalReparaciones === (json.reparaciones?.length || 0) &&
        finalFacturas === (json.facturas?.length || 0);

    if (allOk) {
        console.log('\n✅ ¡TODO CORRECTO! Supabase tiene exactamente los datos del JSON.');
    } else {
        console.log('\n⚠️ Los números no coinciden. Revisa los errores arriba.');
    }

    console.log('\n' + '='.repeat(60));
    console.log('  AHORA: Abre la app, haz borrado local (Ajustes > Borrar Todo)');
    console.log('  y luego sincroniza para bajar estos datos limpios.');
    console.log('='.repeat(60));
}

main().catch(err => {
    console.error('💥 Error fatal:', err);
    process.exit(1);
});
