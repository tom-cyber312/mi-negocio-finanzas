import { getGateways } from "./config";
import {
  SLOTS,
  claveDisponible,
  haySecretoGuardado,
  leerSecreto,
} from "./secureStore";
import type { TransaccionExterna } from "./types";

const RANGO_DIAS = 45;
const CACHE_MS = 6 * 60 * 60 * 1000;

let cache: { gateway: string; hora: number; transacciones: TransaccionExterna[] } | null = null;

export type ResultadoBusqueda =
  | { ok: true; transacciones: TransaccionExterna[] }
  | { ok: false; razon: string };

export async function buscarCobrosMercadoPago(force = false): Promise<ResultadoBusqueda> {
  const cfg = getGateways();
  if (!cfg.mpEnabled) return { ok: false, razon: "no-habilitado" };

  if (!force && cache && cache.gateway === "mp" && Date.now() - cache.hora < CACHE_MS) {
    return { ok: true, transacciones: cache.transacciones };
  }

  let token = "";
  if (!cfg.mpUsarServidor) {
    if (haySecretoGuardado(SLOTS.mp)) {
      if (!claveDisponible()) return { ok: false, razon: "sin-clave" };
      const s = await leerSecreto(SLOTS.mp);
      if (s === null) return { ok: false, razon: "token" };
      token = s;
    } else {
      return { ok: false, razon: "token" };
    }
  }

  try {
    const hoy = new Date();
    const desde = new Date(hoy);
    desde.setDate(desde.getDate() - RANGO_DIAS);
    const r = await fetch("/api/import/mp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: desde.toISOString().slice(0, 10),
        to: hoy.toISOString().slice(0, 10),
        ...(token ? { token } : {}),
      }),
    });
    const data = (await r.json()) as { transacciones?: TransaccionExterna[] };
    if (!r.ok) return { ok: false, razon: "api" };
    const transacciones = data.transacciones || [];
    cache = { gateway: "mp", hora: Date.now(), transacciones };
    return { ok: true, transacciones };
  } catch {
    return { ok: false, razon: "red" };
  }
}

export function limpiarCacheCobros(): void {
  cache = null;
}