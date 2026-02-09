# ☁️ Guía de Configuración: Sincronización en la Nube

Para que tus clientes puedan consultar el estado de sus reparaciones y tengas copias de seguridad automáticas, necesitas conectar tu aplicación con **Supabase**, un servicio de base de datos seguro y gratuito.

## 1. Crear tu cuenta en Supabase
1. Ve a [supabase.com](https://supabase.com/) y regístrate con tu email o cuenta de GitHub.
2. Haz clic en **"New Project"**.
3. Ponle un nombre (ej. `ReparApp-MiTienda`), elige una contraseña para la base de datos y selecciona la región más cercana a ti.
4. Espera un minuto a que el proyecto se configure.

## 2. Obtener tus Llaves de Conexión
Una vez dentro de tu proyecto:
1. Ve al icono de la rueda (abajo a la izquierda) -> **Project Settings**.
2. Haz clic en **API**.
3. Copia estos dos valores:
   - **Project URL:** (Empieza por `https://...`)
   - **anon public:** (Es una cadena larga de letras y números).

## 3. Configurar las Tablas (Copia y Pega)
Para que la aplicación sepa dónde guardar cada cosa, ve a la sección **SQL Editor** (icono `>_`) en el menú de la izquierda, haz clic en **"New query"** y pega el siguiente código:

```sql
-- Crear tabla de Clientes
CREATE TABLE clientes (
    id UUID PRIMARY KEY,
    nombre TEXT NOT NULL,
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    notas TEXT,
    fecha_creacion BIGINT,
    ultima_modificacion BIGINT
);

-- Crear tabla de Reparaciones
CREATE TABLE reparaciones (
    id UUID PRIMARY KEY,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    descripcion TEXT,
    estado TEXT,
    marca TEXT,
    modelo TEXT,
    imei TEXT,
    solucion TEXT,
    fecha_estimada TIMESTAMPTZ,
    checklist JSONB,
    parts JSONB,
    fecha_creacion BIGINT,
    ultima_modificacion BIGINT
);

-- Crear tabla de Facturas
CREATE TABLE facturas (
    id UUID PRIMARY KEY,
    cliente_id UUID REFERENCES clientes(id),
    numero TEXT,
    total DECIMAL,
    fecha_creacion BIGINT,
    ultima_modificacion BIGINT
);
```
Haz clic en **Run** (Ejecutar). Verás un mensaje de "Success".

## 4. Conectar la Aplicación
1. Abre tu aplicación **ReparApp**.
2. Ve a **Ajustes > Sincronización en Nube**.
3. Pega la URL y la Llave (API Key) que copiaste en el paso 2.
4. Haz clic en **Guardar Configuración**.
5. Pulsa el botón **Sincronizar** en el menú lateral.

---
✅ **¡Listo!** Ahora tus datos están protegidos y tus clientes pueden ver sus reparaciones online.
