# autorizacionesColgemelli
Sistema de control de salidas estudiantiles - Colegio Gemelli

## Seguridad

La política de seguridad se definió con el encabezado estándar `Content-Security-Policy`.
La metaetiqueta del HTML ya no incluye la directiva `frame-ancestors`.
Configura tu servidor web para enviar la cabecera `Content-Security-Policy` con `frame-ancestors` y así controlar quién puede embeber la página.
La protección `X-Frame-Options` también debe enviarse como cabecera HTTP y no mediante una metaetiqueta. Asegúrate de definirla en tu servidor.
Se permite `blob:` en `default-src` y `connect-src` para habilitar descargas de CSV
generadas con `URL.createObjectURL()`. Además, se añadió la directiva `worker-src 'self' blob:`
para compatibilidad con bibliotecas que crean Web Workers.
Se agregó `https://colgemelli-my.sharepoint.com` a `default-src` para mostrar fotos almacenadas en OneDrive.

## Prerrequisitos

1. **Node.js >=18**.
2. Ejecuta `npm install` para instalar las dependencias necesarias.
Copia el archivo de ejemplo `env.example.js` a `env.js` y personaliza los valores.
   Este archivo está listado en `.gitignore` para evitar subir credenciales.
# Manual de Usuario y Referencia Técnica: Sistema Web de Autorización de Salidas - Colegio Gemelli

## 1. Descripción General

El sistema web permite la gestión de autorizaciones de salida de estudiantes en el Colegio Gemelli. El sistema incluye varios archivos HTML principales:

- **index.html**: Interfaz principal del sistema.
- **diagnostico.html**: Herramientas para pruebas de conectividad y depuración.
**dashboard.html**: Vista alternativa para análisis estadístico.
Las funcionalidades incluyen autenticación, panel de control, autorizaciones, administración de datos y auditoría.

Antes de abrir `index.html` o `diagnostico.html` debes contar con un archivo `env.js` en la raíz del proyecto. Puedes generarlo ejecutando `./build.sh` o copiando `env.example.js` y ajustando sus valores. La lógica principal reside ahora en `app.js`, que se carga de forma externa junto a los HTML.

## 2. Estructura del Proyecto

```
autorizacionesColgemelli/
├─ index.html         # Aplicación principal
├─ diagnostico.html   # Herramientas de diagnóstico
├─ dashboard.html     # Nuevo dashboard de análisis
├─ styles.css         # Estilos principales del sistema
├─ app.js             # Lógica de la aplicación
└─ README.md          # Documentación breve
```

El archivo `styles.css` contiene la hoja de estilos que define la apariencia de la aplicación. En `index.html` se incluye mediante la etiqueta `<link rel="preload" href="styles.css" as="style" onload="this.rel='stylesheet'">` y un bloque `<noscript>` para asegurar que el CSS se cargue incluso si JavaScriptno está disponible. Mantén este archivo junto al HTML para que la interfaz se muestre correctamente.


## 3. Tecnologías Utilizadas

- **HTML, CSS y JavaScript** para la interfaz y lógica.
- **Supabase** como backend (Base de datos, autenticación y almacenamiento).
- **Chart.js** para visualización de datos.
- **Desafío aritmético** para evitar bots.
- **CryptoJS** para manejo de contraseñas.

## Variables de Entorno Requeridas

Antes de construir o desplegar la aplicación se deben definir las siguientes variables de entorno:

- `SUPABASE_URL` – URL de tu instancia de Supabase.
- `SUPABASE_ANON_KEY` – clave anónima pública del proyecto.

Estas variables se utilizan durante el proceso de construcción para generar un archivo `env.js` que queda disponible en tiempo de ejecución.
En la raíz del repositorio también se provee `env.example.js` con valores de ejemplo. Puedes copiarlo como `env.js` y reemplazar los datos por los de tu proyecto si prefieres configurarlo manualmente.
Para preparar el entorno local sigue los pasos:

1. Exporta las variables en tu terminal:

   ```bash
   export SUPABASE_URL="<tu-url>"
   export SUPABASE_ANON_KEY="<tu-anon-key>"
   ```

2. Ejecuta el script de construcción que generará `env.js`:

   ```bash
   ./build.sh
   ```

3. Asegúrate de que el archivo `env.js` se haya creado en la raíz del proyecto antes de abrir `index.html` en tu navegador.
4. Ejecuta el script de base de datos `supabase/schema.sql` en tu instancia de Supabase. Además de actualizar las tablas existentes, este script creará la nueva tabla `audit_logs`. Vuelve a ejecutarlo cada vez que hagas pull y aparezcan columnas nuevas.
5. Aplica las políticas RLS ejecutando `supabase/policies.sql` desde la CLI o la consola SQL de Supabase.
## 4. index.html: Descripción Funcional

### 4.1 Inicio de Sesión

- Ubicado en el elemento `#loginSection`.
- Presenta un pequeño desafío aritmético y validaciones básicas.
- Llama a la función `login()` para validar credenciales con Supabase.
- Registra eventos en `audit_logs` con `logSecurityEvent()`.

### 4.2 Configuración de Supabase

```js
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
});
```

### 4.3 Panel de Control (Dashboard)

- Se activa tras la autenticación con `showSection('dashboard')`.
- Se carga información estadística con `loadDashboard()`.
- Se visualiza usando Chart.js con fallback por si falla la librería.

### 4.4 Módulos

- **Autorizaciones**: Confirmar o denegar salidas.
- **Verificaciones**: Revisar salidas autorizadas.
- **Administración**: Gestionar estudiantes, motivos, grados y usuarios.
- **Historial**: Consultar eventos pasados.

### 4.5 Seguridad

- Sanitización de HTML para evitar XSS.
- Rate limiting centralizado en Supabase mediante la tabla `login_attempts`.
- Encabezados CSP definidos en el HTML.

Para ejecutar correctamente estas herramientas necesitas un archivo `env.js` con
tus credenciales de Supabase. Genera este archivo ejecutando:

```bash
SUPABASE_URL=https://tu-proyecto.supabase.co \
SUPABASE_ANON_KEY=clave_publica ./build.sh
```
Si lo prefieres, copia `env.example.js` a `env.js` y edita los valores manualmente.

Coloca `env.js` junto a `diagnostico.html` y abre el archivo en tu navegador.
Allí podrás introducir manualmente un correo y contraseña válidos para las
pruebas de login.

## 5. diagnostico.html: Herramientas de Verificación

Incluye pruebas de conectividad divididas en pasos:

```html
<h3>📋 Pasos de Diagnóstico:</h3>
<button onclick="step1()">1. Verificar URLs</button>
<button onclick="step2()">2. Probar Conexión</button>
<button onclick="step3()">3. Verificar Tablas</button>
<button onclick="step4()">4. Verificar Usuarios</button>
<button onclick="step5()">5. Probar Login</button>
```

Cada función emplea llamadas a Supabase y muestra resultados en un log visible.

---

## 6. Conceptos Clave

- **Supabase**: Provee almacenamiento, autenticación y consultas.
- **Chart.js**: Visualiza gráficos. Compatible con fallback si no se carga correctamente.
- **Autenticación y Seguridad**: Protegida por un desafío aritmético y CryptoJS.
- **Auditoría**: Registro de eventos importantes como inicios de sesión o fallos.

---

## 7. Diagrama de Flujo: Autenticación y Panel

```mermaid
flowchart TD
    A[Usuario abre app] --> B[Ingresa login + desafío]
    B --> C[Validación de datos y desafío]
    C -->|Correcto| D[Autenticación con Supabase]
    D -->|Éxito| E[Mostrar Dashboard]
    D -->|Fallo| F[Mostrar Error + Registro en audit_logs]
```

---

## 8. Recomendaciones para Desarrolladores

- Revisar tablas en Supabase: campos, relaciones y validaciones.
- Profundizar en **JavaScript moderno** (promesas, async/await).
- Aprender sobre **DOM** y **manipulación segura de HTML**.
- Consultar documentación oficial de Chart.js y Supabase.
- Usar `diagnostico.html` ante cualquier error o desconexión inesperada.
- Revisa `docs/CLS_NOTES.md` para ubicar funciones que modifican el DOM y pueden afectar el **Cumulative Layout Shift**.
---

## 9. Consideraciones de Seguridad Adicional

- Se recomienda eliminar scripts inline y moverlos a archivos externos.
- Aplicar Subresource Integrity (SRI) a librerías externas.
- Implementar tokens CSRF efectivos para formularios críticos.
Consulta `docs/csrf-verification.md` para configurar la verificación del token en tu servidor.
- El login debe migrarse a validación en servidor para evitar exponer hashes.

---

## 10. Contacto y Soporte

Para soporte técnico o solicitudes de mejora, contactar al equipo de desarrollo de TI del Colegio Gemelli.

## 11. Políticas de Supabase y RLS

Para impedir que la clave pública anónima acceda a tablas sensibles, habilita Row Level Security (RLS) y define políticas que solo permitan operaciones a usuarios autenticados.

1. Activa RLS en `usuarios`:
   ```sql
   alter table public.usuarios enable row level security;
   ```
2. Otorga permisos solo a roles autenticados (cualquier rol distinto de `anon`):
   ```sql
   create policy "usuarios_read_authenticated" on public.usuarios
     for select
     using (auth.role() <> 'anon');

  create policy "usuarios_insert_authenticated" on public.usuarios
     for insert
     with check (auth.role() <> 'anon');

   create policy "usuarios_update_authenticated" on public.usuarios
     for update
     with check (auth.role() <> 'anon');

   create policy "usuarios_delete_authenticated" on public.usuarios
     for delete
     using (auth.role() <> 'anon');
   ```

El archivo [`supabase/policies.sql`](supabase/policies.sql) contiene estas instrucciones para aplicarlas desde la CLI o la consola SQL de Supabase.

### Tabla `llegadas_tarde`
1. Habilita RLS:
   ```sql
   alter table public.llegadas_tarde enable row level security;
   ```
2. Aplica las políticas de lectura, escritura y eliminación solo a usuarios autenticados.
   Las sentencias completas se encuentran en [`supabase/policies.sql`](supabase/policies.sql).

Para permitir el acceso de solo lectura al dashboard sin autenticación,
   se agregó la política `llegadas_tarde_read_anon` que autoriza
   `auth.role() = 'anon'`.
Si la aplicación se ejecuta solo con la clave anónima y sin autenticación,
debés adaptar la política o habilitar el inicio de sesión en Supabase;
de lo contrario los `insert` fallarán.
### Tabla `autorizaciones_salida`
1. Habilita RLS:
   ```sql
   alter table public.autorizaciones_salida enable row level security;
   ```
2. Aplica las políticas de lectura, escritura y eliminación solo a usuarios autenticados.
   Las sentencias completas se encuentran en [`supabase/policies.sql`](supabase/policies.sql).

Para permitir el acceso de solo lectura al dashboard sin autenticación,
   se agregó la política `autorizaciones_salida_read_anon` que autoriza
   `auth.role() = 'anon'`.
Si la aplicación se ejecuta solo con la clave anónima y sin autenticación,
debés adaptar la política o habilitar el inicio de sesión en Supabase;
de lo contrario los `insert` fallarán.

### Tabla `audit_logs`
1. Habilita RLS:
   ```sql
   alter table public.audit_logs enable row level security;
   ```
2. Aplica las políticas de lectura y escritura solo a usuarios autenticados.
   Las sentencias correspondientes se encuentran en [`supabase/policies.sql`](supabase/policies.sql).
## 12. Ejecutar pruebas
Antes de ejecutar las pruebas instala las dependencias con:

```bash
npm install
```
Luego ejecuta la suite con:

```bash
npm test
```

Para validar la estructura basica de `index.html` puedes correr de forma opcional:

```bash
node layout-test.js
```

## 13. Solución de problemas

1. **Generar `env.js`**
   Ejecuta `./build.sh` con las variables `SUPABASE_URL` y `SUPABASE_ANON_KEY` exportadas. El script genera un archivo `env.js` que debe ubicarse junto a `index.html` y `diagnostico.html` para que ambas páginas carguen las credenciales de Supabase correctamente.
2. **Actualizar URLs con tu dominio de Supabase**
   `index.html` contiene el dominio `mbosvnmhnbrslfwlfcxu.supabase.co` en dos ubicaciones:
   - la meta etiqueta `Content-Security-Policy` (alrededor de la linea 8)
   - la etiqueta `<img>` del logo (alrededor de la linea 127)

   Reemplaza ese dominio por el de tu instancia de Supabase. Por ejemplo:

   ```html
   <!-- CSP -->
   <meta http-equiv="Content-Security-Policy" content="default-src 'self' blob: https://cdn.jsdelivr.net https://<tuinstancia>.supabase.co ...; worker-src 'self' blob:">
   
   <!-- Logo -->
   <img class="logo" src="https://<tuinstancia>.supabase.co/storage/v1/object/sign/...">
   ```
3. **Verificar conectividad**
Después de generar `env.js`, abre `diagnostico.html` en tu navegador. Utiliza los botones numerados para comprobar las URLs, las tablas y el inicio de sesión. Los resultados de cada paso se muestran en el área de log.

## 14. Consideraciones de CLS
Consulta [docs/CLS_NOTES.md](docs/CLS_NOTES.md) para conocer las funciones que generan cambios de layout y cómo mitigarlos.

## Información de Versión
El número de versión de la aplicación se toma del campo `version` de `package.json` y el número de compilación corresponde al conteo de *commits* en el repositorio. El archivo `version.js` se crea automáticamente al instalar las dependencias (`npm install`) o al ejecutar `./build.sh`, por lo que no se incluye en el control de versiones. `index.html` muestra estos valores de forma automática en el pie de página.
