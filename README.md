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
- **Seguridad**: login con contraseña (mín. 8 caracteres) cifrada con PBKDF2
  (250.000 iteraciones, clave derivada con AES-GCM vía WebCrypto) y guardada
  solo en el navegador. Sesión persistente 30 días.
- **Multi-cuenta**: hasta 6 negocios/usuarios, cada uno con su propia base de
  datos local y bloqueo por contraseña.
- **Integraciones**: importación de cobros de Mercado Pago / Stripe / PayPal.
  Las credenciales se guardan cifradas en el navegador o como variables de
  entorno del servidor (`MP_ACCESS_TOKEN`, `STRIPE_SECRET_KEY`,
  `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`; ver `.env.example`). Si Mercado Pago
  está activo y hay cobros sin importar, el Dashboard muestra un aviso con
  botón para importarlos de un toque (búsqueda automática al abrir la app).
- **Modo oscuro** conmemorativo de preferencia del sistema, diseño responsive.

## Datos

Los datos se guardan **localmente en el navegador** (IndexedDB vía Dexie). No
requieren backend ni base de datos en la nube, por lo que la app se puede
desplegar como sitio estático en Vercel. En **Ajustes** se puede cargar un
demo con datos de ejemplo o borrar todo.

### Sincronización entre dispositivos (Supabase, opcional)

Sin configuración extra no hay sincronización y cada dispositivo conserva sus
propios datos. Para usar la **misma cuenta (negocio) en el celular y la PC**
con los datos compartidos:

1. Creá un proyecto gratis en [supabase.com](https://supabase.com).
2. En el **SQL Editor** ejecutá el script `supabase/migrations/0001_inicial.sql`
   (crea las tablas `cuentas` y `registros` con políticas RLS por propietario).
3. En **Settings → API** copiá la *Project URL* y la *anon key*, y:
   - incluí `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en
     `.env.local` para desarrollo, y
   - cargalas también en Vercel (Project → Settings → Environment Variables):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
4. Desplegá, iniciá sesión con el mismo correo/contraseña en ambos
   dispositivos y en **Ajustes → Sincronización** tocá "Sincronizar ahora".

Cada registro sincronizable lleva un `uid` y un `updatedAt`; al sincronizar se
combina la base local con la nube con política de *last-write-wins*, y las
eliminaciones se propagan mediante "tumbas". Sin conexión, todo sigue
funcionando offline y se sincroniza en la siguiente apertura.

> Nota: la moneda y los ajustes de apariencia son por dispositivo. La
> sincronización cubre productos, ventas, gastos, presupuestos, facturas e
> inflación.

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

> Las rutas `/api/import/*` importan cobros de Mercado Pago, Stripe y PayPal
> desde el servidor. Configurá las variables de entorno en Vercel según
> `.env.example`; sin ellas las pasarelas funcionan solo con credenciales
> del navegador.

## App iOS (Capacitor)

La app se puede empaquetar para la App Store usando Capacitor. El proyecto
carga la versión web desplegada en Vercel dentro de un WebView nativo
(ver `capacitor.config.ts`); las descargas de PDF/Excel/backup pasan por el
share sheet nativo y los ajustes críticos se respaldan en `@capacitor/preferences`.

Requisitos: **macOS + Xcode** y, para publicar, cuenta Apple Developer
(US$ 99/año). En tu Mac:

```bash
npm install
npm run build

# Generar la plataforma y sincronizar plugins/web assets
npm run cap:ios              # cap add ios + cap sync

# Iconos y splash (genera AppIcon y Splash desde assets/icon.png, 1024x1024)
npm i -D @capacitor/assets
npx capacitor-assets generate --ios

# Abrir en Xcode
npx cap open ios
```

En Xcode: setear el **Bundle Identifier**, la **versión 1.0.0** y el equipo de
firma, compilar con **Any iOS Device**, y subir con **Product ▸ Archive** para
App Store Connect (TestFlight → revisión). Recordá actualizar `appId` y el
`server.url` en `capacitor.config.ts` antes de generar la plataforma.

> El repositorio es público: **no** commitees claves reales, `.env` ni la
> carpeta generada `ios/` (está en `.gitignore`). El proyecto de Xcode se
> regenera siempre con `npm run cap:ios`.