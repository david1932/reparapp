# Guía Oficial de Conexión de Impresoras Térmicas (ReparApp Premium - Windows)

Esta guía explica detalladamente cómo conectar, configurar e instalar los controladores (drivers) de cualquier impresora de tickets/etiquetas térmica en Windows 10 y 11 para su funcionamiento directo con ReparApp.

---

## 🛠️ Método 1: Impresoras USB (Conexión Local / System Default)

Las impresoras de tickets USB (como POS-58, POS-80 o marcas como Epson, Star, Bixolon, Zjiang) requieren un driver instalado en Windows para que el sistema reconozca su cola de impresión.

### Paso 1: Instalar el Driver del Fabricante o el Genérico de Windows
1. Conecta la impresora al puerto USB del equipo y enciéndela.
2. Si tienes el disco o instalador del fabricante (ej. Zjiang POS Printer Driver), ejecútalo seleccionando el ancho de papel correcto (**58mm** o **80mm**).
3. **Alternativa Genérica (Sin driver del fabricante)**:
   - ReparApp incluye un script automatizado para instalar el driver genérico de texto de Windows.
   - Ejecuta como administrador el archivo ubicado en: `scripts/instalar_impresora_generica.ps1`.
   - Esto creará una impresora llamada `Impresora_Termica_POS` lista para recibir datos en texto plano ESC/POS.

### Paso 2: Identificar el Nombre en Windows
1. Abre el panel de control: **Configuración > Dispositivos > Impresoras y escáneres**.
2. Anota el nombre exacto de tu impresora (ej. `XP-80C`, `POS-58`, o `Impresora_Termica_POS`).
3. Ve a los **Ajustes** de ReparApp, escribe ese nombre en el campo **Nombre Impresora Tickets** (o Etiquetas) y guarda.

---

## 📶 Método 2: Impresoras WiFi / Ethernet (Red Local TCP/IP)

Este método es el más robusto, ya que **no requiere ningún driver** en la PC. ReparApp se comunica directamente enviando comandos binarios ESC/POS a través de sockets de red.

### Paso 1: Configurar la IP en la Impresora
1. Asegúrate de que la impresora esté conectada al mismo router/red local que la computadora (mediante cable Ethernet o WiFi).
2. Obtén la dirección IP asignada a la impresora (la mayoría imprime un ticket de diagnóstico al encenderse manteniendo pulsado el botón **Feed**).
3. La IP de la impresora debe estar en el mismo rango de red que tu PC (ej. `192.168.1.100`).

### Paso 2: Configurar en ReparApp
1. En ReparApp, ve a **Ajustes**.
2. Cambia el tipo de conexión a **WiFi (TCP/IP)**.
3. Introduce la **IP de la Impresora** y el **Puerto** (por defecto en el 99% de las impresoras térmicas es el **9100**).
4. Guarda los ajustes. La app enviará los tickets instantáneamente por la red.

---

## 🔵 Método 3: Impresoras Bluetooth (Puertos COM Virtuales)

Las impresoras portátiles Bluetooth se comunican en Windows mapeando un puerto serie virtual (COM).

### Paso 1: Vincular por Bluetooth
1. En Windows, ve a **Configuración > Dispositivos > Bluetooth > Agregar dispositivo**.
2. Selecciona la impresora térmica en la lista (suele llamarse `MPT-II`, `POS-58` o similar) e introduce el código de emparejamiento (típicamente `0000` o `1234`).

### Paso 2: Averiguar el puerto COM asignado
1. En la ventana de configuración de Bluetooth de Windows, haz clic en **Más opciones de Bluetooth** (o propiedades de hardware del dispositivo).
2. Ve a la pestaña **Puertos COM**.
3. Identifica qué puerto de **Salida (Outgoing)** se le asignó a tu impresora (por ejemplo, `COM3` o `COM4`).

### Paso 3: Configurar en ReparApp
1. En ReparApp, ve a **Ajustes**.
2. Cambia el tipo de conexión a **Bluetooth COM**.
3. En el campo **Puerto COM de la Impresora**, escribe la ruta del puerto asignado en Windows en mayúsculas (ej. `\\.\COM3` o simplemente `COM3`).
4. Guarda los ajustes. ReparApp enviará los bytes directamente a la impresora mediante el canal Bluetooth virtualizado.

---

## 🖨️ Estilos y Fuentes Recomendadas
Para la impresión en A4 o etiquetas a través del sistema operativo, se recomiendan fuentes de ancho fijo o tipografías muy legibles para que no se descuadren los datos:
- **Courier New** (Ancho fijo, excelente para plantillas de texto).
- **Consolas** (Soporta múltiples glifos y símbolos especiales).
- **Arial / Inter** (Para tickets A4 con estilos corporativos limpios).
