# Guía rápida de CLS

Este proyecto manipula el DOM de forma dinámica en varias secciones. Para prevenir saltos de diseño (Cumulative Layout Shift) considera reservar espacio o usar superposiciones.

## Funciones con mayor impacto
- `createSimpleCharts` (app.js línea 84): reemplaza el contenido de los contenedores de gráficos con `innerHTML`.
- `adjustNavigationForDevice` (app.js línea 195): cambia propiedades `flex` y tamaño de botones según ancho de pantalla.
- `toggleSearch` (app.js línea 3530): muestra u oculta secciones completas cambiando `style.display`.
- `loadPendingExits` (app.js línea 3277) y `confirmExit` (app.js línea 3441): insertan tarjetas en listas y actualizan botones mediante `innerHTML`.
- `loadSecurityLogs` (app.js línea 3630) y `loadHistory` (app.js línea 4234): generan tablas con `innerHTML`.

Al modificar estas funciones procura:
1. Definir alturas mínimas para contenedores antes de cargar contenido.
2. Utilizar elementos posicionados de forma absoluta/fija para tarjetas temporales.
3. Evitar reemplazar nodos grandes si basta con actualizar su contenido interno.

## Guideline de render masivo (tablas/tarjetas)

Para listas grandes reutiliza el helper `renderListWithFragment(container, items, renderer)` disponible en `modules/ui_utils.js`.

- Construye nodos con `document.createElement` dentro de `renderer`.
- Deja que el helper haga un único `replaceChildren(fragment)` al final.
- Evita concatenar `innerHTML` dentro de bucles (`for`, `forEach`, `map`) porque aumenta reflows, GC y costo de mantenimiento.

Ejemplo recomendado:

```js
renderListWithFragment(tbody, users, user => {
  const row = document.createElement('tr');
  const nameCell = document.createElement('td');
  nameCell.textContent = user.nombre || '';
  row.appendChild(nameCell);
  return row;
});
```
