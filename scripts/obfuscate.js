const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

// Configuration: Files to obfuscate
const TARGETS = [
    { path: 'main.js', type: 'node' },
    { path: 'src/main/license-handler.js', type: 'node' },
    { path: 'preload.js', type: 'node' },
    { path: 'js/license-manager.js', type: 'browser' },
    { path: 'js/security_manager.js', type: 'browser' },
    { path: 'js/database.js', type: 'browser' },
    { path: 'js/ui/auth.js', type: 'browser' },
    { path: 'js/ui/pos.js', type: 'browser' },
    { path: 'js/ui/repairs_v2.js', type: 'browser' },
    { path: 'js/ui/inventory.js', type: 'browser' },
    { path: 'js/ui/invoices.js', type: 'browser' },
    { path: 'js/ui/navigation.js', type: 'browser' }
];

// Obfuscation Options (High Security but Performance Safe)
const OPTIONS = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: true,
    debugProtectionInterval: 2000,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false, // SAFE MODE: Don't break cross-file dependencies
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    stringArray: true,
    stringArrayEncoding: ['rc4'],
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
};

function obfuscateFile(filePath) {
    const fullPath = path.join(__dirname, '..', filePath);

    if (!fs.existsSync(fullPath)) {
        console.error(`❌ File not found: ${filePath}`);
        return;
    }

    console.log(`🔒 Obfuscating: ${filePath}...`);

    try {
        const sourceCode = fs.readFileSync(fullPath, 'utf8');

        const obfuscationResult = JavaScriptObfuscator.obfuscate(sourceCode, {
            ...OPTIONS,
            // Generic target options
            target: filePath.includes('preload') ? 'browser-no-eval' :
                (filePath.includes('js/') ? 'browser' : 'node')
        });

        const obfuscatedCode = obfuscationResult.getObfuscatedCode();

        // Backup original (optional, maybe unsafe for production build pipeline to leave it there)
        // fs.writeFileSync(fullPath + '.bak', sourceCode);

        // Overwrite file
        fs.writeFileSync(fullPath, obfuscatedCode);

        console.log(`✅ Secured: ${filePath}`);
    } catch (error) {
        console.error(`⚠️ Error obfuscating ${filePath}:`, error.message);
    }
}

console.log('🛡️  STARTING SECURITY OBFUSCATION  🛡️');
TARGETS.forEach(t => obfuscateFile(t.path));
console.log('🏁  OBFUSCATION COMPLETE  🏁');
