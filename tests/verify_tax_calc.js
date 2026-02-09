
// Simulation of the App's Logic
function calculateInvoice(subtotal, ivaRate, irpfRate) {
    const iva = subtotal * (ivaRate / 100);
    const irpf = subtotal * (irpfRate / 100);
    // Logic: Total = Base + IVA - IRPF
    const total = subtotal + iva - irpf;

    return {
        subtotal: subtotal.toFixed(2),
        ivaRate: ivaRate + '%',
        ivaAmount: iva.toFixed(2),
        irpfRate: irpfRate + '%',
        irpfAmount: irpf.toFixed(2),
        total: total.toFixed(2)
    };
}


// Test 1: Caso Estándar (Autónomo Veterano)
// 100€ + 21% IVA - 15% IRPF
const t1 = calculateInvoice(100, 21, 15);
if (t1.total === '106.00') console.log("✅ CORRECTO");
else console.error("❌ ERROR");

// Test 2: Caso Nuevo Autónomo
// 1000€ + 21% IVA - 7% IRPF
const t2 = calculateInvoice(1000, 21, 7);
if (t2.total === '1140.00') console.log("✅ CORRECTO");
else console.error("❌ ERROR");

// Test 3: Caso Sin Impuestos (Reparación simple a particular, sin IRPF)
// 50€ + 21% IVA - 0% IRPF
const t3 = calculateInvoice(50, 21, 0);
if (t3.total === '60.50') console.log("✅ CORRECTO");
else console.error("❌ ERROR");

// Test 4: Caso Internacional (Custom Tax)
// 100€ + 12.5% Tax - 0% Retention
const t4 = calculateInvoice(100, 12.5, 0);
if (t4.total === '112.50') console.log("✅ CORRECTO (Internacional)");
else console.error("❌ ERROR (Internacional)");


