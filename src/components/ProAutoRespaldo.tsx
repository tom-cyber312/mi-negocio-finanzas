"use client";

import { useEffect } from "react";
import { getCuentaActivaId } from "@/lib/accounts";
import { supabaseConfigurado } from "@/lib/supabase";
import { tienePro } from "@/lib/license";
import { crearRespaldoNube, respaldoVencido } from "@/lib/backupCloud";

const INTENTO_KEY = (id: string) => `fin_pro_respaldo_intento_${id}`;

/** Respaldo automático en la nube (Plan Pro): corre en silencio cada 7 días. */
export default function ProAutoRespaldo() {
  useEffect(() => {
    if (!tienePro() || !supabaseConfigurado() || !respaldoVencido()) return;
    const id = getCuentaActivaId() || "default";
    const intento = Number(localStorage.getItem(INTENTO_KEY(id)) || 0);
    if (intento && Date.now() - intento < 6 * 3600000) return;
    localStorage.setItem(INTENTO_KEY(id), String(Date.now()));
    const raf = requestAnimationFrame(() => {
      void crearRespaldoNube();
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  return null;
}