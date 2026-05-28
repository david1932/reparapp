# GUÍA DEL VENDEDOR - REPARAPP PRO

Esta guía explica cómo gestionar las licencias, generar claves para tus clientes y controlar la seguridad de tu aplicación.

## 1. El Proceso de Venta (Paso a Paso)

Tu aplicación está protegida por **Hardware ID** (Huella Digital). Esto significa que una clave solo funciona en EL ORDENADOR ESPECÍFICO donde se va a usar. No pueden copiarla y pegarla en otro sitio.

### Paso A: El Cliente instala la App
1. El cliente instala y abre la aplicación.
2. Verá una pantalla que dice "Periodo de Prueba" o "Sin Licencia".
3. En esa pantalla aparece un código llamado **ID DE EQUIPO** (Ejemplo: `a1b2-c3d4`).
4. **El cliente debe enviarte ese código** (por WhatsApp, email, etc.) junto con el pago.

### Paso B: Tú generas la Clave (KeyGen)
1. Ve a la carpeta de tu proyecto (donde tienes el código).
2. Haz doble click en el archivo `keygen_tool.html` para abrirlo en tu navegador (Chrome/Edge).
3. Rellena los datos:
   - **Nombre Empresa:** El nombre de tu cliente (Ej: "Talleres Manolo").
   - **ID de Equipo:** El código que te mandó el cliente.
4. Pulsa **GENERAR CLAVE**.
5. Copia el código largo que aparece.

### Paso C: Activación
1. Envía la clave al cliente.
2. El cliente la introduce en la app.
3. ¡Listo! La app queda activada por **365 días** exactos desde ese momento.

---

## 2. ¿Cómo funciona la Caducidad (365 días)?

La aplicación tiene un "reloj interno" de seguridad:

1. **Al Activar:** La app guarda la fecha actual en un archivo secreto y encriptado dentro del navegador del usuario.
2. **Cada día:** La app comprueba silenciosamente: `¿Fecha Hoy - Fecha Activación > 365?`.
3. **El día 366:** La app borra automáticamente la licencia, muestra un mensaje de "Licencia Expirada" y bloquea el acceso hasta que se introduzca una nueva clave de renovación.

> **Nota:** Como los datos están encriptados, el cliente no puede "hackear" el archivo para cambiarse la fecha manualmente.

---

## 3. Seguridad Online (Anti-Fraude)

Además de la caducidad automática, tienes un **Botón de Pánico** en la nube (Supabase).

Si descubres que alguien te ha engañado, ha devuelto el recibo del pago, o quieres bloquearle el acceso ANTES del año:

1. Entra a tu panel de **Supabase** -> **Table Editor**.
2. Abre la tabla `banned_licenses`.
3. Añade una nueva fila con la clave de licencia de ese cliente.
4. **Resultado:** La próxima vez que ese cliente abra la app con internet activado, el sistema detectará el bloqueo y destruirá su licencia remotamente.
