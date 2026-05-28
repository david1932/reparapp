const licenseHandler = require('../src/main/license-handler');

async function generate() {
    await licenseHandler.init();
    const hwid = licenseHandler.getHardwareId();
    console.log('------------------------------------------------');
    console.log('HARDWARE ID:', hwid);
    console.log('------------------------------------------------');

    // Generate for "Admin User"
    const name = "Admin";
    const code = licenseHandler.generateActivationCode(name, hwid);

    console.log(`EMPRESA: ${name}`);
    console.log(`CLAVE:   ${code}`);
    console.log('------------------------------------------------');
}

generate();
