# 🚀 Guía de Lanzamiento - ReparApp PRO

¡Enhorabuena! La aplicación está lista para distribución comercial.

## 1. Generar Instalador
Para crear el archivo `.exe` instalable:
1.  Abre una terminal en la carpeta del proyecto.
2.  Ejecuta: `npm run dist`
3.  El instalador estará en la carpeta `dist/`.

> **Nota:** Se ha usado un icono por defecto. Para usar tu propio logo, coloca un archivo `icon.ico` en la raíz del proyecto y edita `package.json` para descomentar `"icon": "icon.ico"`.

## 2. Gestión de Licencias
La aplicación ahora está **PROTEGIDA**. Requiere activación al primer inicio.

### Herramienta del Vendedor
*   **Archivo:** `keygen_tool.html` (ubicado en la raíz del proyecto).
*   **Uso:** Abre este archivo en tu navegador web (Chrome, Edge, etc.).

### Proceso de Venta
1.  El cliente compra una licencia.
2.  Tú abres `keygen_tool.html`.
3.  Introduces el nombre fiscal del cliente (EJ: "Talleres Pepe S.L.").
4.  Generas la Clave de Producto.
5.  Envías al cliente: **El Instalador (.exe)** y **Su Clave**.

## 3. Nube (Google Drive)
Para evitar problemas de cuotas y bloqueos, la configuración de Drive ahora es dinámica.

*   **Para el Cliente:** Si desean copias en la nube, deben configurar su propio proyecto de Google Cloud.
*   **Configuración:** En la App, ir a `Ajustes > Nube` e introducir el `Google Client ID`.
*   [Guía rápida para obtener Client ID](https://developers.google.com/workspace/guides/create-credentials#oauth-client-id)

## 4. Notas Técnicas
*   **Seguridad:** Se ha activado `webSecurity` y bloqueado DevTools en producción en `main.js`.
*   **Limpieza:** Se han eliminado logs de depuración.
*   **Build:** La configuración excluye archivos de desarrollo (`tests`, `.git`, `scratch`).

¡Suerte con las ventas!
