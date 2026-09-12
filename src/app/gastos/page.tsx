"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Copy, Pencil, Plus, Search, Trash2, Wallet } from "lucide-react";
import { db, deleteGasto, saveGasto } from "@/lib/db";
import type { CategoriaGasto, Gasto } from "@/lib/types";
import { CATEGORIAS_GASTO, CATEGORIAS_GASTO_COLORS } from "@/lib/types";
import { fmtDate, fmtMoney, MESES } from "@/lib/format";
import { resumenMes } from "@/lib/calc";
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

const emptyForm = {
  categoria: "Insumos" as CategoriaGasto,
  descripcion: "",
  monto: 0,
  fecha: new Date().toISOString().slice(0, 10),
  recurrente: false,
};

function GastoForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Gasto | null;
  onSave: (g: Gasto) => Promise<void>;
  onCancel: () => void;
}) {
  const [f, setF] = useState(() =>
    initial
      ? {
          categoria: initial.categoria,
          descripcion: initial.descripcion,
          monto: initial.monto,
          fecha: fmtDate(initial.fecha).split("/").reverse().join("-"),
          recurrente: initial.recurrente,
        }
      : emptyForm
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof f, v: string | number | boolean) =>
    setF((s) => ({ ...s, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (f.monto <= 0) return setErr("El monto debe ser mayor a 0.");
    if (!f.descripcion.trim()) return setErr("Ingresá una descripción.");
    setBusy(true);
    const [yyyy, mm, dd] = f.fecha.split("-").map(Number);
    await onSave({
      id: initial?.id,
      categoria: f.categoria,
      descripcion: f.descripcion.trim(),
      monto: f.monto,
      fecha: new Date(yyyy, mm - 1, dd, 12).getTime(),
      recurrente: f.recurrente,
    });
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Categoría">
          <Select value={f.categoria} onChange={(e) => set("categoria", e.target.value)}>
            {CATEGORIAS_GASTO.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Monto ($)">
          <Input
            type="number"
            min={0}
            step="any"
            value={f.monto || ""}
            onChange={(e) => set("monto", e.target.value ? parseFloat(e.target.value) : 0)}
            placeholder="0"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Descripción">
            <Input
              value={f.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}
              placeholder="Ej: Campaña de Instagram"
              autoFocus
            />
          </Field>
        </div>
        <Field label="Fecha">
          <Input
            type="date"
            value={f.fecha}
            onChange={(e) => set("fecha", e.target.value)}
          />
        </Field>
        <label className="flex h-10 cursor-pointer items-center gap-2 self-end">
          <input
            type="checkbox"
            checked={f.recurrente}
            onChange={(e) => set("recurrente", e.target.checked)}
            className="h-4 w-4 rounded accent-emerald-600"
          />
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            Gasto recurrente (mensual)
          </span>
        </label>
      </div>

      {f.categoria === "Publicidad" && (
        <p className="rounded-lg bg-violet-500/10 px-3 py-2 text-xs text-violet-600 dark:text-violet-400">
          Este gasto se medirá contra las ventas para calcular el ROI de
          publicidad.
        </p>
      )}

      <FormError message={err} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="white" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {initial ? "Guardar cambios" : "Agregar gasto"}
        </Button>
      </div>
    </form>
  );
}

export default function GastosPage() {
  const gastos = useLiveQuery(() => db.gastos.toArray(), []);
  const ventas = useLiveQuery(() => db.ventas.toArray(), []);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Gasto | null>(null);
  const [deleting, setDeleting] = useState<Gasto | null>(null);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("Todas");
  const [mesFilter, setMesFilter] = useState("todos");
  const [copiedMsg, setCopiedMsg] = useState<string | null>(null);

  const monthOptions = useMemo(() => {
    const opts: { key: string; label: string; year: number; month: number }[] = [];
    const now = new Date();
    for (let i = 0; i < 13; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      opts.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: i === 0 ? "Mes actual" : `${MESES[d.getMonth()]} ${d.getFullYear()}`,
        year: d.getFullYear(),
        month: d.getMonth(),
      });
    }
    return opts;
  }, []);

  const filtered = useMemo(() => {
    if (!gastos) return [];
    const q = query.trim().toLowerCase();
    return gastos
      .filter((g) => {
        const d = new Date(g.fecha);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (mesFilter !== "todos" && key !== mesFilter) return false;
        if (catFilter !== "Todas" && g.categoria !== catFilter) return false;
        if (q && !g.descripcion.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => b.fecha - a.fecha);
  }, [gastos, mesFilter, catFilter, query]);

  const now = new Date();
  const mes = resumenMes(ventas || [], gastos || [], now.getFullYear(), now.getMonth());
  const publicidadMes = (gastos || [])
    .filter(
      (g) =>
        g.categoria === "Publicidad" &&
        new Date(g.fecha).getMonth() === now.getMonth() &&
        new Date(g.fecha).getFullYear() === now.getFullYear()
    )
    .reduce((s, g) => s + g.monto, 0);

  const copiarRecurrentes = async () => {
    if (!gastos) return;
    const [year, month] = mesFilter.split("-").map(Number);
    const existing = new Set(
      gastos
        .filter(
          (g) =>
            new Date(g.fecha).getFullYear() === year &&
            new Date(g.fecha).getMonth() === month
        )
        .map((g) => `${g.categoria}|${g.descripcion.trim().toLowerCase()}`)
    );
    const templates = new Map<string, Gasto>();
    for (const g of gastos) {
      if (g.recurrente) {
        const key = `${g.categoria}|${g.descripcion.trim().toLowerCase()}`;
        if (!templates.has(key)) templates.set(key, g);
      }
    }
    let added = 0;
    for (const [, g] of templates) {
      const key = `${g.categoria}|${g.descripcion.trim().toLowerCase()}`;
      if (existing.has(key)) continue;
      const d = new Date(g.fecha);
      const dia = Math.min(d.getDate(), 28);
      await saveGasto({
        categoria: g.categoria,
        descripcion: g.descripcion,
        monto: g.monto,
        fecha: new Date(year, month, dia, 12).getTime(),
        recurrente: true,
      });
      added += 1;
    }
    setCopiedMsg(
      added > 0
        ? `Se copiaron ${added} gasto(s) recurrente(s) al mes seleccionado.`
        : "No había gastos recurrentes para copiar en ese mes."
    );
    setTimeout(() => setCopiedMsg(null), 4000);
  };

  const totalEgresos = (gastos || []).reduce((s, g) => s + g.monto, 0);

  return (
    <div>
      <PageHeader
        title="Gastos / Egresos"
        subtitle="Registrá tus costos por categoría y medí el rendimiento de la publicidad."
        actions={
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4" /> Nuevo gasto
          </Button>
        }
      />

      {!gastos ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px]" />
          ))}
        </div>
      ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Egresos totales"
            value={fmtMoney(totalEgresos)}
            tone="negative"
            icon={<Wallet className="h-4 w-4" />}
            sub="Histórico"
          />
          <StatCard
            label="Egresos del mes"
            value={fmtMoney(mes.egresos)}
            tone="negative"
            sub={`Balance del mes: ${mes.balance >= 0 ? "" : "−"}${fmtMoney(Math.abs(mes.balance))}`}
          />
          <StatCard
            label="Publicidad del mes"
            value={fmtMoney(publicidadMes)}
            tone="accent"
            sub={
              mes.egresos > 0
                ? `${((publicidadMes / mes.egresos) * 100).toFixed(1)}% de los egresos`
                : "—"
            }
          />
          <StatCard
            label="Gastos recurrentes"
            value={(gastos || []).filter((g) => g.recurrente).length}
            tone="info"
            sub="Se marcan para copiar en meses nuevos"
          />
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 px-5 pb-4 pt-5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              className="pl-9"
              placeholder="Buscar por descripción…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select
            className="sm:w-44"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
          >
            <option value="Todas">Todas las categorías</option>
            {CATEGORIAS_GASTO.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
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
          {mesFilter !== "todos" && (
            <Button variant="white" onClick={copiarRecurrentes} title="Copiar gastos recurrentes al mes seleccionado">
              <Copy className="h-4 w-4" /> Copiar recurrentes
            </Button>
          )}
        </div>

        {copiedMsg && (
          <p className="mx-5 mb-3 rounded-lg bg-sky-500/10 px-3 py-2 text-xs text-sky-600 dark:text-sky-400">
            {copiedMsg}
          </p>
        )}

        {!gastos ? (
          <div className="space-y-2 px-5 pb-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState text="No hay gastos para mostrar en esta vista." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-3 py-3 font-medium">Categoría</th>
                  <th className="px-3 py-3 font-medium">Descripción</th>
                  <th className="px-3 py-3 text-right font-medium">Monto</th>
                  <th className="px-3 py-3 font-medium">Tipo</th>
                  <th className="px-3 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filtered.map((g) => (
                  <tr key={g.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                    <td className="px-5 py-3 whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
                      {fmtDate(g.fecha)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium"
                        style={{ color: CATEGORIAS_GASTO_COLORS[g.categoria] }}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: CATEGORIAS_GASTO_COLORS[g.categoria] }}
                        />
                        {g.categoria}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">
                      {g.descripcion}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                      {fmtMoney(g.monto)}
                    </td>
                    <td className="px-3 py-3">
                      {g.recurrente ? (
                        <Badge tone="sky">Recurrente</Badge>
                      ) : (
                        <Badge tone="zinc">Único</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        {g.recurrente && (
                          <span className="text-[10px] uppercase tracking-wide text-zinc-300 dark:text-zinc-600 flex items-center">
                            mensual
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setEditing(g);
                            setModalOpen(true);
                          }}
                          className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleting(g)}
                          className="rounded-lg p-1.5 text-zinc-500 hover:bg-rose-50 hover:text-rose-600 dark:text-zinc-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
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
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar gasto" : "Nuevo gasto"}
        wide
      >
        <GastoForm
          initial={editing}
          onCancel={() => setModalOpen(false)}
          onSave={async (g) => {
            await saveGasto(g);
            setModalOpen(false);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteGasto(deleting.id as number)}
        title="Eliminar gasto"
        message={`¿Eliminás el gasto "${deleting?.descripcion}" de ${fmtMoney(deleting?.monto ?? 0)}?`}
      />
    </div>
  );
}