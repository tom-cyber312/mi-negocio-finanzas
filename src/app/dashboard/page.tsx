"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Flame,
  Percent,
  PiggyBank,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { db } from "@/lib/db";
import type { Periodo } from "@/lib/types";
import { fmtMoney } from "@/lib/format";
import {
  calcResumen,
  egresosPorCategoria,
  filtrarPorRango,
  rangoPeriodo,
  seriePorMes,
  topProductos,
} from "@/lib/calc";
import { generarRecomendaciones } from "@/lib/recommendations";
import { ajustarValor } from "@/lib/fiscal";
import { getFiscalConfig, getLimitesMonotributo } from "@/lib/config";
import { Card, CardHeader, Skeleton, StatCard, Tip } from "@/components/ui";
import {
  BarIngresosEgresos,
  HorizontalBestScale,
  PieGastos,
  TopVentasBar,
} from "@/components/charts";

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "todo", label: "Todo el historial" },
  { key: "30d", label: "30 días" },
  { key: "90d", label: "90 días" },
  { key: "12m", label: "12 meses" },
];

export default function DashboardPage() {
  const [periodo, setPeriodo] = useState<Periodo>("todo");
  const [ajustado, setAjustado] = useState(false);

  const productos = useLiveQuery(() => db.productos.toArray(), []);
  const ventas = useLiveQuery(() => db.ventas.toArray(), []);
  const gastos = useLiveQuery(() => db.gastos.toArray(), []);
  const presupuestos = useLiveQuery(() => db.presupuestos.toArray(), []);
  const inflacion = useLiveQuery(() => db.inflacion.toArray(), []);

  const resumen = useMemo(() => {
    if (!ventas || !gastos || !productos) return null;
    const { desde, hasta } = rangoPeriodo(periodo);
    const vs = filtrarPorRango(ventas, desde, hasta);
    const gs = filtrarPorRango(gastos, desde, hasta);
    return {
      resumen: calcResumen(productos, vs, gs),
      ventasFiltradas: vs,
    };
  }, [periodo, ventas, gastos, productos]);

  const porMes = useMemo(() => {
    if (!ventas || !gastos) return [];
    const serie = seriePorMes(ventas, gastos, 12);
    const ultimoKey = serie.length ? serie[serie.length - 1].key : "";
    return serie.map((m) => ({
      short: m.short,
      ingresos: ajustado
        ? ajustarValor(m.ingresos, inflacion || [], m.key, ultimoKey)
        : m.ingresos,
      egresos: ajustado
        ? ajustarValor(m.egresos, inflacion || [], m.key, ultimoKey)
        : m.egresos,
    }));
  }, [ventas, gastos, ajustado, inflacion]);

  const porCategoria = useMemo(() => {
    if (!gastos) return [];
    const { desde, hasta } = rangoPeriodo(periodo);
    return egresosPorCategoria(filtrarPorRango(gastos, desde, hasta));
  }, [gastos, periodo]);

  const topVendidos = useMemo(() => {
    if (!ventas || !resumen) return [];
    return Array.from(
      topProductos(resumen.ventasFiltradas, productos || []).values()
    )
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, 5)
      .map((t) => ({ nombre: t.nombre, unidades: t.unidades }));
  }, [resumen, ventas, productos]);

  const topRentables = useMemo(() => {
    if (!ventas) return [];
    const todos = topProductos(ventas, productos || []);
    return Array.from(todos.values())
      .sort((a, b) => b.ganancia - a.ganancia)
      .slice(0, 5)
      .map((t) => ({ label: t.nombre, value: t.ganancia }));
  }, [ventas, productos]);

  const recomendaciones = useMemo(() => {
    if (!productos || !ventas || !gastos) return [];
    return generarRecomendaciones({
      productos,
      ventas,
      gastos,
      presupuestos: presupuestos || [],
      fiscal: getFiscalConfig(),
      limitesMonotributo: getLimitesMonotributo().length
        ? getLimitesMonotributo()
        : undefined,
    });
  }, [productos, ventas, gastos, presupuestos]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">
            Resumen general
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Visión global de tu negocio: ingresos, egresos, inventario y
            rentabilidad.
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
          </label>
          <div className="flex flex-wrap gap-1.5 rounded-xl bg-zinc-200/60 p-1 dark:bg-zinc-800/70">
            {PERIODOS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriodo(p.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  periodo === p.key
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!resumen ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[108px]" />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Ingresos totales"
              value={fmtMoney(resumen.resumen.ingresos)}
              tone="positive"
              icon={<Banknote className="h-4 w-4" />}
              sub={`${resumen.resumen.numVentas} ventas · ${resumen.resumen.unidadesVendidas} unidades`}
            />
            <StatCard
              label="Egresos totales"
              value={fmtMoney(resumen.resumen.egresos)}
              tone="negative"
              icon={<Flame className="h-4 w-4" />}
              sub={`Publicidad: ${fmtMoney(resumen.resumen.gastoPublicidad)}`}
            />
            <StatCard
              label={
                <span className="inline-flex items-center gap-1">
                  Utilidad neta
                  <Tip text="Ingresos menos todos los egresos del período. Es lo que queda en caja." />
                </span>
              }
              value={fmtMoney(resumen.resumen.utilidadNeta)}
              tone={resumen.resumen.utilidadNeta >= 0 ? "positive" : "negative"}
              icon={<TrendingUp className="h-4 w-4" />}
              sub={`Bruta por ventas: ${fmtMoney(resumen.resumen.utilidadBruta)}`}
            />
            <StatCard
              label="Capital en inventario"
              value={fmtMoney(resumen.resumen.capitalInventario)}
              tone="accent"
              icon={<Wallet className="h-4 w-4" />}
              sub={`Ganancia potencial: ${fmtMoney(resumen.resumen.gananciaPotencialInventario)}`}
            />
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-sm dark:border-emerald-800 sm:col-span-2">
              <div className="flex items-center gap-2 text-emerald-50/90">
                <Sparkles className="h-4 w-4" />
                <p className="text-[13px] font-medium">ROI de publicidad</p>
              </div>
              {resumen.resumen.roiPublicidad !== null ? (
                <>
                  <p className="mt-2 text-2xl font-bold">
                    {resumen.resumen.roiPublicidad.toFixed(2)}x
                  </p>
                  <p className="mt-1 text-xs text-emerald-50/80">
                    Cada $1 en anuncios generó $
                    {resumen.resumen.roiPublicidad.toLocaleString("es-AR", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    en ventas dentro del período.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-2xl font-bold">—</p>
                  <p className="mt-1 text-xs text-emerald-50/80">
                    Registrá gastos en la categoría Publicidad para medir el
                    retorno.
                  </p>
                </>
              )}
            </div>
            <StatCard
              label={
                <span className="inline-flex items-center gap-1">
                  Margen promedio
                  <Tip text="Utilidad bruta sobre ingresos. Da el porcentaje que queda luego de pagar la mercadería, antes de los gastos fijos." />
                </span>
              }
              value={`${(resumen.resumen.margenPromedio * 100).toFixed(1)}%`}
              tone="info"
              icon={<Percent className="h-4 w-4" />}
              sub="Utilidad bruta / ingresos"
            />
            <StatCard
              label="Ganancia potencial inventario"
              value={fmtMoney(resumen.resumen.gananciaPotencialInventario)}
              tone="positive"
              icon={<PiggyBank className="h-4 w-4" />}
              sub="Suma de margen × stock"
            />
          </div>
        </>
      )}

      <Link
        href="/recomendaciones"
        className="mb-6 flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-4 transition-colors hover:bg-emerald-500/10"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              Recomendaciones inteligentes
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {recomendaciones.length} sugerencia(s) según tus datos
            </p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      </Link>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Ingresos vs Egresos"
            subtitle="Por mes, últimos 12 meses"
          />
          <div className="px-3 py-4">
            {porMes.length ? (
              <BarIngresosEgresos data={porMes} />
            ) : (
              <Skeleton className="h-[280px]" />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Distribución de egresos"
            subtitle="Por categoría"
          />
          <div className="px-3 py-4">
            {porCategoria.length ? (
              <PieGastos data={porCategoria} />
            ) : (
              <EmptyText />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Top 5 más vendidos"
            subtitle="Por unidades vendidas en el período"
          />
          <div className="px-3 py-4">
            {topVendidos.length ? (
              <TopVentasBar data={topVendidos} />
            ) : (
              <EmptyText />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Top 5 más rentables"
            subtitle="Por ganancia acumulada (histórico)"
          />
          <div className="px-5 py-5">
            {topRentables.length ? (
              <HorizontalBestScale items={topRentables} />
            ) : (
              <EmptyText />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function EmptyText() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-zinc-400 dark:text-zinc-500">
      Sin datos en este período
    </div>
  );
}