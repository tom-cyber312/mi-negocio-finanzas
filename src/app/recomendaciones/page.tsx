"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Info,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { db } from "@/lib/db";
import type { Recomendacion } from "@/lib/types";
import {
  construirPromptParaIA,
  generarRecomendaciones,
} from "@/lib/recommendations";
import { fmtMoney } from "@/lib/format";
import { Card, CardHeader, Skeleton } from "@/components/ui";

const TIPO_STYLE: Record<
  Recomendacion["tipo"],
  { icon: typeof Info; ring: string; bg: string; label: string }
> = {
  danger: {
    icon: ShieldAlert,
    ring: "border-rose-500/40 bg-rose-500/5",
    bg: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    label: "Crítico",
  },
  warning: {
    icon: AlertTriangle,
    ring: "border-amber-500/40 bg-amber-500/5",
    bg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    label: "Advertencia",
  },
  info: {
    icon: Info,
    ring: "border-sky-500/40 bg-sky-500/5",
    bg: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    label: "Sugerencia",
  },
  success: {
    icon: CheckCircle2,
    ring: "border-emerald-500/40 bg-emerald-500/5",
    bg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    label: "Oportunidad",
  },
};

export default function RecomendacionesPage() {
  const productos = useLiveQuery(() => db.productos.toArray(), []);
  const ventas = useLiveQuery(() => db.ventas.toArray(), []);
  const gastos = useLiveQuery(() => db.gastos.toArray(), []);

  const [copied, setCopied] = useState(false);

  const recomendaciones = useMemo(() => {
    if (!productos || !ventas || !gastos) return [];
    return generarRecomendaciones({ productos, ventas, gastos });
  }, [productos, ventas, gastos]);

  const prompt = useMemo(() => {
    if (!productos || !ventas || !gastos) return "";
    return construirPromptParaIA({ productos, ventas, gastos });
  }, [productos, ventas, gastos]);

  const salud = useMemo(() => {
    if (!ventas || !gastos) return null;
    const egresos = gastos.reduce((s, g) => s + g.monto, 0);
    const ingresos = ventas.reduce(
      (s, v) => s + v.cantidad * v.precioUnitario,
      0
    );
    return { ingresos, egresos, utilidad: ingresos - egresos };
  }, [ventas, gastos]);

  if (!productos || !ventas || !gastos) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  const dangerCount = recomendaciones.filter((r) => r.tipo === "danger").length;
  const warningCount = recomendaciones.filter((r) => r.tipo === "warning").length;

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">
            Recomendaciones inteligentes
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Generadas automáticamente con reglas sobre tus datos. Sin IA
            externa, pero lista para conectar una.
          </p>
        </div>
        <div className="mt-3 flex items-center gap-2 sm:mt-0">
          {dangerCount > 0 && (
            <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
              {dangerCount} crítica(s)
            </span>
          )}
          {warningCount > 0 && (
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
              {warningCount} advertencia(s)
            </span>
          )}
        </div>
      </div>

      {salud && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <p className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
              Ingresos históricos
            </p>
            <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {fmtMoney(salud.ingresos)}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
              Egresos históricos
            </p>
            <p className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
              {fmtMoney(salud.egresos)}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
              Utilidad histórica
            </p>
            <p
              className={`mt-2 text-2xl font-bold ${
                salud.utilidad >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {fmtMoney(salud.utilidad)}
            </p>
          </Card>
        </div>
      )}

      {recomendaciones.length === 0 ? (
        <Card className="p-10 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-emerald-500" />
          <p className="mt-3 font-semibold text-zinc-900 dark:text-zinc-100">
            Tu negocio se ve saludable
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            No encontramos alertas con las reglas actuales. Cargá más datos o
            esperá a que cambie la actividad.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recomendaciones.map((r) => {
            const s = TIPO_STYLE[r.tipo];
            const Icon = s.icon;
            return (
              <Card
                key={r.id}
                className={`flex flex-col gap-3 border p-5 ${s.ring}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.bg}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {s.label}
                  </p>
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {r.titulo}
                </h3>
                <p className="flex-1 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {r.descripcion}
                </p>
                {r.accion && r.link && (
                  <Link
                    href={r.link}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    {r.accion} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader
          title="Listo para IA (opcional)"
          subtitle="Este contexto resume tus datos. Si querés recomendaciones más finas, conectalo con un modelo de lenguaje."
          right={
            <button
              onClick={() => {
                navigator.clipboard
                  .writeText(prompt)
                  .then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  })
                  .catch(() => {});
              }}
              className="rounded-lg bg-zinc-100 p-2 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              title="Copiar contexto"
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          }
        />
        <div className="px-5 py-4">
          <pre className="overflow-x-auto rounded-xl bg-zinc-950 p-4 text-xs leading-relaxed text-emerald-300 dark:bg-black">
            {prompt}
          </pre>
        </div>
      </Card>
    </div>
  );
}