
(async () => {
    try {
        const db = new Database(); // Assuming Database class is globally available
        await db.init();

        const lastSync = await db.getConfig('last_sync') || 0;

        const modClientes = await db.getClientesModifiedAfter(0); // Check ALL modified

        const modRepairs = await db.getReparacionesModifiedAfter(0);

        const modFacturas = await db.getFacturasModifiedAfter(0);

        // Check actual deleted items
        const deletedClientes = modClientes.filter(c => c.deleted);

        if (modClientes.length > 0) {
        }

    } catch (e) {
        console.error('Debug Error:', e);
    }

    function isValidUUID(id) {
        const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return regex.test(id);
    }
})();
