# Configuración de servidor

Para aplicar la política de seguridad también desde el servidor, puedes añadir el encabezado `Content-Security-Policy` en tu configuración de Nginx:

```nginx
add_header Content-Security-Policy "default-src 'self' blob: https://cdn.jsdelivr.net https://cdn.stimulsoft.com https://mbosvnmhnbrslfwlfcxu.supabase.co https://*.sharepoint.com https://*.1drv.ms; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.stimulsoft.com; style-src 'self' 'unsafe-inline'; frame-src 'none'; frame-ancestors 'self'; connect-src 'self' blob: https://mbosvnmhnbrslfwlfcxu.supabase.co;" always;
```

Ajusta los dominios según tus necesidades. Esta cabecera incluye `frame-ancestors` para restringir quién puede embeber el sitio.

También debes definir `X-Frame-Options` como cabecera HTTP. Un ejemplo básico:

```nginx
add_header X-Frame-Options "DENY" always;
```

Con ello evitarás advertencias del navegador porque la metaetiqueta ha sido eliminada del HTML.
