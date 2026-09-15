"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, CreditCard, X } from "lucide-react";
import { db } from "@/lib/db";
import { getGateways } from "@/lib/config";
import { buscarCobrosMercadoPago } from "@/lib/autogateway";
import type { TransaccionExterna } from "@/lib/types";

export default function AvisoImportMP() {
  const router = useRouter();
  const ventas = useLiveQuery(() => db.ventas.toArray(), []);
  const [cobros, setCobros] = useState<TransaccionExterna[] | null>(null);
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    const cfg = getGateways();
    if (!cfg.mpEnabled) return;
    let activo = true;
    buscarCobrosMercadoPago()
      .then((res) => {
        if (activo && res.ok) setCobros(res.transacciones);
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, []);

  const pendientes = useMemo(() => {
    if (!cobros || oculto) return 0;
    const ya = new Set(
      (ventas || []).filter((v) => v.referencia).map((v) => v.referencia)
    );
    return cobros.filter((t) => !ya.has(t.externalId)).length;
  }, [cobros, ventas, oculto]);

  if (!pendientes) return null;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
          <CreditCard className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {pendientes} cobro(s) de Mercado Pago listos para importar
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            No suman a tus dashboards hasta que los importes.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => router.push("/integraciones")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          <CreditCard className="h-4 w-4" />
          Importar ahora
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => setOculto(true)}
          aria-label="Ocultar aviso"
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-emerald-500/10 hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}