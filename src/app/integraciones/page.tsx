"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Building2,
  CreditCard,
  Database,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Lock,
  RefreshCw,
  ScanBarcode,
  Server,
  ShieldCheck,
  ShoppingBag,
  Webhook,
} from "lucide-react";
import { db, agregarVentaExterna } from "@/lib/db";
import { getGateways, setGateways } from "@/lib/config";
import type { GatewayConfig, TransaccionExterna } from "@/lib/types";
import {
  SLOTS,
  borrarSecreto,
  claveDisponible,
  haySecretoGuardado,
  leerSecreto,
  guardarSecreto,
  type Slot,
} from "@/lib/secureStore";
import { fmtDateTime, fmtMoney } from "@/lib/format";
import { parseCsvTransacciones } from "@/lib/importCsv";
import { useApp } from "@/context/AppContext";
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

type EstadoServidor = { mp: boolean; stripe: boolean; paypal: boolean };

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

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded accent-emerald-600"
      />
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</span>
    </label>
  );
}

export default function IntegracionesPage() {
  const ventas = useLiveQuery(() => db.ventas.toArray(), []);
  const { desbloquearClaves } = useApp();

  const [cfg, setCfg] = useState<GatewayConfig>(() => getGateways());
  const [estadoServidor, setEstadoServidor] = useState<EstadoServidor | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [mpToken, setMpToken] = useState("");
  const [stripeSecret, setStripeSecret] = useState("");
  const [ppClient, setPpClient] = useState("");
  const [ppSecret, setPpSecret] = useState("");
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

  // Flujo de contraseña para descifrar tokens guardados
  const [pedidoClave, setPedidoClave] = useState(false);
  const [claveText, setClaveText] = useState("");
  const [claveErr, setClaveErr] = useState<string | null>(null);
  const pendienteRef = useRef<string | null>(null);

  useEffect(() => {
    let activo = true;
    fetch("/api/import/status")
      .then((r) => r.json())
      .then((d: EstadoServidor) => {
        if (activo) setEstadoServidor(d);
      })
      .catch(() => {
        if (activo) setEstadoServidor({ mp: false, stripe: false, paypal: false });
      });
    return () => {
      activo = false;
    };
  }, []);

  const yaImportados = useMemo(() => {
    const set = new Set<string>();
    for (const v of ventas || []) {
      if (v.referencia) set.add(v.referencia);
    }
    return set;
  }, [ventas]);

  const avisoTokenMP = mpToken.trim()
    ? mpToken.trim().startsWith("TEST-")
      ? "Token de PRUEBA (sandbox): importará datos de prueba, no pagos reales."
      : !mpToken.trim().startsWith("APP_USR-")
        ? "Formato no habitual: los tokens de Mercado Pago empiezan con TEST- o APP_USR-."
        : "Access token de producción."
    : undefined;

  const avisoTokenStripe = stripeSecret.trim()
    ? stripeSecret.trim().startsWith("sk_test_")
      ? "Clave de PRUEBA: solo funciona en el modo test."
      : !stripeSecret.trim().startsWith("sk_live_")
        ? "Formato no habitual: las claves de Stripe empiezan con sk_test_ o sk_live_."
        : "Clave de producción."
    : undefined;

  const avisoTokenPayPal = (v: string, nombre: string) =>
    v.trim()
      ? /^[A-Za-z0-9_-]{16,80}$/.test(v.trim())
        ? undefined
        : `Verificá el ${nombre} de PayPal (formato alfanumérico).`
      : undefined;

  type ResToken =
    | { ok: true; token: string }
    | { ok: false; necesitaClave: boolean; razon?: string };

  async function resolverToken(args: { local: string; slot: Slot; usarServidor: boolean }): Promise<ResToken> {
    if (args.usarServidor) return { ok: true, token: "" };
    if (args.local.trim()) return { ok: true, token: args.local.trim() };
    if (haySecretoGuardado(args.slot)) {
      if (!claveDisponible()) return { ok: false, necesitaClave: true };
      const s = await leerSecreto(args.slot);
      if (s === null)
        return {
          ok: false,
          necesitaClave: false,
          razon: "No se pudo descifrar el token guardado. Reingresalo o actualizá tu contraseña.",
        };
      return { ok: true, token: s };
    }
    return {
      ok: false,
      necesitaClave: false,
      razon:
        "No hay token cargado para esta pasarela. Cargalo abajo, o activá la opción de usar el token del servidor.",
    };
  }

  const iniciarFlujoClave = (accion: string) => {
    pendienteRef.current = accion;
    setClaveErr(null);
    setClaveText("");
    setPedidoClave(true);
  };

  const confirmarClave = async () => {
    if (!claveText) return setClaveErr("Ingresá tu contraseña.");
    const ok = await desbloquearClaves(claveText);
    if (!ok) return setClaveErr("Contraseña incorrecta.");
    setClaveText("");
    setPedidoClave(false);
    const pendiente = pendienteRef.current;
    pendienteRef.current = null;
    if (pendiente === "guardar") guardar();
    else if (pendiente) void importarGateway(pendiente);
  };

  const guardar = async () => {
    setError(null);
    try {
      if (cfg.mpSaveToken) {
        if (mpToken.trim()) await guardarSecreto(SLOTS.mp, mpToken.trim());
      } else borrarSecreto(SLOTS.mp);

      if (cfg.stripeSaveToken) {
        if (stripeSecret.trim()) await guardarSecreto(SLOTS.stripe, stripeSecret.trim());
      } else borrarSecreto(SLOTS.stripe);

      if (cfg.paypalSaveToken) {
        if (ppClient.trim()) await guardarSecreto(SLOTS.paypalClient, ppClient.trim());
        if (ppSecret.trim()) await guardarSecreto(SLOTS.paypalSecret, ppSecret.trim());
      } else {
        borrarSecreto(SLOTS.paypalClient);
        borrarSecreto(SLOTS.paypalSecret);
      }
      setGateways(cfg);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const importarGateway = async (gateway: string) => {
    setError(null);
    setImportando(gateway);
    try {
      const body: Record<string, string> = { from: desde, to: hasta };
      let endpoint = "";
      if (gateway === "Mercado Pago") {
        endpoint = "/api/import/mp";
        const r = await resolverToken({ local: mpToken, slot: SLOTS.mp, usarServidor: cfg.mpUsarServidor });
        if (!r.ok) {
          if (r.necesitaClave) {
            iniciarFlujoClave(gateway);
            return;
          }
          setError(r.razon || "Falta el token.");
          return;
        }
        body.token = r.token;
      } else if (gateway === "Stripe") {
        endpoint = "/api/import/stripe";
        const r = await resolverToken({ local: stripeSecret, slot: SLOTS.stripe, usarServidor: cfg.stripeUsarServidor });
        if (!r.ok) {
          if (r.necesitaClave) {
            iniciarFlujoClave(gateway);
            return;
          }
          setError(r.razon || "Falta la clave.");
          return;
        }
        body.secretKey = r.token;
      } else {
        endpoint = "/api/import/paypal";
        const rc = await resolverToken({ local: ppClient, slot: SLOTS.paypalClient, usarServidor: cfg.paypalUsarServidor });
        const rs = await resolverToken({ local: ppSecret, slot: SLOTS.paypalSecret, usarServidor: cfg.paypalUsarServidor });
        const sinResolver = [rc, rs].filter((x): x is Extract<ResToken, { ok: false }> => !x.ok);
        if (sinResolver.some((x) => x.necesitaClave)) {
          iniciarFlujoClave(gateway);
          return;
        }
        const fallo = sinResolver[0];
        if (fallo) {
          setError(fallo.razon || "Faltan las credenciales de PayPal.");
          return;
        }
        body.clientId = (rc as Extract<ResToken, { ok: true }>).token;
        body.secret = (rs as Extract<ResToken, { ok: true }>).token;
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

  const badgeServidor = (key: keyof EstadoServidor) =>
    estadoServidor && estadoServidor[key] ? (
      <Badge tone="green">Servidor: configurado</Badge>
    ) : (
      <Badge tone="zinc">Servidor: no configurado</Badge>
    );

  const tieneGuardadoMP = haySecretoGuardado(SLOTS.mp);
  const tieneGuardadoStripe = haySecretoGuardado(SLOTS.stripe);
  const tieneGuardadoPayPal =
    haySecretoGuardado(SLOTS.paypalClient) || haySecretoGuardado(SLOTS.paypalSecret);

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
            <ShieldCheck className="h-4 w-4" />
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Seguridad
            </p>
          </div>
          <p className="mt-2 text-xl font-bold leading-snug text-zinc-900 dark:text-zinc-100">
            Tokens cifrados
            <Lock className="ml-1 inline h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Claves cifradas (AES-256) o token del servidor.
          </p>
        </Card>
      </div>

      <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-5 py-4">
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Cómo proteger tus claves
              <Tip
                className="ml-1.5"
                text="Tus tokens son llaves digitales: con un access token de Mercado Pago se puede operar tu cuenta. Tratalos como tu contraseña del banco."
              />
            </p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-amber-700/90 dark:text-amber-400/80">
              <li>
                <b>No los guardes salvo que sea necesario.</b> Si no marcás la opción, el token se usa solo
                en esa importación y queda únicamente en memoria.
              </li>
              <li>
                Si los <b>guardás</b>, quedan <b>cifrados (AES-256)</b> con tu contraseña de la cuenta: solo se
                descifran si ingresás la contraseña en esta sesión.
              </li>
              <li>
                <b>Nada sube a GitHub ni al código:</b> las claves viven en tu navegador (cifradas) o en las{" "}
                <b>variables de entorno del servidor</b> (Vercel). El repositorio público nunca las contiene.
              </li>
              <li>
                Usá <b>tokens de lectura / limitados</b> y <b>rotalos periódicamente</b> desde el panel de cada
                proveedor.
              </li>
            </ul>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs">
              <a
                href="https://www.mercadopago.com.ar/developers/panel/app"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-amber-700 underline decoration-amber-400 underline-offset-2 hover:no-underline dark:text-amber-400"
              >
                Mercado Pago: panel de credenciales →
              </a>
              <a
                href="https://dashboard.stripe.com/apikeys"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-amber-700 underline decoration-amber-400 underline-offset-2 hover:no-underline dark:text-amber-400"
              >
                Stripe: API keys →
              </a>
              <a
                href="https://developer.paypal.com/dashboard/applications"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-amber-700 underline decoration-amber-400 underline-offset-2 hover:no-underline dark:text-amber-400"
              >
                PayPal: aplicaciones →
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-end">
        <Field label="Desde">
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </Field>
        <Field label="Hasta">
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button variant="white" onClick={() => importarGateway("Mercado Pago")} disabled={importando !== null}>
            <CreditCard className="h-4 w-4" /> MP
          </Button>
          <Button variant="white" onClick={() => importarGateway("Stripe")} disabled={importando !== null}>
            <CreditCard className="h-4 w-4" /> Stripe
          </Button>
          <Button variant="white" onClick={() => importarGateway("PayPal")} disabled={importando !== null}>
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
            <>
              <SecretField
                label="Access token (no se guarda salvo que lo pidas)"
                value={mpToken}
                onChange={(v) => setMpToken(v)}
                placeholder="TEST-… / APP_USR-…"
                hint={avisoTokenMP}
              />
              {tieneGuardadoMP && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  <Lock className="mr-1 inline h-3 w-3" />
                  Hay un token guardado cifrado. Se usa en las importaciones (pide tu contraseña).
                </p>
              )}
              <Toggle
                on={cfg.mpSaveToken}
                onChange={(v) => setCfg({ ...cfg, mpSaveToken: v })}
                label={
                  <>
                    Guardar cifrado en este navegador
                    <Tip text="Lo cifra con tu contraseña (AES-256). Sin marcar, se usa solo en esa importación y se descarta." />
                  </>
                }
              />
              <div className="flex items-center justify-between gap-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/40">
                <Toggle
                  on={cfg.mpUsarServidor}
                  onChange={(v) => setCfg({ ...cfg, mpUsarServidor: v })}
                  label={
                    <>
                      <Server className="mr-1 inline h-3.5 w-3.5" />
                      Usar token del servidor
                      <Tip text="El access token se configura como variable MP_ACCESS_TOKEN en Vercel y nunca llega al navegador ni a GitHub. El botón de importar usa esa clave automáticamente." />
                    </>
                  }
                />
                {badgeServidor("mp")}
              </div>
            </>
          }
        />
        <GatewayCard
          nombre="Stripe"
          descripcion="Importá los cobros exitosos (charges) de tu cuenta."
          enabled={cfg.stripeEnabled}
          onToggle={(v) => setCfg({ ...cfg, stripeEnabled: v })}
          fields={
            <>
              <SecretField
                label="Clave secreta (no se guarda salvo que lo pidas)"
                value={stripeSecret}
                onChange={(v) => setStripeSecret(v)}
                placeholder="sk_live_…"
                hint={avisoTokenStripe}
              />
              {tieneGuardadoStripe && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  <Lock className="mr-1 inline h-3 w-3" />
                  Hay una clave guardada cifrada.
                </p>
              )}
              <Toggle
                on={cfg.stripeSaveToken}
                onChange={(v) => setCfg({ ...cfg, stripeSaveToken: v })}
                label={
                  <>
                    Guardar cifrada en este navegador
                    <Tip text="La cifra con tu contraseña (AES-256). Sin marcar, se usa solo en esa importación y se descarta." />
                  </>
                }
              />
              <div className="flex items-center justify-between gap-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/40">
                <Toggle
                  on={cfg.stripeUsarServidor}
                  onChange={(v) => setCfg({ ...cfg, stripeUsarServidor: v })}
                  label={
                    <>
                      <Server className="mr-1 inline h-3.5 w-3.5" />
                      Usar clave del servidor
                      <Tip text="Se configura como STRIPE_SECRET_KEY en Vercel y nunca llega al navegador ni a GitHub." />
                    </>
                  }
                />
                {badgeServidor("stripe")}
              </div>
            </>
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
                label="Client ID (no se guarda salvo que lo pidas)"
                value={ppClient}
                onChange={(v) => setPpClient(v)}
                placeholder="AcUQ…"
                hint={avisoTokenPayPal(ppClient, "Client ID")}
              />
              <SecretField
                label="Secret (no se guarda salvo que lo pidas)"
                value={ppSecret}
                onChange={(v) => setPpSecret(v)}
                placeholder="EL…"
                hint={avisoTokenPayPal(ppSecret, "Secret")}
              />
              {tieneGuardadoPayPal && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  <Lock className="mr-1 inline h-3 w-3" />
                  Hay credenciales guardadas cifradas.
                </p>
              )}
              <Toggle
                on={cfg.paypalSaveToken}
                onChange={(v) => setCfg({ ...cfg, paypalSaveToken: v })}
                label={
                  <>
                    Guardar cifradas en este navegador
                    <Tip text="Las cifra con tu contraseña (AES-256). Sin marcar, se usan solo en esa importación y se descartan." />
                  </>
                }
              />
              <div className="flex items-center justify-between gap-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/40">
                <Toggle
                  on={cfg.paypalUsarServidor}
                  onChange={(v) => setCfg({ ...cfg, paypalUsarServidor: v })}
                  label={
                    <>
                      <Server className="mr-1 inline h-3.5 w-3.5" />
                      Usar credenciales del servidor
                      <Tip text="Se configuran como PAYPAL_CLIENT_ID y PAYPAL_SECRET en Vercel y nunca llegan al navegador ni a GitHub." />
                    </>
                  }
                />
                {badgeServidor("paypal")}
              </div>
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

      {pedidoClave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPedidoClave(false)} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void confirmarClave();
            }}
            className={`relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900`}
          >
            <div className="mb-3 flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Descifrar token guardado
              </h3>
            </div>
            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              Ingresá la contraseña de esta cuenta para descifrar el token
              guardado. La clave se mantiene solo en memoria para esta sesión.
            </p>
            <Input
              type="password"
              value={claveText}
              onChange={(e) => setClaveText(e.target.value)}
              placeholder="••••••••"
              autoFocus
            />
            {claveErr && (
              <p className="mt-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
                {claveErr}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <Button type="submit" className="flex-1">
                Descifrar
              </Button>
              <Button type="button" variant="white" onClick={() => setPedidoClave(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}