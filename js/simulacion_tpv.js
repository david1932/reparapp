// Script revisado para simular operaciones de Caja / TPV inyectando datos directamente
async function simularTPV() {
    console.log("Iniciando simulación de Caja / TPV...");

    const db = window.db;
    if (!db) {
        console.error("Base de datos no encontrada. Recarga la página y vuelve a intentarlo.");
        return;
    }

    try {
        // 1. Crear productos de prueba
        console.log("1. Creando productos de prueba...");
        const productosPrueba = [
            { name: 'Cargador Rápido USB-C', price: 15.99, stock: 50, category: 'Accesorios', sku: 'ACC-001' },
            { name: 'Funda Protectora iPhone 15', price: 20.00, stock: 30, category: 'Fundas', sku: 'FUN-015' },
            { name: 'Auriculares Inalámbricos', price: 35.50, stock: 20, category: 'Audio', sku: 'AUD-002' },
            { name: 'Protector de Pantalla Cristal Templado', price: 9.99, stock: 100, category: 'Accesorios', sku: 'ACC-003' }
        ];

        for (const prod of productosPrueba) {
            await db.saveProduct({
                ...prod,
                iva: 21,
                min_stock: 5,
                unit: 'ud'
            });
        }
        console.log("   ✅ Productos creados/actualizados.");

        // Traer productos guardados para usar sus IDs y precios reales
        const todosProductos = await db.getAllActive('products');
        if (todosProductos.length < 2) throw new Error("No se guardaron correctamente los productos.");

        // 2. Abrir la caja
        console.log("\n2. Simulando apertura de caja...");
        const fondoInicial = 100.00;
        await db.addCajaMovement({
            tipo: 'OPEN',
            importe: fondoInicial,
            concepto: 'Fondo de inicio del día (Simulación)',
            fecha: Date.now()
        });
        console.log(`   ✅ Caja abierta con ${fondoInicial} €.`);

        // 3. Simular Venta (Factura + Ingreso en Caja)
        console.log("\n3. Simulando venta...");
        const prod1 = todosProductos[0];
        const prod2 = todosProductos[1];

        const totalVenta = (prod1.price * 1) + (prod2.price * 2);
        const refFactura = 'FAC-SIM-' + Math.floor(Math.random() * 10000);

        await db.saveFactura({
            cliente_id: 'CLIENTE_GENERAL', // Default client
            numero: refFactura,
            fecha: Date.now(),
            lineas: [
                { concepto: prod1.name, cantidad: 1, precio: prod1.price },
                { concepto: prod2.name, cantidad: 2, precio: prod2.price }
            ],
            subtotal: totalVenta / 1.21,
            iva: totalVenta - (totalVenta / 1.21),
            irpf: 0,
            impuestos: 21,
            retencion: 0,
            tax_label: 'IVA',
            ret_label: 'IRPF',
            total: totalVenta,
            notas: 'Venta rápida en TPV (Simulada)'
        });

        await db.addCajaMovement({
            tipo: 'IN',
            importe: totalVenta,
            concepto: 'Venta Efectivo - Tkt: ' + refFactura,
            fecha: Date.now(),
            referencia: refFactura
        });
        console.log(`   ✅ Venta registrada por ${totalVenta.toFixed(2)} €.`);

        // 4. Movimientos Manuales
        console.log("\n4. Simulando ingreso y gasto manual...");
        const ingresoExtra = 250.00;
        await db.addCajaMovement({
            tipo: 'IN',
            importe: ingresoExtra,
            concepto: '[Manual] Venta equipo antiguo no inventariado',
            fecha: Date.now()
        });

        const gastoExtra = 15.50;
        await db.addCajaMovement({
            tipo: 'OUT',
            importe: gastoExtra,
            concepto: '[Manual] Material limpieza tienda',
            fecha: Date.now()
        });
        console.log(`   ✅ Ingreso de ${ingresoExtra} € y Gasto de ${gastoExtra} € registrados.`);

        // 5. Cerrar la caja (simulando que faltan 0.10€)
        console.log("\n5. Simulando cierre de caja...");
        const totalEsperado = fondoInicial + totalVenta + ingresoExtra - gastoExtra;
        const totalDeclarado = totalEsperado - 0.10; // "Faltan" 10 céntimos

        await db.addCajaMovement({
            tipo: 'CLOSE',
            importe: totalDeclarado,
            concepto: 'Cierre de turno. Observación: Faltan 10 céntimos.',
            fecha: Date.now()
        });
        console.log(`   ✅ Caja cerrada. Arqueo declarado: ${totalDeclarado.toFixed(2)} €.`);

        console.log("\n🎉 Simulación completada con éxito DIRECTAMENTE en tu base de datos.");

        // Forzar a la UI a actualizarse si está en la pantalla de TPV
        if (window.posUI) {
            if (typeof window.posUI.renderProducts === 'function') window.posUI.renderProducts();
            if (typeof window.posUI.checkShiftStatus === 'function') window.posUI.checkShiftStatus();
        }

        alert("¡Datos generados correctamente! La pantalla se actualizará para mostrarlos.");

    } catch (error) {
        console.error("Error durante la simulación:", error);
        alert("Ocurrió un error en la simulación: " + error.message);
    }
}

// Para ejecutar la simulación
window.simularTPV = simularTPV;
