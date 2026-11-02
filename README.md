# La Taberna Bebidas — Next.js + TypeScript

Maqueta responsive independiente para **La Taberna Bebidas**, con el estilo negro, azul oscuro y blanco mate.

## Inicio rápido (Windows / VS Code)

1. Descomprimí el ZIP.
2. Abrí en VS Code **la carpeta que contiene `package.json`** (no solo el archivo `page.tsx`).
3. En la terminal de VS Code ejecutá:

```bash
npm install
npm run dev
```

4. Abrí <http://localhost:3000> para ver la tienda y <http://localhost:3000/admin> para el administrador.

### Incluye

- Next.js 16 + React 19 + TypeScript + Lucide React + CSS responsive sin frameworks UI.
- Inicio con logo de La Taberna extraído de la imagen de Instagram compartida como referencia.
- Tienda mobile-first con banner, catálogo, búsqueda, categorías y ordenamiento.
- Productos con fotos, stock, cantidad `−/+`, carrito persistente, retiro o envío.
- Finalización de pedido con datos de contacto, entrega, medio de pago informado y enlace a WhatsApp.
- Panel `/admin` con catálogo editable (agregar, ocultar, borrar, cambiar foto, precio, stock), resumen, ventas, gráfico de 6/12 meses, últimos pedidos, ventas manuales y exportación CSV/JSON.
- Los pedidos preparados desde el catálogo se guardan como pendientes **en ese mismo navegador** y pueden marcarse completados en el administrador. Las ventas completadas alimentan el gráfico, sin números inventados.

### Configuración

- Número de WhatsApp: `data/catalog.ts`, constante `WHATSAPP_PHONE` (cargado con el enlace de la captura de Instagram: `543585097630`).
- Dirección del comercio: en `components/Storefront.tsx`.
- Catálogo inicial: `data/catalog.ts`. Productos, imágenes, precios y stocks son **ejemplos editables**, no datos verificados del negocio.
- Paleta: `app/globals.css`, variables `--ink`, `--navy`, `--blue`, `--ivory`.
- Logo: `public/images/la-taberna-logo.png`, recortado de la imagen compartida. Reemplazar por el PNG original cuando se disponga.

### Importante antes de publicar como tienda real

Este es un **prototipo funcional local**, no una solución de producción:

- Los cambios y pedidos se almacenan en `localStorage`. **No se comparten entre dispositivos o navegadores** y podrían perderse si se borra el almacenamiento.
- El enlace a WhatsApp prepara el mensaje, pero el cliente debe **enviarlo** en WhatsApp. No se procesan pagos en la web ni se confirma stock automáticamente desde el negocio.
- El administrador **no tiene autenticación**. **No lo publiques como panel real** hasta agregar cuentas, autorización y una base de datos/API con almacenamiento de imágenes seguro.
- Las cifras de ventas se basan exclusivamente en ventas completadas en el navegador, no en ventas reales importadas.
- Confirmá requisitos legales y comerciales aplicables a la venta de alcohol antes de operar.

## Estructura

```text
app/
  layout.tsx
  page.tsx
  admin/page.tsx
  globals.css
components/
  Storefront.tsx
  AdminDashboard.tsx
data/catalog.ts
lib/storage.ts
public/images/
```

## GitHub

```bash
git init
git add .
git commit -m "Maqueta inicial La Taberna Bebidas"
git branch -M main
git remote add origin URL_DE_TU_REPOSITORIO
git push -u origin main
```
