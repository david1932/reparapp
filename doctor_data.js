/**
 * REPAIR DATA DOCTOR
 * Script para corregir formatos de fecha en la base de datos local (IndexedDB)
 * Convierte strings ISO a timestamps numéricos para asegurar la sincronización.
 */

(function initDoctor() {
    console.log('👨‍⚕️ Doctor esperando a la base de datos...');

    // Esperar a que la variable global 'db' esté inicializada
    const checkDB = setInterval(async () => {
        // Chequeo robusto: db debe existir en el scope global y tener isReady=true
        let dbInstance = null;
        try {
            if (typeof db !== 'undefined') {
                dbInstance = db;
            } else if (window.db) {
                dbInstance = window.db;
            }
        } catch (e) {
            // Ignore temporary errors
        }

        if (dbInstance && dbInstance.isReady) {
            clearInterval(checkDB);
            console.log('✅ Base de datos detectada. Iniciando análisis...');

            // Retraso adicional para asegurar que otros inits terminen
            setTimeout(async () => {
                await runDoctor(dbInstance);
            }, 1500);
        }
    }, 500); // Check every 500ms

    // Timeout de seguridad (15s)
    setTimeout(() => {
        clearInterval(checkDB);
        // Silent fail if it takes too long to avoid annoyance, or log error
        console.warn('⚠️ Tiempo de espera agotado para DB en Doctor script.');
    }, 15000);

    async function runDoctor(database) {
        console.log('👨‍⚕️ INICIANDO DOCTOR DE DATOS...');

        try {
            // 2. Obtener todas las reparaciones
            const reparaciones = await database.getAllReparaciones();
            console.log(`📋 Analizando ${reparaciones.length} reparaciones...`);

            let fixedCount = 0;
            let invalidIds = 0;

            for (const r of reparaciones) {
                let modified = false;

                // CHEQUEO 1: Fechas (String -> Number)
                if (typeof r.fecha_creacion === 'string') {
                    console.log(`🔧 Corrigiendo fecha_creacion en ${r.id}: ${r.fecha_creacion} -> Timestamp`);
                    r.fecha_creacion = new Date(r.fecha_creacion).getTime();
                    modified = true;
                }

                if (typeof r.ultima_modificacion === 'string') {
                    console.log(`🔧 Corrigiendo ultima_modificacion en ${r.id}: ${r.ultima_modificacion} -> Timestamp`);
                    r.ultima_modificacion = new Date(r.ultima_modificacion).getTime();
                    modified = true;
                }

                // CHEQUEO 2: ID Válido (Supabase exige UUID)
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(r.id)) {
                    console.warn(`⚠️ ID Inválido detectado: ${r.id}. Supabase lo rechazará.`);
                    invalidIds++;
                }

                // GUARDAR SI HUBO CAMBIOS
                if (modified) {
                    // Forzar actualización de 'ultima_modificacion' para que el sync lo detecte
                    r.ultima_modificacion = Date.now();
                    await database.saveReparacion(r);
                    fixedCount++;
                }
            }

            console.log(`✅ Doctor finalizado. Reparaciones corregidas: ${fixedCount}`);

            if (fixedCount > 0) {
                let msg = `Doctor finalizado.\n- Reparaciones corregidas: ${fixedCount}`;
                if (invalidIds > 0) {
                    msg += `\n- ⚠️ IDs inválidos (no sincronizarán): ${invalidIds}`;
                }
                msg += `\n\nSincronizando automáticamente...`;

                // Trigger sync automatically if possible
                if (typeof syncManager !== 'undefined') {
                    console.log('🔄 Ejecutando sincronización automática post-fix...');
                    syncManager.sync().then(res => {
                        alert(msg + "\n\nSincronización: " + (res.success ? "OK" : "Error"));
                    });
                } else {
                    alert(msg + "\n\nPulsa Sincronizar manualmente.");
                }
            } else {
                console.log('No modifications needed.');
                // Silent success if nothing to fix, to avoid spamming the user on every reload
            }

        } catch (e) {
            console.error('❌ Error fatal del Doctor:', e);
            // alert('Error al ejecutar el Doctor: ' + e.message);
        }
    }
})();
