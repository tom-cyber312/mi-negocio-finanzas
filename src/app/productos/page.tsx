"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Pencil, Plus, Search, Trash2, Package } from "lucide-react";
import { db, deleteProducto, saveProducto } from "@/lib/db";
import type { Producto } from "@/lib/types";
import { CATEGORIAS_PRODUCTO } from "@/lib/types";
import { fmtMoney } from "@/lib/format";
import { marginPct, isStockBajo } from "@/lib/calc";
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
  Skeleton,
  Select,
  StatCard,
} from "@/components/ui";

const emptyForm = {
  nombre: "",
  categoria: "Alimentos",
  sku: "",
  costo: 0,
  precio: 0,
  stock: 0,
  umbralStock: 10,
};

function StockBadge({ p }: { p: Producto }) {
  if (p.stock === 0)
    return <Badge tone="red">Agotado</Badge>;
  if (isStockBajo(p)) return <Badge tone="amber">Bajo ({p.stock})</Badge>;
  return <Badge tone="green">{p.stock} uds</Badge>;
}

function ProductoForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Producto | null;
  onSave: (p: Producto) => Promise<void>;
  onCancel: () => void;
}) {
  const [f, setF] = useState(() =>
    initial
      ? {
          nombre: initial.nombre,
          categoria: initial.categoria,
          sku: initial.sku,
          costo: initial.costo,
          precio: initial.precio,
          stock: initial.stock,
          umbralStock: initial.umbralStock,
        }
      : emptyForm
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const margen =
    f.precio > 0 ? ((f.precio - f.costo) / f.precio) * 100 : 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!f.nombre.trim()) return setErr("Ingresá el nombre del producto.");
    if (f.precio <= 0) return setErr("El precio de venta debe ser mayor a 0.");
    if (f.costo < 0 || f.precio < f.costo)
      setErr("El costo no puede superar al precio.");
    if (f.stock < 0) return setErr("El stock no puede ser negativo.");
    setBusy(true);
    await onSave({
      id: initial?.id,
      nombre: f.nombre.trim(),
      categoria: f.categoria.trim() || "Otros",
      sku: f.sku.trim(),
      costo: f.costo,
      precio: f.precio,
      stock: f.stock,
      umbralStock: f.umbralStock,
      createdAt: initial?.createdAt ?? Date.now(),
    });
    setBusy(false);
  };

  const set = (k: keyof typeof f, v: string | number) =>
    setF((s) => ({ ...s, [k]: v }));

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Nombre *">
            <Input
              value={f.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              placeholder="Ej: Café molido 250g"
              autoFocus
            />
          </Field>
        </div>
        <Field label="Categoría">
          <Input
            list="cat-productos"
            value={f.categoria}
            onChange={(e) => set("categoria", e.target.value)}
          />
          <datalist id="cat-productos">
            {CATEGORIAS_PRODUCTO.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="SKU / Código">
          <Input
            value={f.sku}
            onChange={(e) => set("sku", e.target.value)}
            placeholder="Ej: CAF-002"
          />
        </Field>
        <Field label="Costo de insumos / producción ($)">
          <Input
            type="number"
            min={0}
            step="any"
            value={f.costo || ""}
            onChange={(e) => set("costo", e.target.value ? parseFloat(e.target.value) : 0)}
            placeholder="0"
          />
        </Field>
        <Field label="Precio de venta ($)">
          <Input
            type="number"
            min={0}
            step="any"
            value={f.precio || ""}
            onChange={(e) => set("precio", e.target.value ? parseFloat(e.target.value) : 0)}
            placeholder="0"
          />
        </Field>
        <Field label="Stock disponible">
          <Input
            type="number"
            min={0}
            step="1"
            value={f.stock}
            onChange={(e) => set("stock", e.target.value ? parseInt(e.target.value) : 0)}
            placeholder="0"
          />
        </Field>
        <Field
          label="Umbral de alerta"
          hint="Recibirás alerta cuando el stock esté en o por debajo de esta cantidad."
        >
          <Input
            type="number"
            min={0}
            step="1"
            value={f.umbralStock}
            onChange={(e) => set("umbralStock", e.target.value ? parseInt(e.target.value) : 0)}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-zinc-100 px-4 py-3 dark:bg-zinc-800/60">
        <span className="text-sm text-zinc-600 dark:text-zinc-300">
          Margen de ganancia
        </span>
        <span
          className={`text-lg font-bold ${
            margen < 25
              ? "text-amber-500"
              : margen < 0
                ? "text-rose-500"
                : "text-emerald-500"
          }`}
        >
          {margen.toFixed(1)}%
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-center text-xs">
        <div className="rounded-xl bg-zinc-100 px-3 py-2.5 dark:bg-zinc-800/60">
          <p className="text-zinc-500 dark:text-zinc-400">Ganancia por unidad</p>
          <p className="mt-0.5 text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {fmtMoney(f.precio - f.costo)}
          </p>
        </div>
        <div className="rounded-xl bg-zinc-100 px-3 py-2.5 dark:bg-zinc-800/60">
          <p className="text-zinc-500 dark:text-zinc-400">Costo total en stock</p>
          <p className="mt-0.5 text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {fmtMoney(f.costo * f.stock)}
          </p>
        </div>
      </div>

      <FormError message={err} />
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="white" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {initial ? "Guardar cambios" : "Crear producto"}
        </Button>
      </div>
    </form>
  );
}

export default function ProductosPage() {
  const productos = useLiveQuery(
    () => db.productos.orderBy("nombre").toArray().catch(() => [] as Producto[]),
    []
  );
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("Todas");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);
  const [deleting, setDeleting] = useState<Producto | null>(null);

  const filtered = useMemo(() => {
    if (!productos) return [];
    const q = query.trim().toLowerCase();
    return productos.filter((p) => {
      const matchQ =
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q);
      const matchCat = catFilter === "Todas" || p.categoria === catFilter;
      return matchQ && matchCat;
    });
  }, [productos, query, catFilter]);

  const stats = useMemo(() => {
    if (!productos) return null;
    let capital = 0;
    let gananciaPotencial = 0;
    let valorPotencial = 0;
    let bajos = 0;
    for (const p of productos) {
      capital += p.costo * p.stock;
      gananciaPotencial += (p.precio - p.costo) * p.stock;
      valorPotencial += p.precio * p.stock;
      if (isStockBajo(p)) bajos += 1;
    }
    return { capital, gananciaPotencial, valorPotencial, bajos };
  }, [productos]);

  const categorias = useMemo(() => {
    if (!productos) return [];
    return Array.from(new Set(productos.map((p) => p.categoria))).sort();
  }, [productos]);

  return (
    <div>
      <PageHeader
        title="Productos e Inventario"
        subtitle="Administrá catálogo, costos, márgenes y stock."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nuevo producto
          </Button>
        }
      />

      {!productos || !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px]" />
          ))}
        </div>
      ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Productos activos"
            value={productos.length}
            icon={<Package className="h-4 w-4" />}
            sub={
              stats.bajos > 0
                ? `${stats.bajos} con stock bajo/agotado`
                : "Sin alertas de stock"
            }
          />
          <StatCard
            label="Capital invertido (insumos en stock)"
            value={fmtMoney(stats.capital)}
            tone="accent"
            sub="Suma de costo × stock actual"
          />
          <StatCard
            label="Ganancia potencial"
            value={fmtMoney(stats.gananciaPotencial)}
            tone="positive"
            sub={`Venta total estimada: ${fmtMoney(stats.valorPotencial)}`}
          />
          <StatCard
            label="Alertas de stock"
            value={stats.bajos}
            tone={stats.bajos > 0 ? "negative" : "positive"}
            sub="Productos bajo umbral o agotados"
          />
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 px-5 pb-4 pt-5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              className="pl-9"
              placeholder="Buscar por nombre, SKU o categoría…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select
            className="sm:w-52"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
          >
            <option value="Todas">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        {!productos ? (
          <div className="space-y-2 px-5 pb-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState text="No hay productos que coincidan. Creá tu primer producto con el botón «Nuevo producto»." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <th className="px-5 py-3 font-medium">Producto</th>
                  <th className="px-3 py-3 font-medium">Categoría</th>
                  <th className="px-3 py-3 text-right font-medium">Costo</th>
                  <th className="px-3 py-3 text-right font-medium">Precio</th>
                  <th className="px-3 py-3 text-right font-medium">Margen</th>
                  <th className="px-3 py-3 font-medium">Stock</th>
                  <th className="px-3 py-3 text-right font-medium">Costo invertido</th>
                  <th className="px-3 py-3 text-right font-medium">Ganancia potencial</th>
                  <th className="px-3 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filtered.map((p) => {
                  const m = marginPct(p);
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {p.nombre}
                        </p>
                        <p className="text-xs text-zinc-400">{p.sku || "—"}</p>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone="zinc">{p.categoria}</Badge>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                        {fmtMoney(p.costo)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                        {fmtMoney(p.precio)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span
                          className={`font-semibold tabular-nums ${
                            m < 25
                              ? "text-amber-500"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {m.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <StockBadge p={p} />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                        {fmtMoney(p.costo * p.stock)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                        {fmtMoney((p.precio - p.costo) * p.stock)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditing(p);
                              setModalOpen(true);
                            }}
                            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleting(p)}
                            className="rounded-lg p-1.5 text-zinc-500 hover:bg-rose-50 hover:text-rose-600 dark:text-zinc-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Editar: ${editing.nombre}` : "Nuevo producto"}
        wide
      >
        <ProductoForm
          initial={editing}
          onCancel={() => setModalOpen(false)}
          onSave={async (p) => {
            await saveProducto(p);
            setModalOpen(false);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteProducto(deleting.id as number)}
        title="Eliminar producto"
        message={`¿Eliminás "${deleting?.nombre}"? Las ventas históricas se conservan, pero el producto dejará de aparecer en el catálogo.`}
      />
    </div>
  );
}