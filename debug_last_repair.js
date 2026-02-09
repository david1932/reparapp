/**
 * DEBUG LAST REPAIR SCRIPT
 * Intenta subir la última reparación y muestra el error EXACTO.
 */
(function debugSync() {
    console.log('🐞 Debugger script cargado.');

    // Wait for DB and Supabase
    const interval = setInterval(async () => {
        // Check global variables directly
        let dbRef = window.db;
        let sbRef = window.supabaseClient;

        // Try to find them if not on window
        if (!dbRef && typeof db !== 'undefined') dbRef = db;
        if (!sbRef && typeof supabaseClient !== 'undefined') sbRef = supabaseClient;

        if (dbRef && dbRef.isReady && sbRef) {
            clearInterval(interval);
            console.log('🐞 Dependencias listas. Ejecutando test...');

            // Small delay to ensure UI is ready
            setTimeout(() => runDebug(dbRef, sbRef), 1000);
        }
    }, 500);

    // Timeout safety
    setTimeout(() => {
        clearInterval(interval);
        // If it hasn't run, force alert
        if (!window.hasDebugged) {
            console.warn('🐞 Debugger timeout waiting for DB/Supabase.');
        }
    }, 10000);

    async function runDebug(database, supabase) {
        window.hasDebugged = true;

        try {
            // 1. Get latest repair
            const reparaciones = await database.getAllReparaciones();
            if (!reparaciones || reparaciones.length === 0) {
                alert('🐞 Debug: No hay reparaciones locales.');
                return;
            }

            // Sort by creation date desc
            reparaciones.sort((a, b) => {
                const tA = new Date(a.fecha_creacion).getTime();
                const tB = new Date(b.fecha_creacion).getTime();
                return tB - tA;
            });

            const lastRepair = reparaciones[0];

            // 2. Prepare payload exactly like sync_secure.js
            const cleanPayload = {
                id: lastRepair.id,
                cliente_id: lastRepair.cliente_id,
                estado: lastRepair.estado,
                descripcion: lastRepair.descripcion || '',
                // FORCE NUMBER (BIGINT)
                fecha_creacion: new Date(lastRepair.fecha_creacion).getTime(),
                ultima_modificacion: Date.now()
            };

            // Optional fields
            if (lastRepair.marca) cleanPayload.marca = lastRepair.marca;
            if (lastRepair.modelo) cleanPayload.modelo = lastRepair.modelo;
            if (lastRepair.imei) cleanPayload.imei = lastRepair.imei;
            if (lastRepair.solucion) cleanPayload.solucion = lastRepair.solucion;

            if (lastRepair.fecha_estimada) {
                const d = new Date(lastRepair.fecha_estimada);
                if (!isNaN(d.getTime())) cleanPayload.fecha_estimada = d.toISOString();
            }

            if (lastRepair.checklist) cleanPayload.checklist = lastRepair.checklist;
            // REMOVED PARTS temporarily to isolate issue
            // if (lastRepair.parts) cleanPayload.parts = lastRepair.parts;

            // 3. Check Client
            let clientStatus = "Desconocido";
            if (cleanPayload.cliente_id) {
                try {
                    const client = await supabase.getCliente(cleanPayload.cliente_id);
                    if (client) {
                        clientStatus = "✅ Existe en Nube";
                    } else {
                        clientStatus = "⚠️ NO EXISTE en Nube (Intentando subir...)";
                        const localClient = await database.getCliente(cleanPayload.cliente_id);
                        if (localClient) {
                            // CLEAN CLIENT PAYLOAD
                            const cleanClient = {
                                id: localClient.id,
                                nombre: localClient.nombre,
                                telefono: localClient.telefono || '',
                                email: localClient.email || '',
                                direccion: localClient.direccion || '',
                                notas: localClient.notas || '',
                                fecha_creacion: new Date(localClient.fecha_creacion).getTime(),
                                ultima_modificacion: Date.now()
                            };

                            if (localClient.apellido && !cleanClient.nombre.includes(localClient.apellido)) {
                                cleanClient.nombre = `${cleanClient.nombre} ${localClient.apellido}`.trim();
                            }

                            await supabase.upsertCliente(cleanClient);
                            clientStatus = "✅ Subido ahora mismo (CLEAN)";
                        } else {
                            clientStatus = "❌ NO EXISTE local ni en nube (Error FK)";
                        }
                    }
                } catch (e) {
                    clientStatus = "Error check cliente: " + e.message;
                }
            }

            // 4. Try Upload
            alert(`🐞 DEBUG PRE-UPLOAD\n\nReparación: ${cleanPayload.id}\nEstado Cliente: ${clientStatus}\n\nIntentando subir ahora...`);

            const result = await supabase.upsertReparacion(cleanPayload);

            alert(`🐞 RESULTADO FINAL: ¡ÉXITO!\n\nID: ${result.id}\nModelo: ${result.modelo}`);

        } catch (error) {
            console.error('🐞 DATA:', error);
            alert(`🐞 ERROR FATAL:\n\n${error.message}`);
        }
    }
})();
