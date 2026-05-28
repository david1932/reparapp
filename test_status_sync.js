// Verification Script: Test Status Sync Mapping

function cloudToLocalStatus(status) {
    if (!status) return 'recibido';
    const s = status.toUpperCase().trim();
    switch (s) {
        case 'RECIBIDO':
        case 'PENDIENTE':
            return 'recibido';
        case 'EN_DIAGNOSTICO':
        case 'DIAGNOSTICO':
            return 'diagnostico';
        case 'EN_PROCESO':
            return 'en_proceso';
        case 'REPARANDO':
        case 'EN_REPARACION':
            return 'en_reparacion';
        case 'LISTO':
        case 'REPARADO':
            return 'listo';
        case 'ENTREGADO':
            return 'entregado';
        case 'GARANTIA':
            return 'garantia';
        case 'CANCELADO':
            return 'cancelado';
        default:
            return s.toLowerCase();
    }
}

function localToCloudStatus(status) {
    if (!status) return 'RECIBIDO';
    const s = status.toLowerCase().trim();
    switch (s) {
        case 'recibido':
        case 'pendiente':
            return 'RECIBIDO';
        case 'diagnostico':
        case 'presupuesto':
            return 'EN_DIAGNOSTICO';
        case 'en_proceso':
        case 'en proceso':
            return 'EN_PROCESO';
        case 'en_reparacion':
        case 'en reparacion':
        case 'reparando':
        case 'esperando_pieza':
            return 'REPARANDO';
        case 'listo':
        case 'reparado':
        case 'completada':
            return 'LISTO';
        case 'entregado':
        case 'entregada':
            return 'ENTREGADO';
        case 'garantia':
        case 'garantía':
            return 'GARANTIA';
        case 'cancelado':
            return 'CANCELADO';
        default:
            return s.toUpperCase().replace(/[-\s]/g, '_');
    }
}

// Test cases
const tests = [
    // Local to Cloud tests
    { type: 'localToCloud', input: 'recibido', expected: 'RECIBIDO' },
    { type: 'localToCloud', input: 'pendiente', expected: 'RECIBIDO' },
    { type: 'localToCloud', input: 'diagnostico', expected: 'EN_DIAGNOSTICO' },
    { type: 'localToCloud', input: 'en_proceso', expected: 'EN_PROCESO' },
    { type: 'localToCloud', input: 'en_reparacion', expected: 'REPARANDO' },
    { type: 'localToCloud', input: 'reparando', expected: 'REPARANDO' },
    { type: 'localToCloud', input: 'listo', expected: 'LISTO' },
    { type: 'localToCloud', input: 'reparado', expected: 'LISTO' },
    { type: 'localToCloud', input: 'entregado', expected: 'ENTREGADO' },
    { type: 'localToCloud', input: 'garantia', expected: 'GARANTIA' },
    { type: 'localToCloud', input: 'cancelado', expected: 'CANCELADO' },

    // Cloud to Local tests
    { type: 'cloudToLocal', input: 'RECIBIDO', expected: 'recibido' },
    { type: 'cloudToLocal', input: 'PENDIENTE', expected: 'recibido' },
    { type: 'cloudToLocal', input: 'EN_DIAGNOSTICO', expected: 'diagnostico' },
    { type: 'cloudToLocal', input: 'EN_PROCESO', expected: 'en_proceso' },
    { type: 'cloudToLocal', input: 'REPARANDO', expected: 'en_reparacion' },
    { type: 'cloudToLocal', input: 'EN_REPARACION', expected: 'en_reparacion' },
    { type: 'cloudToLocal', input: 'LISTO', expected: 'listo' },
    { type: 'cloudToLocal', input: 'REPARADO', expected: 'listo' },
    { type: 'cloudToLocal', input: 'ENTREGADO', expected: 'entregado' },
    { type: 'cloudToLocal', input: 'GARANTIA', expected: 'garantia' },
    { type: 'cloudToLocal', input: 'CANCELADO', expected: 'cancelado' }
];

let failed = 0;
console.log('Running status mapper tests...');

for (const t of tests) {
    const result = t.type === 'localToCloud' ? localToCloudStatus(t.input) : cloudToLocalStatus(t.input);
    if (result === t.expected) {
        console.log(`✅ [PASS] ${t.type}: '${t.input}' -> '${result}'`);
    } else {
        console.error(`❌ [FAIL] ${t.type}: '${t.input}' -> expected '${t.expected}', got '${result}'`);
        failed++;
    }
}

if (failed === 0) {
    console.log('All tests PASSED successfully!');
    process.exit(0);
} else {
    console.error(`Test finished with ${failed} failures.`);
    process.exit(1);
}
