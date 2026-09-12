"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FileDown, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { db, eliminarVenta, registrarVenta, saveFactura } from "@/lib/db";
import type { Venta } from "@/lib/types";
import { METODOS_PAGO } from "@/lib/types";
import { fmtDateTime, fmtMoney, MESES, toTimestamp } from "@/lib/format";
import { resumenMes } from "@/lib/calc";
import { feedbackExito } from "@/lib/capacitor";
import {
  getFiscalConfig,
  incrementarContadorFactura,
} from "@/lib/config";
import { calcularIva, letraPara } from "@/lib/fiscal";
import { generarFacturaPDF } from "@/lib/export";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  FormError,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
} from "@/components/ui";

const PAGE_SIZE = 50;

function VentaForm({
  onSave,
  onCancel,
}: {
  onSave: (v: Omit<Venta, "id" | "nombreProducto" | "costoUnitario">) => Promise<void>;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    productoId: 0,
    cantidad: 1,
    precioUnitario: 0,
    fecha: "",
    cliente: "",
    metodoPago: "Efectivo",
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const productos = useLiveQuery(
    () => db.productos.orderBy("nombre").toArray(),
    []
  );
  const product = productos?.find((p) => p.id === f.productoId);

  const set = (k: keyof typeof f, v: string | number) =>
    setF((s) => ({ ...s, [k]: v }));

  const chooseProduct = (id: number) => {
    const p = productos?.find((x) => x.id === id);
    setF((s) => ({
      ...s,
      productoId: id,
      precioUnitario: p ? p.precio : s.precioUnitario,
    }));
  };

  const subtotal = f.cantidad * f.precioUnitario;
  const ganancia = product ? (f.precioUnitario - product.costo) * f.cantidad : 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!f.productoId) return setErr("Elegí un producto.");
    if (!product) return setErr("Producto no encontrado.");
    if (f.cantidad <= 0) return setErr("La cantidad debe ser mayor a 0.");
    if (product.stock < f.cantidad)
      return setErr(
        `Stock insuficiente: quedan ${product.stock} unidades de ${product.nombre}.`
      );
    if (f.precioUnitario <= 0) return setErr("Ingresá un precio de venta.");
    setBusy(true);
    try {
      const fechaTs = f.fecha ? toTimestamp(f.fecha) : Date.now();
      await onSave({
        productoId: f.productoId,
        cantidad: f.cantidad,
        precioUnitario: f.precioUnitario,
        fecha: fechaTs,
        cliente: f.cliente.trim(),
        metodoPago: f.metodoPago as Venta["metodoPago"],
      });
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Producto *">
        <Select value={f.productoId || ""} onChange={(e) => chooseProduct(parseInt(e.target.value || "0"))}>
          <option value="">Seleccionar producto…</option>
          {(productos || []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} — {p.stock} uds
            </option>
          ))}
        </Select>
      </Field>

      {product && (
        <div className="flex flex-wrap gap-2">
          <Badge tone="sky">Stock: {product.stock}</Badge>
          <Badge tone="zinc">Costo: {fmtMoney(product.costo)}</Badge>
          <Badge tone="green">Precio sugerido: {fmtMoney(product.precio)}</Badge>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Cantidad *">
          <Input
            type="number"
            min={1}
            step={1}
            value={f.cantidad || ""}
            onChange={(e) => set("cantidad", e.target.value ? parseInt(e.target.value) : 0)}
          />
        </Field>
        <Field label="Precio de venta unitario ($) *">
          <Input
            type="number"
            min={0}
            step="any"
            value={f.precioUnitario || ""}
            onChange={(e) => set("precioUnitario", e.target.value ? parseFloat(e.target.value) : 0)}
          />
        </Field>
        <Field label="Fecha y hora" hint="Si lo dejás vacío, se toma el momento actual.">
          <Input
            type="datetime-local"
            value={f.fecha}
            onChange={(e) => set("fecha", e.target.value)}
          />
        </Field>
        <Field label="Método de pago">
          <Select
            value={f.metodoPago}
            onChange={(e) => set("metodoPago", e.target.value)}
          >
            {METODOS_PAGO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Cliente (opcional)">
            <Input
              value={f.cliente}
              onChange={(e) => set("cliente", e.target.value)}
              placeholder="Ej: Juan Pérez"
            />
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl bg-zinc-100 px-4 py-3 text-center dark:bg-zinc-800/60">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Subtotal de la venta</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {fmtMoney(subtotal)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Ganancia estimada</p>
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {fmtMoney(ganancia)}
          </p>
        </div>
      </div>

      <FormError message={err} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="white" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Registrando…" : "Registrar venta"}
        </Button>
      </div>
    </form>
  );
}

export default function VentasPage() {
  const ventas = useLiveQuery(() => db.ventas.toArray(), []);

  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mesFilter, setMesFilter] = useState("todos");
  const [deleting, setDeleting] = useState<Venta | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [factsMsg, setFactsMsg] = useState<string | null>(null);
  const [horaActual] = useState(() => Date.now());

  const facturarVenta = async (v: Venta) => {
    const fiscal = getFiscalConfig();
    const letraF = letraPara(fiscal);
    const n = incrementarContadorFactura(letraF);
    const numero = `${(fiscal.ptoVenta || "0001").trim()}-${String(n).padStart(8, "0")}`;
    const factura = {
      tipo: "emitida" as const,
      letra: letraF,
      numero,
      fecha: horaActual,
      cliente: v.cliente || "Consumidor final",
      cuit: "",
      condicion: fiscal.condicionIva,
      monto: v.cantidad * v.precioUnitario,
      detalle: `${v.nombreProducto} × ${v.cantidad}`,
      ventaId: v.id,
    };
    await saveFactura(factura);
    generarFacturaPDF(factura, fiscal);
    setFactsMsg(
      `Factura ${letraF} ${numero} generada` +
        (letraF === "A" ? ` · IVA incluido: ${fmtMoney(calcularIva(factura.monto, fiscal.ivaPct, true))}` : "") +
        ". Se descargó el PDF."
    );
    setTimeout(() => setFactsMsg(null), 5000);
  };

  const monthOptions = useMemo(() => {
    const opts: { key: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 13; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label =
        i === 0
          ? "Mes actual"
          : `${MESES[d.getMonth()]} ${d.getFullYear()}`;
      opts.push({ key, label });
    }
    return opts;
  }, []);

  const filtered = useMemo(() => {
    if (!ventas) return [];
    const q = query.trim().toLowerCase();
    return ventas
      .filter((v) => {
        const d = new Date(v.fecha);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (mesFilter !== "todos" && key !== mesFilter) return false;
        if (
          q &&
          !v.nombreProducto.toLowerCase().includes(q) &&
          !(v.cliente || "").toLowerCase().includes(q)
        )
          return false;
        return true;
      })
      .sort((a, b) => b.fecha - a.fecha)
      .slice(0, limit);
  }, [ventas, query, mesFilter, limit]);

  const totalFiltrado = useMemo(() => {
    if (!ventas) return 0;
    let t = 0;
    for (const v of ventas) {
      const d = new Date(v.fecha);
      if (mesFilter === "todos" || `${d.getFullYear()}-${d.getMonth()}` === mesFilter)
        t += v.cantidad * v.precioUnitario;
    }
    return t;
  }, [ventas, mesFilter]);

  const now = new Date();
  const mesActual = resumenMes(ventas || [], [], now.getFullYear(), now.getMonth());

  return (
    <div>
      <PageHeader
        title="Ventas e Ingresos"
        subtitle="Registrá cada venta: el stock se descuenta automáticamente."
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Registrar venta
          </Button>
        }
      />

      {!ventas ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px]" />
          ))}
        </div>
      ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Ingresos del mes"
            value={fmtMoney(mesActual.ingresos)}
            tone="positive"
            icon={<ShoppingCart className="h-4 w-4" />}
            sub={`${new Set((ventas || []).filter((v) => new Date(v.fecha).getMonth() === now.getMonth() && new Date(v.fecha).getFullYear() === now.getFullYear()).map((v) => v.nombreProducto)).size} productos distintos vendidos`}
          />
          <StatCard
            label="Total filtrado"
            value={fmtMoney(totalFiltrado)}
            sub={
              mesFilter === "todos"
                ? "Todos los registros"
                : monthOptions.find((o) => o.key === mesFilter)?.label
            }
          />
          <StatCard
            label="Utilidad bruta del mes"
            value={fmtMoney(
              (ventas || [])
                .filter(
                  (v) =>
                    new Date(v.fecha).getMonth() === now.getMonth() &&
                    new Date(v.fecha).getFullYear() === now.getFullYear()
                )
                .reduce((s, v) => s + (v.precioUnitario - v.costoUnitario) * v.cantidad, 0)
            )}
            tone="accent"
            sub="Ingresos menos costo de las mercaderías vendidas"
          />
          <StatCard
            label="Ventas registradas"
            value={(ventas || []).length}
            tone="info"
            sub="Total histórico"
          />
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 px-5 pb-4 pt-5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              className="pl-9"
              placeholder="Buscar por producto o cliente…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select
            className="sm:w-48"
            value={mesFilter}
            onChange={(e) => setMesFilter(e.target.value)}
          >
            <option value="todos">Todos los meses</option>
            {monthOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        {!ventas ? (
          <div className="space-y-2 px-5 pb-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState text="No hay ventas para mostrar. Registrá tu primera venta." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-3 py-3 font-medium">Producto</th>
                    <th className="px-3 py-3 text-right font-medium">Cant.</th>
                    <th className="px-3 py-3 text-right font-medium">P. unitario</th>
                    <th className="px-3 py-3 text-right font-medium">Total</th>
                    <th className="px-3 py-3 font-medium">Cliente</th>
                    <th className="px-3 py-3 font-medium">Método</th>
                    <th className="px-3 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filtered.map((v) => (
                    <tr key={v.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                      <td className="px-5 py-3 whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
                        {fmtDateTime(v.fecha)}
                      </td>
                      <td className="px-3 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                        {v.nombreProducto}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{v.cantidad}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                        {fmtMoney(v.precioUnitario)}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {fmtMoney(v.cantidad * v.precioUnitario)}
                      </td>
                      <td className="px-3 py-3 text-zinc-600 dark:text-zinc-300">
                        {v.cliente || "—"}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone="zinc">{v.metodoPago}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          {!v.externa && (
                            <button
                              onClick={() => facturarVenta(v)}
                              className="rounded-lg p-1.5 text-zinc-500 hover:bg-emerald-50 hover:text-emerald-600 dark:text-zinc-400 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
                              title="Generar factura electrónica (PDF)"
                            >
                              <FileDown className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setDeleting(v)}
                            className="rounded-lg p-1.5 text-zinc-500 hover:bg-rose-50 hover:text-rose-600 dark:text-zinc-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                            title="Eliminar (repone stock)"
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
            {(ventas || []).length > limit && (
              <div className="px-5 pb-4 pt-2 text-center">
                <Button variant="white" size="sm" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                  Cargar más
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {factsMsg && (
        <p className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          {factsMsg}
        </p>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Registrar venta"
        wide
      >
        <VentaForm
          onCancel={() => setModalOpen(false)}
          onSave={async (v) => {
            await registrarVenta(v);
            void feedbackExito();
            setModalOpen(false);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && eliminarVenta(deleting.id as number)}
        title="Eliminar venta"
        message={`¿Eliminás la venta de "${deleting?.nombreProducto}" (${deleting?.cantidad} uds)? Se repondrá el stock del producto.`}
      />
    </div>
  );
}