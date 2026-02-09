const fs = require('fs');
const JSZip = require('jszip');

async function analyzeZip() {
    try {
        const data = fs.readFileSync('backup_reparalo.zip');
        const zip = await JSZip.loadAsync(data);

        zip.forEach((relativePath, file) => {
        });

        // Check specific files implies by settings.js logic
        if (zip.file("metadata.json")) console.log("Has metadata.json (Potential Hybrid/Android)");
        if (zip.file("backup_data.json")) console.log("Has backup_data.json (New Format)");
        if (zip.file("data/clientes.csv")) console.log("Has data/clientes.csv (Web Advanced)");
        if (zip.file("clientes.csv")) console.log("Has clientes.csv (Root CSV)");

    } catch (e) {
        console.error("Error reading zip:", e);
    }
}

analyzeZip();
