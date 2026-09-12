# Mi Negocio — Finanzas

Panel financiero personal para administrar productos, inventario, ventas y
gastos de un negocio pequeño. Hecho con **Next.js 16**, **React 19**,
**Tailwind CSS 4**, **Recharts** y **Dexie (IndexedDB)**.

## Funcionalidades

- **Productos e Inventario**: CRUD con nombre, categoría, SKU, costo de
  insumos, precio de venta, margen calculado automáticamente, stock y umbral
  de alerta. Muestra costo total invertido y ganancia potencial por producto.
- **Ventas e Ingresos**: registro de ventas con producto, cantidad, precio,
  fecha, cliente y método de pago. El stock se descuenta automáticamente.
- **Gastos/Egresos**: categorías (insumos, publicidad, servicios, sueldos,
  otros), gastos recurrentes mensuales y botón para copiar recurrentes a un
  mes, y medición del ROI de publicidad.
- **Dashboard General**: resumen histórico (ingresos, egresos, utilidad neta,
  capital en inventario), gráfico ingresos vs egresos por mes, distribución de
  egresos por categoría, top 5 más vendidos y más rentables, y ROI de
  publicidad. Filtros por período (30 días, 90 días, 12 meses, todo).
- **Dashboard Mensual**: selector de mes/año, evolución diaria acumulada de
  ingresos vs egresos, comparativa vs mes anterior, desglose de gastos por
  categoría y balance neto. Exportación a **PDF** y **Excel**.
- **Recomendaciones inteligentes**: reglas automáticas basadas en los datos
  (margen bajo, stock estancado, publicidad con bajo retorno, flujo de caja
  negativo, etc.). Incluye un bloque "Listo para IA" que genera el contexto en
  texto plano para conectarlo después con un modelo de lenguaje.
- **Seguridad**: login con contraseña cifrada (SHA-256 + salt) guardada solo en
  el navegador.
- **Modo oscuro** conmemorativo de preferencia del sistema, diseño responsive.

## Datos

Los datos se guardan **localmente en el navegador** (IndexedDB vía Dexie). No
requieren backend ni base de datos en la nube, por lo que la app se puede
desplegar como sitio estático en Vercel. En **Ajustes** se puede cargar un
demo con datos de ejemplo o borrar todo.

> Nota: al ser almacenamiento local, los datos viven en el navegador donde se
> usan. Para sincronización entre dispositivos habría que conectar una base
> remota (p. ej. Supabase), pero la capa de datos en `src/lib/db.ts` está
> aislada para facilitarlo.

## Estructura

```
src/
├── app/                 # Rutas (Next.js App Router)
│   ├── dashboard/       # Dashboard general
│   ├── dashboard-mensual/
│   ├── productos/       # CRUD productos e inventario
│   ├── ventas/          # Registro de ventas
│   ├── gastos/          # Egresos por categoría
│   ├── recomendaciones/ # Reglas inteligentes
│   ├── layout.tsx       # Shell, login, navegación, modo oscuro
│   └── globals.css
├── components/          # UI base, gráficos Recharts, AppShell
├── context/             # Auth, tema y ajustes globales
└── lib/                 # Dexie (DB), cálculos, reglas, export PDF/Excel
```

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build de producción
npm run start      # servir el build
npm run lint       # eslint
```

## Deploy en Vercel

```bash
vercel        # primer deploy y vinculación del proyecto
vercel --prod # deploys siguientes (o conecta el repo en vercel.com)
```