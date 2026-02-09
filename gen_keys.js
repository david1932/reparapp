const crypto = require('crypto');
const SECRET_SALT = 'REPARAPP_PREMIUM_LICENSE_V1_KEY_GEN_SALT_992834';

function generateKey(name) {
    const text = name.trim().toUpperCase() + SECRET_SALT;
    const hashHex = crypto.createHash('sha256').update(text).digest('hex').toUpperCase();
    const rawKey = hashHex.substring(0, 16);
    return rawKey.match(/.{1,4}/g).join('-');
}

const names = ['DAVID PEREZ', 'REPARAPP PRO', 'ADMIN', 'DAVID'];
names.forEach(n => {
    console.log(`NAME: ${n} | KEY: ${generateKey(n)}`);
});
