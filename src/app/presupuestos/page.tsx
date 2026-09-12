"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { db, savePresupuesto } from "@/lib/db";
import type { CategoriaGasto, Presupuesto } from "@/lib/types";
import { CATEGORIAS_GASTO, CATEGORIAS_GASTO_COLORS } from "@/lib/types";
import { fmtMoney, MESES } from "@/lib/format";
import { gastosPorPresupuesto } from "@/lib/fiscal";
import { resumenMes } from "@/lib/calc";
import {
  Badge,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
  Tip,
} from "@/components/ui";

export default function PresupuestosPage() {
  const presupuestos = useLiveQuery(() => db.presupuestos.toArray(), []);
  const gastos = useLiveQuery(() => db.gastos.toArray(), []);
  const ventas = useLiveQuery(() => db.ventas.toArray(), []);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [msgs, setMsgs] = useState<string | null>(null);

  const years = useMemo(() => {
    const set = new Set<number>();
    set.add(year);
    for (const g of gastos || []) set.add(new Date(g.fecha).getFullYear());
    for (const v of ventas || []) set.add(new Date(v.fecha).getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [gastos, ventas, year]);

  const porCategoria = useMemo(() => {
    if (!gastos) return new Map<string, number>();
    return gastosPorPresupuesto(gastos, year, month);
  }, [gastos, year, month]);

  const mapa = useMemo(() => {
    const m = new Map<string, Presupuesto>();
    for (const p of presupuestos || []) m.set(p.categoria, p);
    return m;
  }, [presupuestos]);

  const mesLabel = `${MESES[month]} ${year}`;
  const rs = resumenMes(ventas || [], gastos || [], year, month);

  const rows = useMemo(() => {
    const out: {
      categoria: CategoriaGasto;
      presupuesto: number;
      gastado: number;
      pct: number;
    }[] = [];
    for (const c of CATEGORIAS_GASTO) {
      const presupuesto = mapa.get(c)?.montoMensual ?? 0;
      const gastado = porCategoria.get(c) ?? 0;
      out.push({
        categoria: c,
        presupuesto,
        gastado,
        pct: presupuesto > 0 ? (gastado / presupuesto) * 100 : 0,
      });
    }
    return out;
  }, [mapa, porCategoria]);

  const totalPpto = rows.reduce((s, r) => s + r.presupuesto, 0);
  const totalGasto = rows.reduce((s, r) => s + r.gastado, 0);
  const totalPct = totalPpto > 0 ? (totalGasto / totalPpto) * 100 : 0;

  const alertas = rows.filter((r) => r.presupuesto > 0 && r.pct >= 80);
  const superados = alertas.filter((r) => r.pct >= 100);

  return (
    <div>
      <PageHeader
        title="Presupuestos y control de gasto"
        subtitle={`Compará presupuestado vs gastado real de cada categoría. Mes: ${mesLabel}.`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          className="sm:w-32"
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
        <Select
          className="sm:w-44"
          value={month}
          onChange={(e) => setMonth(parseInt(e.target.value))}
        >
          {MESES.map((m, i) => (
            <option key={m} value={i}>{m}</option>
          ))}
        </Select>
      </div>

      {superados.length > 0 && (
        <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4" /> Gasto superado en categorías
          </p>
          <ul className="mt-2 list-disc pl-5 text-xs text-rose-600 dark:text-rose-400">
            {superados.map((r) => (
              <li key={r.categoria}>
                {r.categoria}: gastaste {fmtMoney(r.gastado)} — presupuesto:{" "}
                {fmtMoney(r.presupuesto)} ({r.pct.toFixed(0)}%)
              </li>
            ))}
          </ul>
        </div>
      )}
      {alertas.length > superados.length && (
        <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" /> Categorías cerca del límite (≥80%)
          </p>
          <ul className="mt-2 list-disc pl-5 text-xs text-amber-700 dark:text-amber-400">
            {alertas
              .filter((r) => r.pct < 100)
              .map((r) => (
                <li key={r.categoria}>
                  {r.categoria}: {fmtMoney(r.gastado)} / {fmtMoney(r.presupuesto)}{" "}
                  ({r.pct.toFixed(0)}%)
                </li>
              ))}
          </ul>
        </div>
      )}

      {!presupuestos || !gastos ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[108px]" />
          ))}
        </div>
      ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total presupuestado"
            value={fmtMoney(totalPpto)}
            tone="accent"
            icon={<Target className="h-4 w-4" />}
            sub={mesLabel}
          />
          <StatCard
            label="Total gastado"
            value={fmtMoney(totalGasto)}
            tone="negative"
            icon={<TrendingDown className="h-4 w-4" />}
            sub={`Balance: ${rs.balance >= 0 ? "+" : ""}${fmtMoney(rs.balance)}`}
          />
          <StatCard
            label="Presupuesto usado"
            value={`${totalPct > 0 ? totalPct.toFixed(0) : 0}%`}
            tone={totalPct > 100 ? "negative" : totalPct > 80 ? "accent" : "positive"}
            icon={<TrendingUp className="h-4 w-4" />}
            sub={
              totalPpto > 0
                ? `Disponible: ${fmtMoney(Math.max(totalPpto - totalGasto, 0))}`
                : "Definí presupuestos por categoría"
            }
          />
          <StatCard
            label="Categorías superadas"
            value={superados.length}
            tone={superados.length > 0 ? "negative" : "positive"}
            sub={superados.length > 0 ? "Revisá los gastos de estas categorías" : "Todo bajo control"}
          />
        </div>
      )}

      <Card>
        <CardHeader
          title="Presupuesto por categoría"
          subtitle="Definí el tope mensual de cada categoría y seguí el avance en tiempo real."
          right={<Tip text="Las categorías sin presupuesto no generan alertas. Usá el presupuesto para controlar que no te vayas del rango en Publicidad, Insumos, etc." />}
        />
        <div className="space-y-4 px-5 py-4">
          {rows.map((r) => (
            <div key={r.categoria}>
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: CATEGORIAS_GASTO_COLORS[r.categoria] }}
                  />
                  {r.categoria}
                </span>
                <div className="flex items-center gap-3 text-xs">
                  {r.presupuesto > 0 && (
                    <>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        {fmtMoney(r.gastado)} / {fmtMoney(r.presupuesto)}
                      </span>
                      <Badge
                        tone={
                          r.pct >= 100
                            ? "red"
                            : r.pct >= 80
                              ? "amber"
                              : "green"
                        }
                      >
                        {r.pct.toFixed(0)}%
                      </Badge>
                    </>
                  )}
                  {r.presupuesto === 0 && (
                    <span className="font-semibold text-zinc-500 dark:text-zinc-400">
                      {fmtMoney(r.gastado)} (sin presupuesto)
                    </span>
                  )}
                </div>
              </div>
              {r.presupuesto > 0 && (
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${
                        r.pct >= 100
                          ? "bg-rose-500"
                          : r.pct >= 80
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(r.pct, 100)}%` }}
                    />
                  </div>
                  <PresupuestoInput
                    categoria={r.categoria}
                    value={r.presupuesto}
                    onSave={(val) => {
                      savePresupuesto({ categoria: r.categoria, montoMensual: val });
                      setMsgs(`Presupuesto de ${r.categoria} actualizado.`);
                      setTimeout(() => setMsgs(null), 2500);
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {msgs && (
        <p className="mt-3 text-right text-xs font-medium text-emerald-600 dark:text-emerald-400">
          {msgs}
        </p>
      )}

      <Card className="mt-4 p-5">
        <CardHeader
          title="Resumen comparativo del mes"
          subtitle="Presupuestado vs real, por categoría, con estado."
        />
        <div className="grid gap-4 px-5 pt-4 sm:grid-cols-2 lg:grid-cols-5">
          {rows.filter((r) => r.presupuesto > 0).length === 0 ? (
            <p className="col-span-full py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
              Cargá presupuestos por categoría para ver el comparativo.
            </p>
          ) : (
            rows
              .filter((r) => r.presupuesto > 0)
              .map((r) => (
                <div
                  key={r.categoria}
                  className={`rounded-2xl border p-4 ${
                    r.pct >= 100
                      ? "border-rose-500/30 bg-rose-500/5"
                      : r.pct >= 80
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-zinc-200 bg-zinc-100/50 dark:border-zinc-800 dark:bg-zinc-800/40"
                  }`}
                >
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: CATEGORIAS_GASTO_COLORS[r.categoria] }}
                    />
                    {r.categoria}
                  </p>
                  <p className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    {r.pct.toFixed(0)}%
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {fmtMoney(r.gastado)} / {fmtMoney(r.presupuesto)}
                  </p>
                  {r.pct >= 100 ? (
                    <Badge tone="red">Superado</Badge>
                  ) : r.pct >= 80 ? (
                    <Badge tone="amber">Cerca</Badge>
                  ) : (
                    <Badge tone="green">OK</Badge>
                  )}
                </div>
              ))
          )}
        </div>
      </Card>
    </div>
  );
}

function PresupuestoInput({
  categoria,
  value,
  onSave,
}: {
  categoria: string;
  value: number;
  onSave: (val: number) => void;
}) {
  return (
    <Field label={categoria}>
      <Input
        type="number"
        min={0}
        step="any"
        className="w-32 text-right"
        defaultValue={value || ""}
        onBlur={(e) => {
          const num = parseFloat(e.target.value.replace(/,/g, ""));
          if (!isNaN(num) && num >= 0 && num !== value) onSave(num);
        }}
        title={`Presupuesto mensual de ${categoria}`}
        placeholder="0"
      />
    </Field>
  );
}