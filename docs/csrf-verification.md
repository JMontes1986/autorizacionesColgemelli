# Verificación de tokens CSRF

Esta aplicación genera un token CSRF al iniciar y lo guarda en la cookie `csrf_token` y en una metaetiqueta del documento. El cliente envía ese valor en la cabecera `X-CSRF-Token` en todas las peticiones a Supabase.

## Ejemplo de función en servidor

El siguiente fragmento muestra un ejemplo básico de middleware en Express para validar el token. Puedes adaptarlo en tu servidor o función de Cloud Function:

```js
const express = require('express');
const app = express();

function verifyCsrf(req, res, next) {
  const token = req.get('X-CSRF-Token');
  if (token !== process.env.CSRF_SECRET) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
}

app.use(verifyCsrf);
app.post('/api/accion', (req, res) => {
  res.json({ ok: true });
});
```

Define la variable de entorno `CSRF_SECRET` con el mismo valor que envía la aplicación para que la verificación sea exitosa.
