# autorizacionesColgemelli
Sistema de control de salidas estudiantiles - Colegio Gemelli

## Seguridad

La política de seguridad se definió con el encabezado estándar `Content-Security-Policy`.
Se permite `blob:` en `default-src` y `connect-src` para habilitar descargas de CSV
generadas con `URL.createObjectURL()`.
Se agregó `https://colgemelli-my.sharepoint.com` a `default-src` para mostrar fotos almacenadas en OneDrive.
