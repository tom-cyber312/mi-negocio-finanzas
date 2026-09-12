"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Calculator,
  FileDown,
  Inbox,
  Landmark,
  Receipt,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { db, deleteFactura, saveFactura, saveInflacion, deleteInflacion } from "@/lib/db";
import type { Factura, FiscalConfig, InflacionMes } from "@/lib/types";
import {
  getContadorFactura,
  getFiscalConfig,
  getLimitesMonotributo,
  incrementarContadorFactura,
  setFiscalConfig,
  setLimitesMonotributo,
} from "@/lib/config";
import {
  CATEGORIAS_MONOTRIBUTO_DEFAULT,
  calcularIva,
  condicionTitulo,
  estadoMonotributo,
  letraPara,
} from "@/lib/fiscal";
import { fmtDate, fmtMoney, MESES } from "@/lib/format";
import { feedbackExito } from "@/lib/capacitor";
import { generarFacturaPDF } from "@/lib/export";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  Field,
  FormError,
  Input,
  PageHeader,
  Select,
  StatCard,
  Tip,
} from "@/components/ui";
import { useApp } from "@/context/AppContext";

export default function FacturacionPage() {
  const { currency } = useApp();
  const ventas = useLiveQuery(() => db.ventas.toArray(), []);
  const facturas = useLiveQuery(() => db.facturas.toArray(), []);
  const inflacion = useLiveQuery(() => db.inflacion.toArray(), []);

  const [fiscal, setFiscal] = useState<FiscalConfig>(() => getFiscalConfig());
  const [limites, setLimites] = useState(() => {
    const saved = getLimitesMonotributo();
    return saved.length ? saved : CATEGORIAS_MONOTRIBUTO_DEFAULT;
  });
  const [fiscalSaved, setFiscalSaved] = useState(false);
  const [ventaId, setVentaId] = useState(0);
  const [facturaMsg, setFacturaMsg] = useState<string | null>(null);
  const [reciboOpen, setReciboOpen] = useState(false);
  const [deleting, setDeleting] = useState<Factura | null>(null);

  const [recibo, setRecibo] = useState({
    letra: "C" as "A" | "B" | "C",
    numero: "",
    fecha: new Date().toISOString().slice(0, 10),
    proveedor: "",
    cuit: "",
    monto: 0,
    detalle: "",
  });
  const [reciboErr, setReciboErr] = useState<string | null>(null);

  const [infMes, setInfMes] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
  });
  const [infPct, setInfPct] = useState("2");

  const state = estadoMonotributo(ventas || [], limites, fiscal);

  const ventasSinFactura = useMemo(() => {
    if (!ventas) return [];
    const facturadas = new Set(
      (facturas || [])
        .filter((f) => f.ventaId != null)
        .map((f) => f.ventaId as number)
    );
    return ventas
      .filter((v) => !facturadas.has(v.id as number))
      .sort((a, b) => b.fecha - a.fecha);
  }, [ventas, facturas]);

  const ventaSel = ventasSinFactura.find((v) => v.id === ventaId);

  const guardarFiscal = (e: FormEvent) => {
    e.preventDefault();
    setFiscalConfig(fiscal);
    setFiscalSaved(true);
    setTimeout(() => setFiscalSaved(false), 2500);
  };

  const emitirFactura = async () => {
    setFacturaMsg(null);
    const v = ventaSel;
    if (!v) return;
    const letraF = letraPara(fiscal);
    const n = incrementarContadorFactura(letraF);
    const pto = (fiscal.ptoVenta || "0001").trim();
    const numero = `${pto}-${String(n).padStart(8, "0")}`;
    const factura: Factura = {
      tipo: "emitida",
      letra: letraF,
      numero,
      fecha: Date.now(),
      cliente: v.cliente || "Consumidor final",
      cuit: "",
      condicion: fiscal.condicionIva,
      monto: v.cantidad * v.precioUnitario,
      detalle: `${v.nombreProducto} × ${v.cantidad}`,
      ventaId: v.id,
    };
    await saveFactura(factura);
    const iva = letraF === "A" ? calcularIva(factura.monto, fiscal.ivaPct, true) : 0;
    generarFacturaPDF(factura, fiscal).then(() => feedbackExito(), () => undefined);
    setFacturaMsg(
      `Factura ${letraF} ${numero} generada` +
        (letraF === "A"
          ? ` · IVA ${fmtMoney(iva, currency)} incluido sobre ${fmtMoney(factura.monto, currency)}`
          : " · sin IVA discriminado (monotributo)") +
        ". Verificá los datos de tu AFIP/ARCA."
    );
    setVentaId(0);
  };

  const guardarRecibo = async (e: FormEvent) => {
    e.preventDefault();
    setReciboErr(null);
    if (recibo.monto <= 0) return setReciboErr("Ingresá un monto mayor a 0.");
    if (!recibo.numero.trim()) return setReciboErr("Ingresá el número del comprobante.");
    await saveFactura({
      tipo: "recibida",
      letra: recibo.letra,
      numero: recibo.numero.trim(),
      fecha: new Date(recibo.fecha).getTime(),
      cliente: recibo.proveedor.trim() || "Proveedor",
      cuit: recibo.cuit.trim(),
      condicion: "proveedor",
      monto: recibo.monto,
      detalle: recibo.detalle.trim() || "Comprobante recibido",
    });
    setReciboOpen(false);
    setRecibo({ ...recibo, numero: "", proveedor: "", cuit: "", monto: 0, detalle: "" });
  };

  const agregarInflacion = async (e: FormEvent) => {
    e.preventDefault();
    const pct = parseFloat(infPct);
    if (isNaN(pct) || !infMes) return;
    await saveInflacion({ mesKey: infMes, variacionPct: pct });
    const d = new Date(infMes + "-01");
    setInfMes(nextMonthKey(d));
  };

  const montoEmitido = (facturas || [])
    .filter((f) => f.tipo === "emitida")
    .reduce((s, f) => s + f.monto, 0);
  const ivaEmitido = (facturas || [])
    .filter((f) => f.tipo === "emitida" && f.letra === "A")
    .reduce((s, f) => s + calcularIva(f.monto, fiscal.ivaPct, true), 0);

  return (
    <div>
      <PageHeader
        title="Facturación y cumplimiento fiscal"
        subtitle="Comprobantes, estimación de Monotributo/IVA y ajuste por inflación de tus reportes."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Facturado últimos 12 meses"
          value={fmtMoney(state.facturado12m, currency)}
          tone={state.superado ? "negative" : state.usoPct > 75 ? "accent" : "positive"}
          icon={<TrendingUp className="h-4 w-4" />}
          sub={`${state.usoPct > 0 ? state.usoPct.toFixed(0) : 0}% del tope actual`}
        />
        <StatCard
          label="Categoría Monotributo"
          value={state.categoriaActual?.letra ?? "—"}
          tone={state.superado ? "negative" : "accent"}
          icon={<Calculator className="h-4 w-4" />}
          sub={
            state.superado
              ? "¡Superó el límite de tu categoría!"
              : `Tope anual ${fmtMoney(state.categoriaActual?.limiteAnual ?? 0, currency)}`
          }
        />
        <StatCard
          label="Próxima categoría"
          value={state.siguiente?.letra ?? "—"}
          tone="info"
          icon={<Landmark className="h-4 w-4" />}
          sub={
            state.siguiente
              ? `Requiere no superar ${fmtMoney(state.siguiente.limiteAnual, currency)}`
              : "Ya estás en la máxima"
          }
        />
        <StatCard
          label="Comprobantes registrados"
          value={(facturas || []).length}
          tone="info"
          icon={<Inbox className="h-4 w-4" />}
          sub={`Emitidas: ${fmtMoney(montoEmitido, currency)} · IVA A: ${fmtMoney(ivaEmitido, currency)}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Datos fiscales"
            subtitle="Usados para generar facturas y estimar impuestos."
            right={
              fiscalSaved ? <Badge tone="green">Guardado</Badge> : undefined
            }
          />
          <form onSubmit={guardarFiscal} className="space-y-3 px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Razón social / nombre">
                <Input
                  value={fiscal.razonSocial}
                  onChange={(e) => setFiscal({ ...fiscal, razonSocial: e.target.value })}
                  placeholder="Ej: Carla Pérez"
                />
              </Field>
              <Field label="CUIT">
                <Input
                  value={fiscal.cuit}
                  onChange={(e) => setFiscal({ ...fiscal, cuit: e.target.value })}
                  placeholder="20-XXXXXXXX-X"
                />
              </Field>
              <Field label="Condición frente al IVA">
                <Select
                  value={fiscal.condicionIva}
                  onChange={(e) => setFiscal({ ...fiscal, condicionIva: e.target.value as FiscalConfig["condicionIva"] })}
                >
                  <option value="monotributo">Monotributo</option>
                  <option value="respin">Responsable Inscripto</option>
                  <option value="exento">Exento</option>
                </Select>
              </Field>
              {fiscal.condicionIva === "monotributo" && (
                <Field label="Categoría declarada">
                  <Select
                    value={fiscal.monotributoCategoria}
                    onChange={(e) => setFiscal({ ...fiscal, monotributoCategoria: e.target.value })}
                  >
                    {limites.map((c) => (
                      <option key={c.letra} value={c.letra}>
                        {c.letra}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Punto de venta">
                <Input
                  value={fiscal.ptoVenta}
                  onChange={(e) => setFiscal({ ...fiscal, ptoVenta: e.target.value })}
                  placeholder="0001"
                />
              </Field>
              <Field label="Domicilio">
                <Input
                  value={fiscal.direccion}
                  onChange={(e) => setFiscal({ ...fiscal, direccion: e.target.value })}
                  placeholder="Calle y número"
                />
              </Field>
            </div>
            <div className="flex items-center justify-between">
              <Button type="submit" size="sm">
                Guardar datos fiscales
              </Button>
              <p className="text-[11px] text-zinc-400">
                Facturas: letra {letraPara(fiscal)} ({condicionTitulo(fiscal.condicionIva)})
              </p>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="Estimador de Monotributo"
            subtitle="Montos anuales según facturación. Editable: ARCA actualiza los límites periódicamente."
            right={<Tip text="Los topes son por año calendario. Cuando pasás el 75% del límite, monitoreá la facturación mensual para cambiar de categoría a tiempo." />}
          />
          <div className="px-5 py-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-sm text-zinc-600 dark:text-zinc-300">
                Límite actual ({state.categoriaActual?.letra}):{" "}
                <b>{fmtMoney(state.categoriaActual?.limiteAnual ?? 0, currency)}</b>
              </span>
              <Badge
                tone={
                  state.superado ? "red" : state.usoPct > 75 ? "amber" : "green"
                }
              >
                {state.superado
                  ? "Límite superado"
                  : state.usoPct > 75
                    ? `Cerca del límite (${state.usoPct.toFixed(0)}%)`
                    : `Usado ${state.usoPct.toFixed(0)}%`}
              </Badge>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-800">
              <div
                className={`h-full rounded-full ${
                  state.superado
                    ? "bg-rose-500"
                    : state.usoPct > 75
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(state.usoPct, 100)}%` }}
              />
            </div>
            {state.superado ? (
              <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
                Tu facturación de los últimos 12 meses supera el tope de la
                categoría {state.categoriaActual?.letra}. Considerá recategorizarte
                o mudar parte de la facturación a una sociedad.
              </p>
            ) : state.proximoLimitePct != null && state.proximoLimitePct > 100 ? (
              <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                Con lo facturado ya alcanzarías la categoría{" "}
                {state.siguiente?.letra}. Si seguís así, vas a superar el límite
                actual en este año calendario: recategorizate a tiempo.
              </p>
            ) : (
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                Podés facturar hasta{" "}
                <b>
                  {fmtMoney(
                    (state.categoriaActual?.limiteAnual ?? 0) - state.facturado12m,
                    currency
                  )}
                </b>{" "}
                sin cambiar de categoría en el próximo año.
              </p>
            )}
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Editar límites por categoría
              </summary>
              <div className="mt-3 space-y-1.5">
                {limites.map((c, i) => (
                  <div key={c.letra} className="flex items-center gap-2 text-xs">
                    <span className="w-6 font-semibold text-zinc-700 dark:text-zinc-300">
                      {c.letra}
                    </span>
                    <Input
                      type="number"
                      value={c.limiteAnual}
                      onChange={(e) => {
                        const next = [...limites];
                        next[i] = {
                          ...next[i],
                          limiteAnual: parseFloat(e.target.value) || 0,
                        };
                        setLimites(next);
                      }}
                    />
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="white"
                  onClick={() => setLimitesMonotributo(limites)}
                >
                  Guardar límites
                </Button>
              </div>
            </details>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Emitir factura electrónica"
            subtitle="Generá el comprobante de una venta registrada (letra A, B o C según tu condición)."
          />
          <div className="space-y-3 px-5 py-4">
            <Field label="Venta a facturar">
              <Select value={ventaId || ""} onChange={(e) => setVentaId(parseInt(e.target.value || "0"))}>
                <option value="">Seleccionar venta…</option>
                {ventasSinFactura.map((v) => (
                  <option key={v.id} value={v.id}>
                    {fmtDate(v.fecha)} · {v.nombreProducto} ×
                    {v.cantidad} — {fmtMoney(v.cantidad * v.precioUnitario, currency)}
                  </option>
                ))}
              </Select>
            </Field>
            {ventaSel && (
              <div className="rounded-xl bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-800/60">
                <p className="text-zinc-600 dark:text-zinc-300">
                  Cliente: <b>{ventaSel.cliente || "Consumidor final"}</b> · Total:{" "}
                  <b>{fmtMoney(ventaSel.cantidad * ventaSel.precioUnitario, currency)}</b>
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Se generará Factura {letraPara(fiscal)} N°{" "}
                  {(fiscal.ptoVenta || "0001")}-{String(getContadorFactura(letraPara(fiscal)) + 1).padStart(8, "0")}{" "}
                  y se descargará el PDF.
                </p>
              </div>
            )}
            <Button onClick={emitirFactura} disabled={!ventaSel}>
              <FileDown className="h-4 w-4" /> Generar factura y PDF
            </Button>
            {facturaMsg && (
              <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
                {facturaMsg}
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Facturación mensual estimada"
            subtitle="Si facturaras todas tus ventas con IVA discriminado."
          />
          <div className="space-y-2 px-5 py-4 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-300">Impuesto IVA (categoría A)</span>
              <b className="text-zinc-900 dark:text-zinc-100">
                {fmtMoney((ventas || []).reduce((s, v) => s + calcularIva(v.cantidad * v.precioUnitario, fiscal.ivaPct, true), 0), currency)}
              </b>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-300">IVA con tope renunciado (Monotributo)</span>
              <b className="text-zinc-900 dark:text-zinc-100">—</b>
            </div>
            <p className="mt-2 rounded-lg bg-sky-500/10 px-3 py-2 text-[11px] text-sky-700 dark:text-sky-400">
              Los monotributistas no discriminan IVA (factura C) pero pueden
              tomarlo como costo. Los responsables inscriptos deben emitir letra
              A/B y pagar el IVA.
            </p>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Comprobantes"
          subtitle="Registro organizado de facturas emitidas y recibidas para uso contable."
          right={
            <Button size="sm" variant="white" onClick={() => setReciboOpen(true)}>
              <Receipt className="h-4 w-4" /> Registrar comprobante recibido
            </Button>
          }
        />
        <div className="px-5 pb-2 pt-4">
          {facturas && facturas.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <th className="py-2 font-medium">Tipo</th>
                    <th className="py-2 font-medium">N°</th>
                    <th className="py-2 font-medium">Fecha</th>
                    <th className="py-2 font-medium">Emisor / Receptor</th>
                    <th className="py-2 text-right font-medium">Monto</th>
                    <th className="py-2 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {facturas
                    .slice()
                    .sort((a, b) => b.fecha - a.fecha)
                    .map((f) => (
                      <tr key={f.id}>
                        <td className="py-2.5">
                          <Badge tone={f.tipo === "emitida" ? "green" : "sky"}>
                            {f.tipo === "emitida" ? "Emitida" : "Recibida"} · {f.letra}
                          </Badge>
                        </td>
                        <td className="py-2.5 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                          {f.numero}
                        </td>
                        <td className="py-2.5 whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
                          {fmtDate(f.fecha)}
                        </td>
                        <td className="py-2.5 text-zinc-700 dark:text-zinc-300">
                          {f.cliente}
                          {f.cuit ? <span className="ml-1 text-xs text-zinc-400">({f.cuit})</span> : null}
                        </td>
                        <td className="py-2.5 text-right font-semibold tabular-nums">
                          {fmtMoney(f.monto, currency)}
                        </td>
                        <td className="py-2.5">
                          <div className="flex justify-end gap-1">
                            <button
                              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              onClick={() => generarFacturaPDF(f, fiscal)}
                              title="Descargar PDF"
                            >
                              <FileDown className="h-4 w-4" />
                            </button>
                            <button
                              className="rounded-lg p-1.5 text-zinc-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                              onClick={() => setDeleting(f)}
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
              Aún no hay comprobantes registrados.
            </p>
          )}
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Ajuste por inflación"
          subtitle="Cargá la inflación mensual de tu país. Los dashboards podrán mostrar tus valores nominales y ajustados para comparar meses reales."
          right={<Tip text="Ajustar por inflación lleva los montos históricos a moneda actual. Con esto, comparar un mes contra otro refleja la venta real, no la nominal." />}
        />
        <div className="grid gap-4 px-5 py-4 lg:grid-cols-2">
          <form onSubmit={agregarInflacion} className="flex flex-wrap items-end gap-2">
            <Field label="Mes">
              <Input type="month" value={infMes} onChange={(e) => setInfMes(e.target.value)} />
            </Field>
            <Field label="Variación %">
              <Input
                type="number"
                step="0.1"
                min="0"
                value={infPct}
                onChange={(e) => setInfPct(e.target.value)}
                className="w-24"
              />
            </Field>
            <Button size="sm">Agregar mes</Button>
          </form>
          <div className="max-h-64 overflow-y-auto">
            {inflacion && inflacion.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <th className="py-1.5 font-medium">Mes</th>
                    <th className="py-1.5 text-right font-medium">Inflación</th>
                    <th className="py-1.5 text-right font-medium">Factor acumulado (12m)</th>
                    <th className="py-1.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {inflacion
                    .slice()
                    .sort((a, b) => a.mesKey.localeCompare(b.mesKey))
                    .map((i) => (
                      <tr key={i.id}>
                        <td className="py-1.5 text-zinc-700 dark:text-zinc-300">
                          {mesLabel(i.mesKey)}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                          {i.variacionPct.toFixed(1)}%
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                          {factorAcumulado(inflacion, i.mesKey, 12).toFixed(2)}x
                        </td>
                        <td className="py-1.5 text-right">
                          <button
                            className="rounded-lg p-1 text-zinc-400 hover:text-rose-600"
                            onClick={() => deleteInflacion(i.id as number)}
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <p className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
                Sin datos de inflación cargados. Agregá mes a mes la variación
                del IPC.
              </p>
            )}
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteFactura(deleting.id as number)}
        title="Eliminar comprobante"
        message={`¿Eliminás el comprobante ${deleting?.numero} de ${fmtMoney(deleting?.monto ?? 0, currency)}?`}
      />

      {reciboOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setReciboOpen(false)} />
          <div className="relative z-10 max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-zinc-900 sm:rounded-2xl">
            <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Comprobante recibido
            </h2>
            <form onSubmit={guardarRecibo} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Letra">
                  <Select value={recibo.letra} onChange={(e) => setRecibo({ ...recibo, letra: e.target.value as "A" | "B" | "C" })}>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                  </Select>
                </Field>
                <Field label="Número">
                  <Input value={recibo.numero} onChange={(e) => setRecibo({ ...recibo, numero: e.target.value })} placeholder="0001-00000001" />
                </Field>
                <Field label="Fecha">
                  <Input type="date" value={recibo.fecha} onChange={(e) => setRecibo({ ...recibo, fecha: e.target.value })} />
                </Field>
                <Field label="Monto">
                  <Input type="number" min={0} step="any" value={recibo.monto || ""} onChange={(e) => setRecibo({ ...recibo, monto: parseFloat(e.target.value) || 0 })} />
                </Field>
              </div>
              <Field label="Proveedor / emisor">
                <Input value={recibo.proveedor} onChange={(e) => setRecibo({ ...recibo, proveedor: e.target.value })} placeholder="Nombre o razón social" />
              </Field>
              <Field label="CUIT (opcional)">
                <Input value={recibo.cuit} onChange={(e) => setRecibo({ ...recibo, cuit: e.target.value })} placeholder="20-XXXXXXXX-X" />
              </Field>
              <Field label="Detalle (opcional)">
                <Input value={recibo.detalle} onChange={(e) => setRecibo({ ...recibo, detalle: e.target.value })} placeholder="Ej: Compra de mercadería" />
              </Field>
              <FormError message={reciboErr} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="white" onClick={() => setReciboOpen(false)}>Cancelar</Button>
                <Button type="submit">Guardar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function nextMonthKey(d: Date): string {
  const nd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return `${nd.getFullYear()}-${String(nd.getMonth()).padStart(2, "0")}`;
}

function mesLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MESES[m - 1]} ${y}`;
}

function factorAcumulado(inflacion: InflacionMes[], mesKey: string, meses: number): number {
  const sorted = inflacion.slice().sort((a, b) => a.mesKey.localeCompare(b.mesKey));
  const idx = sorted.findIndex((i) => i.mesKey === mesKey);
  if (idx === -1) return 1;
  let factor = 1;
  for (let i = idx + 1; i < sorted.length && i <= idx + meses; i++) {
    factor *= 1 + sorted[i].variacionPct / 100;
  }
  return factor;
}