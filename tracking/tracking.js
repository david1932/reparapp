
// Configuración de Supabase (Pública / Anon)
const SUPABASE_URL = 'https://yihgvgsajrncsamkwjlq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGd2Z3NhanJuY3NhbWt3amxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTc0MzQsImV4cCI6MjA4NDY3MzQzNH0.BPeBsv2QRU_aWeO5jNWvcbh-66PpVNZ4OgVczEELMJA';

// Inicializar cliente
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: false
    }
});

// Elementos UI
const inputId = document.getElementById('repairId');
const loading = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const resultDiv = document.getElementById('result');

// Verificar si hay ID en la URL al cargar
window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (id) {
        inputId.value = id;
        checkStatus();
    }
};

async function checkStatus() {
    const id = inputId.value.trim();
    if (!id) return;

    // Reset UI
    loading.style.display = 'block';
    errorDiv.style.display = 'none';
    resultDiv.style.display = 'none';

    try {
        // Consultar Supabase
        // SOLO pedimos campos necesarios, nada de datos personales sensibles del cliente
        const { data, error } = await supabase
            .from('reparaciones')
            .select('id, estado, modelo, descripcion, fecha_creacion, precio_final, solucion')
            .eq('id', id)
            .single();

        if (error) {
            console.error(error);
            throw new Error('No se encontró la reparación o hubo un error de conexión.');
        }

        if (data) {
            renderResult(data);
        } else {
            throw new Error('Reparación no encontrada');
        }

    } catch (err) {
        errorDiv.textContent = err.message || 'Error desconocido';
        errorDiv.style.display = 'block';
    } finally {
        loading.style.display = 'none';
    }
}

function renderResult(data) {
    resultDiv.style.display = 'block';

    // Estado con color
    const badge = document.getElementById('statusBadge');
    badge.textContent = data.estado.toUpperCase();
    badge.className = 'status-badge ' + data.estado.toLowerCase();

    // Datos
    document.getElementById('deviceModel').textContent = data.modelo || 'Desconocido';
    document.getElementById('problemDesc').textContent = data.descripcion || '-';

    // Fecha formateada
    if (data.fecha_creacion) {
        const date = new Date(data.fecha_creacion);
        document.getElementById('dateIn').textContent = date.toLocaleDateString();
    }

    // Costo (Solo si está terminado)
    const costRow = document.getElementById('costRow');
    if (data.precio_final || (data.estado === 'listo' || data.estado === 'entregado')) {
        costRow.style.display = 'flex';
        document.getElementById('totalCost').textContent = (data.precio_final || 0) + ' €';
    } else {
        costRow.style.display = 'none';
    }
}
