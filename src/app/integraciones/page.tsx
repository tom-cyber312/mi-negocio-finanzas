"use client";

import { useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Building2,
  CreditCard,
  Database,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Link2,
  RefreshCw,
  ScanBarcode,
  ShoppingBag,
  Webhook,
} from "lucide-react";
import { db, agregarVentaExterna } from "@/lib/db";
import { getGateways, setGateways } from "@/lib/config";
import type { GatewayConfig, TransaccionExterna } from "@/lib/types";
import { fmtDateTime, fmtMoney } from "@/lib/format";
import { parseCsvTransacciones } from "@/lib/importCsv";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  FormError,
  Input,
  PageHeader,
  Tip,
} from "@/components/ui";

interface VistaPrevia {
  gateway: string;
  transacciones: TransaccionExterna[];
}

function GatewayCard({
  nombre,
  descripcion,
  enabled,
  onToggle,
  fields,
}: {
  nombre: string;
  descripcion: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  fields: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            {nombre}
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{descripcion}</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="h-4 w-4 rounded accent-emerald-600"
          />
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Activa
          </span>
        </label>
      </div>
      {enabled && <div className="mt-4 space-y-3">{fields}</div>}
    </Card>
  );
}

function SecretField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-9"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          aria-label={show ? "Ocultar" : "Mostrar"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  );
}

export default function IntegracionesPage() {
  const ventas = useLiveQuery(() => db.ventas.toArray(), []);

  const [cfg, setCfg] = useState<GatewayConfig>(() => getGateways());
  const [guardado, setGuardado] = useState(false);
  const [desde, setDesde] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));
  const [importando, setImportando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<VistaPrevia | null>(null);
  const [importados, setImportados] = useState(0);
  const [csvResult, setCsvResult] = useState<{ total: number; ignoradas: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const yaImportados = useMemo(() => {
    const set = new Set<string>();
    for (const v of ventas || []) {
      if (v.referencia) set.add(v.referencia);
    }
    return set;
  }, [ventas]);

  const guardar = () => {
    setGateways(cfg);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2500);
  };

  const importarGateway = async (gateway: string) => {
    setError(null);
    setImportando(gateway);
    try {
      const body: Record<string, string> = { from: desde, to: hasta };
      let endpoint = "";
      if (gateway === "Mercado Pago") {
        endpoint = "/api/import/mp";
        body.token = cfg.mpToken;
      } else if (gateway === "Stripe") {
        endpoint = "/api/import/stripe";
        body.secretKey = cfg.stripeSecret;
      } else {
        endpoint = "/api/import/paypal";
        body.clientId = cfg.paypalClientId;
        body.secret = cfg.paypalSecret;
      }
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || "No se pudo obtener las ventas.");
        return;
      }
      setPreview({ gateway, transacciones: data.transacciones || [] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImportando(null);
    }
  };

  const confirmarImportacion = async () => {
    if (!preview) return;
    const pendientes = preview.transacciones.filter((t) => !yaImportados.has(t.externalId));
    if (pendientes.length < preview.transacciones.length) {
      setPreview({ ...preview, transacciones: pendientes });
    }
    let n = 0;
    for (const t of pendientes) {
      await agregarVentaExterna({
        productoId: null,
        nombreProducto: t.concepto,
        cantidad: 1,
        precioUnitario: t.monto,
        fecha: t.fecha,
        cliente: t.cliente || "Imp. automático",
        metodoPago: t.metodoPago,
        referencia: t.externalId,
      });
      n++;
    }
    setImportados((x) => x + n);
    setPreview(null);
  };

  const subirCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = parseCsvTransacciones(String(reader.result || ""));
      if (!res.transacciones.length) {
        setCsvResult({ total: 0, ignoradas: res.ignoradas });
        return;
      }
      setPreview({ gateway: "CSV", transacciones: res.transacciones });
      setCsvResult({ total: res.transacciones.length, ignoradas: res.ignoradas });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const total = preview?.transacciones.length ?? 0;
  const nuevas = preview
    ? preview.transacciones.filter((t) => !yaImportados.has(t.externalId)).length
    : 0;

  return (
    <div>
      <PageHeader
        title="Integraciones externas"
        subtitle="Importá ventas desde tus pasarelas de pago o un extracto, y prepará el terreno para e-commerce y open banking."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Database className="h-4 w-4" />
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Ventas en la app
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {ventas ? ventas.length : "…"}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {ventas?.filter((v) => v.externa).length ?? 0} importadas
            automáticamente
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
            <RefreshCw className="h-4 w-4" />
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Importaciones
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {importados}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Ventas creadas en esta sesión
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
            <Link2 className="h-4 w-4" />
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Estado
            </p>
          </div>
          <p className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {cfg.mpEnabled || cfg.stripeEnabled || cfg.paypalEnabled
              ? "Pasarelas activas"
              : "Sin conectar"}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            La clave se guarda solo en este navegador
          </p>
        </Card>
      </div>

      <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-5 py-4">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
          Seguridad de las claves
          <Tip
            className="ml-1.5"
            text="Las claves se almacenan en el navegador de tu dispositivo (localStorage) y solo se envían al leer ventas. Usá tokens con permisos de lectura, limitados a lo necesario."
          />
        </p>
        <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-400/70">
          Son datos personales: nadie más en esta app los usa. Si tu dispositivo
          es compartido, considerá no guardar claves y cargarlas solo al
          importar.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-end">
        <Field label="Desde">
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </Field>
        <Field label="Hasta">
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button variant="white" onClick={() => importarGateway("Mercado Pago")} disabled={!cfg.mpToken || importando !== null}>
            <CreditCard className="h-4 w-4" /> MP
          </Button>
          <Button variant="white" onClick={() => importarGateway("Stripe")} disabled={!cfg.stripeSecret || importando !== null}>
            <CreditCard className="h-4 w-4" /> Stripe
          </Button>
          <Button variant="white" onClick={() => importarGateway("PayPal")} disabled={!cfg.paypalClientId || !cfg.paypalSecret || importando !== null}>
            <CreditCard className="h-4 w-4" /> PayPal
          </Button>
        </div>
        <FormError message={error} />
      </div>

      {preview && (
        <Card className="mb-6 border-emerald-500/40">
          <CardHeader
            title={`Ventas de ${preview.gateway}: ${total} encontradas`}
            subtitle={csvResult ? `${csvResult.ignoradas} filas ignoradas (importes 0 o negativos, comisiones, etc.)` : nuevas < total ? `${total - nuevas} ya estaban importadas.` : "Ninguna duplicada."}
            right={
              <Button size="sm" onClick={confirmarImportacion} disabled={nuevas === 0}>
                Importar {nuevas} venta(s)
              </Button>
            }
          />
          <div className="max-h-72 overflow-y-auto px-5 pb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <th className="py-2 font-medium">Fecha</th>
                  <th className="py-2 font-medium">Concepto</th>
                  <th className="py-2 text-right font-medium">Monto</th>
                  <th className="py-2 font-medium">Cliente</th>
                  <th className="py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {preview.transacciones.map((t) => (
                  <tr key={t.externalId}>
                    <td className="py-2 text-xs whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                      {fmtDateTime(t.fecha)}
                    </td>
                    <td className="py-2 text-zinc-700 dark:text-zinc-300">{t.concepto}</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {fmtMoney(t.monto)}
                    </td>
                    <td className="py-2 text-xs text-zinc-500 dark:text-zinc-400">{t.cliente || "—"}</td>
                    <td className="py-2">
                      {yaImportados.has(t.externalId) ? (
                        <Badge tone="zinc">Duplicada</Badge>
                      ) : (
                        <Badge tone="green">Nueva</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <GatewayCard
          nombre="Mercado Pago"
          descripcion="Importá los pagos aprobados de tu cuenta como ventas. Necesitás el access token."
          enabled={cfg.mpEnabled}
          onToggle={(v) => setCfg({ ...cfg, mpEnabled: v })}
          fields={
            <SecretField
              label="Access token"
              value={cfg.mpToken}
              onChange={(v) => setCfg({ ...cfg, mpToken: v })}
              placeholder="TEST-… / APP_USR-…"
              hint="Se usa con permisos de lectura de tus pagos."
            />
          }
        />
        <GatewayCard
          nombre="Stripe"
          descripcion="Importá los cobros exitosos (charges) de tu cuenta."
          enabled={cfg.stripeEnabled}
          onToggle={(v) => setCfg({ ...cfg, stripeEnabled: v })}
          fields={
            <SecretField
              label="Clave secreta"
              value={cfg.stripeSecret}
              onChange={(v) => setCfg({ ...cfg, stripeSecret: v })}
              placeholder="sk_live_…"
            />
          }
        />
        <GatewayCard
          nombre="PayPal"
          descripcion="Traé las transacciones completadas de tu cuenta PayPal."
          enabled={cfg.paypalEnabled}
          onToggle={(v) => setCfg({ ...cfg, paypalEnabled: v })}
          fields={
            <>
              <SecretField
                label="Client ID"
                value={cfg.paypalClientId}
                onChange={(v) => setCfg({ ...cfg, paypalClientId: v })}
                placeholder="AcUQ…"
              />
              <SecretField
                label="Secret"
                value={cfg.paypalSecret}
                onChange={(v) => setCfg({ ...cfg, paypalSecret: v })}
                placeholder="EL…"
              />
            </>
          }
        />
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={guardar}>Guardar configuraciones</Button>
      </div>
      {guardado && (
        <p className="mt-2 text-right text-xs font-medium text-emerald-600 dark:text-emerald-400">
          Configuración guardada.
        </p>
      )}

      <Card className="mt-6 p-5">
        <CardHeader
          title="Importar desde CSV / Excel"
          subtitle="Descargá el extracto de tu cuenta o pasarela como CSV y cargalo acá. Se reconocen columnas de fecha, monto, concepto, cliente y método de pago (en español e inglés)."
        />
        <div className="mt-3 flex flex-wrap items-center gap-2 px-5 pb-2">
          <Button variant="white" onClick={() => fileRef.current?.click()}>
            <FileSpreadsheet className="h-4 w-4" /> Elegir archivo CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={subirCsv} />
          <span className="text-xs text-zinc-400">
            Filas con monto 0 o negativo (comisiones, reintegros) se ignoran.
          </span>
        </div>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="bg-zinc-100/60 p-5 dark:bg-zinc-800/40">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-300">
            <ShoppingBag className="h-4 w-4" />
            <h3 className="text-sm font-semibold">E-commerce</h3>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Sincronizar pedidos y stock con Tienda Nube, Shopify o
            WooCommerce.
          </p>
          <div className="mt-3">
            <Badge tone="zinc">Fase posterior</Badge>
          </div>
        </Card>
        <Card className="bg-zinc-100/60 p-5 dark:bg-zinc-800/40">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-300">
            <Building2 className="h-4 w-4" />
            <h3 className="text-sm font-semibold">Cuenta bancaria</h3>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Open banking o importe de extracto para conciliar ingresos y
            egresos reales contra lo registrado.
          </p>
          <div className="mt-3">
            <Badge tone="zinc">Fase posterior</Badge>
          </div>
        </Card>
        <Card className="bg-zinc-100/60 p-5 dark:bg-zinc-800/40">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-300">
            <Webhook className="h-4 w-4" />
            <h3 className="text-sm font-semibold">Webhooks / API propia</h3>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Conectar con Zapier, Make u otras herramientas. Se implementará
            con un endpoint seguro por token.
          </p>
          <div className="mt-3">
            <Badge tone="zinc">Fase posterior</Badge>
          </div>
        </Card>
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-[11px] text-zinc-400">
        <ScanBarcode className="h-3.5 w-3.5" />
        Lector de código de barras/QR y OCR de tickets: previstos en fase
        posterior.
      </p>
    </div>
  );
}