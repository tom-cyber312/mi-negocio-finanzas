"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApp } from "@/context/AppContext";
import { CURRENCIES, currencyCode, fmtMoney } from "@/lib/format";

function useChartTheme() {
  const { theme } = useApp();
  const dark = theme === "dark";
  return {
    dark,
    grid: dark ? "#27272a" : "#e4e4e7",
    tick: dark ? "#a1a1aa" : "#71717a",
    tooltipBg: dark ? "#18181b" : "#ffffff",
    tooltipBorder: dark ? "#3f3f46" : "#e4e4e7",
    text: dark ? "#fafafa" : "#18181b",
  };
}

function moneyShort(n: number): string {
  const c = CURRENCIES.find((x) => x.code === currencyCode());
  return new Intl.NumberFormat(c?.locale || "es-AR", {
    style: "currency",
    currency: c?.code || "ARS",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: {
    name?: string | number;
    value?: number | string;
    color?: string;
    payload?: { fill?: string };
  }[];
  label?: string | number;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  const t = useChartTheme();
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl border px-3 py-2 text-xs shadow-lg"
      style={{ background: t.tooltipBg, borderColor: t.tooltipBorder }}
    >
      {label != null && (
        <p className="mb-1 font-semibold" style={{ color: t.text }}>
          {label}
        </p>
      )}
      {payload.map((p) => (
        <p
          key={String(p.name)}
          className="flex items-center gap-2 capitalize"
          style={{ color: t.tick }}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color || p.payload?.fill }}
          />
          {String(p.name)}:{" "}
          <span className="font-semibold" style={{ color: t.text }}>
            {typeof p.value === "number" && p.name !== "Stock"
              ? fmtMoney(p.value)
              : String(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

export function BarIngresosEgresos({
  data,
  height = 280,
}: {
  data: { short: string; ingresos: number; egresos: number }[];
  height?: number;
}) {
  const t = useChartTheme();
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
          <XAxis
            dataKey="short"
            tick={{ fill: t.tick, fontSize: 11 }}
            axisLine={{ stroke: t.grid }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: t.tick, fontSize: 11 }}
            tickFormatter={(v) => moneyShort(v)}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: t.dark ? "#27272a" : "#f4f4f5" }} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={26} />
          <Bar dataKey="egresos" name="Egresos" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PieGastos({
  data,
  height = 260,
  showLegend = true,
}: {
  data: { name: string; value: number; color: string }[];
  height?: number;
  showLegend?: boolean;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="78%"
            paddingAngle={3}
            strokeWidth={0}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          {showLegend && (
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12 }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineEvolucion({
  data,
  height = 280,
}: {
  data: { dia: string; ingresos: number; egresos: number }[];
  height?: number;
}) {
  const t = useChartTheme();
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
          <XAxis
            dataKey="dia"
            tick={{ fill: t.tick, fontSize: 10 }}
            axisLine={{ stroke: t.grid }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: t.tick, fontSize: 11 }}
            tickFormatter={(v) => moneyShort(v)}
            axisLine={false}
            tickLine={false}
            width={68}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="ingresos"
            name="Ingresos"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="egresos"
            name="Egresos"
            stroke="#f43f5e"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TopVentasBar({
  data,
  height = 260,
}: {
  data: { nombre: string; unidades: number }[];
  height?: number;
}) {
  const t = useChartTheme();
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={t.grid} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: t.tick, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="nombre"
            width={120}
            tick={{ fill: t.tick, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: t.dark ? "#27272a" : "#f4f4f5" }} />
          <Bar dataKey="unidades" name="Unidades" fill="#0ea5e9" radius={[0, 4, 4, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HorizontalBestScale({
  items,
}: {
  items: { label: string; value: number }[];
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const pct = (v: number) => (v / max) * 100;
  return (
    <div className="space-y-3">
      {items.map((i) => (
        <div key={i.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-medium text-zinc-700 dark:text-zinc-300">
              {i.label}
            </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {fmtMoney(i.value)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all"
              style={{ width: `${pct(i.value)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}