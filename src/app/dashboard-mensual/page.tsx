"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Download,
  FileSpreadsheet,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { db } from "@/lib/db";
import { fmtMoney, MESES } from "@/lib/format";
import {
  acumuladoDiario,
  egresosPorCategoria,
  evolucionDiaria,
  pctVariacion,
  resumenMes,
} from "@/lib/calc";
import { ajustarValor, gastosPorPresupuesto, mesKeyDeFecha } from "@/lib/fiscal";
import { exportarExcelMensual, exportarPDFMensual } from "@/lib/export";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Select,
  Skeleton,
  StatCard,
  Tip,
} from "@/components/ui";
import { LineEvolucion, PieGastos } from "@/components/charts";
import { CATEGORIAS_GASTO, CATEGORIAS_GASTO_COLORS } from "@/lib/types";
import type { Presupuesto } from "@/lib/types";

export default function DashboardMensualPage() {
  const [sel, setSel] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  });
  const [hasManual, setHasManual] = useState(false);
  const [ajustado, setAjustado] = useState(false);

  const ventas = useLiveQuery(() => db.ventas.toArray(), []);
  const gastos = useLiveQuery(() => db.gastos.toArray(), []);
  const presupuestos = useLiveQuery(() => db.presupuestos.toArray(), []);
  const inflacion = useLiveQuery(() => db.inflacion.toArray(), []);

  const { year, month } = sel;

  const years = useMemo(() => {
    if (!ventas || !gastos) return [sel.year];
    const set = new Set<number>([sel.year]);
    for (const v of ventas) set.add(new Date(v.fecha).getFullYear());
    for (const g of gastos) set.add(new Date(g.fecha).getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [ventas, gastos, sel.year]);

  const data = useMemo(() => {
    if (!ventas || !gastos) return null;
    const mes = resumenMes(ventas, gastos, year, month);
    const prev = new Date(year, month - 1, 1);
    const mesPrev = resumenMes(ventas, gastos, prev.getFullYear(), prev.getMonth());
    const diario = evolucionDiaria(ventas, gastos, year, month);
    const acumulado = acumuladoDiario(diario);
    const categorias = egresosPorCategoria(mes.gastos);
    const gastadoPorCat = gastosPorPresupuesto(gastos, year, month);
    return { mes, mesPrev, diario, acumulado, categorias, gastadoPorCat };
  }, [ventas, gastos, year, month]);

  const cambiarMes = (y: number, m: number) => {
    setSel({ year: y, month: m });
    setHasManual(true);
  };

  const selectedLabel = `${MESES[month]} ${year}`;
  const curKey = mesKeyDeFecha(new Date(year, month, 1).getTime());
  const prevDate = new Date(year, month - 1, 1);
  const prevKey = mesKeyDeFecha(prevDate.getTime());
  const prevIngresos = ajustado
    ? ajustarValor(data?.mesPrev.ingresos ?? 0, inflacion || [], prevKey, curKey)
    : data?.mesPrev.ingresos ?? 0;
  const prevEgresos = ajustado
    ? ajustarValor(data?.mesPrev.egresos ?? 0, inflacion || [], prevKey, curKey)
    : data?.mesPrev.egresos ?? 0;
  const pctIngresos = data
    ? pctVariacion(data.mes.ingresos, prevIngresos)
    : null;
  const pctEgresos = data
    ? pctVariacion(data.mes.egresos, prevEgresos)
    : null;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">
            Balance mensual
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {selectedLabel}
            {hasManual ? " (seleccionado manualmente)" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={ajustado}
              onChange={(e) => setAjustado(e.target.checked)}
              className="h-4 w-4 rounded accent-emerald-600"
            />
            Ajustado por inflación
            <Tip text="Lleva los valores del mes anterior a moneda de hoy según la tabla de inflación cargada en Facturación, para comparar la venta real, no la nominal." />
          </label>
          <Select
            className="sm:w-40"
            value={year}
            onChange={(e) => cambiarMes(parseInt(e.target.value), month)}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
          <Select
            className="sm:w-44"
            value={month}
            onChange={(e) => cambiarMes(year, parseInt(e.target.value))}
          >
            {MESES.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </Select>
          <Button
            variant="white"
            onClick={() =>
              data && exportarPDFMensual(year, month, data.mes.ventas, data.mes.gastos, data.mes.ingresos, data.mes.egresos)
            }
          >
            <Download className="h-4 w-4" /> PDF
          </Button>
          <Button
            variant="white"
            onClick={() =>
              data && exportarExcelMensual(year, month, data.mes.ventas, data.mes.gastos, data.mes.ingresos, data.mes.egresos)
            }
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      {!data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[108px]" />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Ingresos del mes"
              value={fmtMoney(data.mes.ingresos)}
              tone="positive"
              icon={<TrendingUp className="h-4 w-4" />}
              sub={comparison(pctIngresos)}
            />
            <StatCard
              label="Egresos del mes"
              value={fmtMoney(data.mes.egresos)}
              tone="negative"
              icon={<TrendingDown className="h-4 w-4" />}
              sub={comparisonEgresos(pctEgresos)}
            />
            <StatCard
              label="Balance neto del mes"
              value={fmtMoney(data.mes.balance)}
              tone={data.mes.balance >= 0 ? "positive" : "negative"}
              sub="Ingresos − egresos"
            />
            <StatCard
              label="Actividad"
              value={`${data.mes.ventas.length} ventas`}
              tone="info"
              sub={`${data.mes.gastos.length} gastos registrados`}
            />
          </div>

          <PresupuestoInfo
            gastadoPorCat={data.gastadoPorCat}
            presupuestos={presupuestos || []}
            month={month}
            year={year}
          />

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Evolución día a día (acumulado)"
                subtitle="Ingresos vs egresos dentro del mes"
              />
              <div className="px-3 py-4">
                <LineEvolucion data={data.acumulado} />
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Gastos por categoría"
                subtitle="Desglose del mes"
              />
              <div className="px-3 py-2">
                {data.categorias.length ? (
                  <PieGastos data={data.categorias} showLegend={false} height={180} />
                ) : (
                  <p className="py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
                    Sin gastos en este mes
                  </p>
                )}
                <div className="mt-2 space-y-1.5 px-2 pb-2">
                  {data.categorias.map((c) => (
                    <div
                      key={c.name}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: CATEGORIAS_GASTO_COLORS[c.name as keyof typeof CATEGORIAS_GASTO_COLORS] || c.color }}
                        />
                        {c.name}
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {fmtMoney(c.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Mayores gastos del mes" />
              <div className="px-5 py-4">
                {data.mes.gastos.length ? (
                  <div className="space-y-2.5">
                    {data.mes.gastos
                      .slice()
                      .sort((a, b) => b.monto - a.monto)
                      .slice(0, 5)
                      .map((g) => (
                        <div
                          key={g.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Badge tone="zinc">{g.categoria}</Badge>
                            <span className="truncate text-zinc-600 dark:text-zinc-300">
                              {g.descripcion}
                            </span>
                          </span>
                          <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                            {fmtMoney(g.monto)}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
                    No hay gastos registrados.
                  </p>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Ingresos por método de pago" />
              <div className="px-5 py-4">
                <PagosResumen month={month} year={year} />
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );

  function comparison(pct: number | null) {
    if (pct === null)
      return "Sin datos del mes anterior (o mes sin ingresos)";
    return pct >= 0
      ? `${pct.toFixed(1)}% vs mes anterior`
      : `${pct.toFixed(1)}% vs mes anterior`;
  }

  function comparisonEgresos(pct: number | null) {
    if (pct === null) return "Sin datos del mes anterior";
    return `${pct.toFixed(1)}% vs mes anterior`;
  }
}

function PresupuestoInfo({
  gastadoPorCat,
  presupuestos,
  month,
  year,
}: {
  gastadoPorCat: Map<string, number>;
  presupuestos: Presupuesto[];
  month: number;
  year: number;
}) {
  const rows = CATEGORIAS_GASTO.map((c) => {
    const p = presupuestos.find((x) => x.categoria === c);
    const presupuesto = p?.montoMensual ?? 0;
    const gastado = gastadoPorCat.get(c) ?? 0;
    return {
      categoria: c,
      presupuesto,
      gastado,
      pct: presupuesto > 0 ? (gastado / presupuesto) * 100 : 0,
    };
  });
  const conPpto = rows.filter((r) => r.presupuesto > 0);
  if (!conPpto.length) return null;
  const totalPpto = conPpto.reduce((s, r) => s + r.presupuesto, 0);
  const totalGasto = conPpto.reduce((s, r) => s + r.gastado, 0);

  return (
    <Card className="mb-4">
      <CardHeader
        title="Presupuesto vs gastado"
        subtitle={`${MESES[month]} ${year}`}
        right={
          <Badge tone={totalGasto / (totalPpto || 1) >= 1 ? "red" : totalGasto / (totalPpto || 1) > 0.8 ? "amber" : "green"}>
            {((totalGasto / (totalPpto || 1)) * 100).toFixed(0)}% del total
          </Badge>
        }
      />
      <div className="space-y-2.5 px-5 pb-5 pt-3">
        {conPpto.map((r) => (
          <div key={r.categoria} className="flex items-center gap-3">
            <span className="flex w-24 shrink-0 items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: CATEGORIAS_GASTO_COLORS[r.categoria as keyof typeof CATEGORIAS_GASTO_COLORS] }}
              />
              {r.categoria}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-800">
              <div
                className={`h-full rounded-full ${
                  r.pct >= 100 ? "bg-rose-500" : r.pct >= 80 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(r.pct, 100)}%` }}
              />
            </div>
            <span className="w-32 shrink-0 text-right text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
              {fmtMoney(r.gastado)} / {fmtMoney(r.presupuesto)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PagosResumen({ month, year }: { month: number; year: number }) {
  const ventas = useLiveQuery(() => db.ventas.toArray(), []);
  const rows = useMemo(() => {
    if (!ventas) return [];
    const map = new Map<string, number>();
    for (const v of ventas) {
      const d = new Date(v.fecha);
      if (d.getFullYear() === year && d.getMonth() === month) {
        map.set(
          v.metodoPago,
          (map.get(v.metodoPago) || 0) + v.cantidad * v.precioUnitario
        );
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => {
        const total = Array.from(map.values()).reduce((s, x) => s + x, 0);
        return { name, value, pct: total ? (value / total) * 100 : 0 };
      });
  }, [ventas, month, year]);

  if (!ventas) return <Skeleton className="h-[120px]" />;
  if (!rows.length)
    return (
      <p className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
        Sin ventas en este mes.
      </p>
    );

  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.name}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {r.name}
            </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {fmtMoney(r.value)} ({r.pct.toFixed(0)}%)
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}