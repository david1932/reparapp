-- COPIA Y PEGA ESTO EN EL "SQL EDITOR" DE SUPABASE

-- Añadir columnas que faltan en la tabla REPARACIONES
ALTER TABLE reparaciones ADD COLUMN IF NOT EXISTS modelo text;
ALTER TABLE reparaciones ADD COLUMN IF NOT EXISTS marca text;
ALTER TABLE reparaciones ADD COLUMN IF NOT EXISTS imei text;
ALTER TABLE reparaciones ADD COLUMN IF NOT EXISTS solucion text;
ALTER TABLE reparaciones ADD COLUMN IF NOT EXISTS precio_final numeric;
ALTER TABLE reparaciones ADD COLUMN IF NOT EXISTS fecha_estimada timestamptz;
ALTER TABLE reparaciones ADD COLUMN IF NOT EXISTS checklist jsonb;
ALTER TABLE reparaciones ADD COLUMN IF NOT EXISTS parts jsonb;

-- Asegurar que la tabla CLIENTES tenga todo (por si acaso)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS dni text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS notas text;

-- Habilitar acceso público (si no lo estaba)
ALTER TABLE reparaciones ENABLE ROW LEVEL SECURITY;

-- Política para que cualquiera pueda LEER (select) la tabla reparaciones
-- (Esto es necesario para que el Tracking funcione sin login)
CREATE POLICY "Public Access for Tracking" ON reparaciones
FOR SELECT USING (true);
