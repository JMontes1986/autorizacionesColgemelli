# Verificación de tokens CSRF

Esta aplicación genera un token CSRF al iniciar y lo guarda en la cookie `csrf_token` y en una metaetiqueta del documento. El cliente envía ese valor en la cabecera `X-CSRF-Token` en todas las peticiones a Supabase.

## Ejemplo de función en servidor

El siguiente fragmento muestra cómo validar el token en una función de Cloud Function o API Express usando el middleware `functions/verifyCsrf.js`:

```js
const verifyCsrf = require('./verifyCsrf');
const express = require('express');
const app = express();

app.use(verifyCsrf);
app.post('/api/accion', (req, res) => {
  res.json({ ok: true });
});
```

Define la variable de entorno `CSRF_SECRET` con el mismo valor que envía la aplicación para que la verificación sea exitosa.
