const crypto = require('crypto');
const { execSync } = require('child_process');
const os = require('os');

// Configuration
const SECRET = 'REPARAPP_MASTER_SECRET_2024';
const COMPANY_NAME = "Admin";

function getHardwareId() {
    try {
        // Windows specific: Get Disk Serial + CPU ID
        // Note: This matches the logic in license-handler.js EXACTLY
        const diskSerial = execSync('wmic diskdrive get serialnumber').toString().replace(/\s+/g, '').replace('SerialNumber', '');
        const cpuId = execSync('wmic cpu get processorid').toString().replace(/\s+/g, '').replace('ProcessorId', '');

        const rawId = `${os.hostname()}-${cpuId}-${diskSerial}`;
        return crypto.createHash('sha256').update(rawId).digest('hex').substring(0, 16).toUpperCase();
    } catch (e) {
        console.error('HWID Error:', e);
        // Fallback: uses machine-id logic
        return crypto.createHash('sha256').update(os.hostname() + os.platform() + os.arch()).digest('hex').substring(0, 16).toUpperCase();
    }
}

function generateActivationCode(name, hwid) {
    const data = `${name}|${hwid}`;
    return crypto.createHmac('sha256', SECRET)
        .update(data)
        .digest('hex')
        .substring(0, 24)
        .toUpperCase()
        .match(/.{1,4}/g)
        .join('-'); // Format: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
}

const hwid = getHardwareId();
const key = generateActivationCode(COMPANY_NAME, hwid);

console.log('------------------------------------------------');
console.log(`HARDWARE ID: ${hwid}`);
console.log(`EMPRESA:     ${COMPANY_NAME}`);
console.log(`CLAVE:       ${key}`);
console.log('------------------------------------------------');
