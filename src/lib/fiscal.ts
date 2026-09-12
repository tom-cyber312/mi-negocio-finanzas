import type { InflacionMes, Venta, Gasto, FiscalConfig } from "./types";

export interface CategoriaMonotributo {
  letra: string;
  limiteAnual: number;
}

/**
 * Límites máximos de facturación anual (AFIP/ARCA, régimen simplificado).
 * Estimación 2026 — editable según la página del usuario, porque ARCA
 * actualiza los montos periódicamente.
 */
export const CATEGORIAS_MONOTRIBUTO_DEFAULT: CategoriaMonotributo[] = [
  { letra: "A", limiteAnual: 10_000_000 },
  { letra: "B", limiteAnual: 15_000_000 },
  { letra: "C", limiteAnual: 21_000_000 },
  { letra: "D", limiteAnual: 26_000_000 },
  { letra: "E", limiteAnual: 31_000_000 },
  { letra: "F", limiteAnual: 38_000_000 },
  { letra: "G", limiteAnual: 45_000_000 },
  { letra: "H", limiteAnual: 56_000_000 },
  { letra: "I", limiteAnual: 63_000_000 },
  { letra: "J", limiteAnual: 71_000_000 },
  { letra: "K", limiteAnual: 79_000_000 },
];

export function ultimos12Meses(ventas: Venta[], now = new Date()): number {
  const inicio = new Date(now.getFullYear(), now.getMonth() - 11, 1).getTime();
  return ventas.reduce((s, v) => (v.fecha >= inicio ? s + v.cantidad * v.precioUnitario : s), 0);
}

export interface EstadoMonotributo {
  facturado12m: number;
  categoriaActual: CategoriaMonotributo | null;
  categoriaCalculada: CategoriaMonotributo | null;
  siguiente: CategoriaMonotributo | null;
  usoPct: number;
  superado: boolean;
  proximoLimitePct: number | null;
}

export function estadoMonotributo(
  ventas: Venta[],
  categorias: CategoriaMonotributo[],
  fiscal: FiscalConfig,
  now = new Date()
): EstadoMonotributo {
  const facturado12m = ultimos12Meses(ventas, now);
  const calculada = categorias.find((c) => facturado12m <= c.limiteAnual) ?? categorias[categorias.length - 1];
  const declarada = fiscal.monotributoCategoria
    ? categorias.find((c) => c.letra === fiscal.monotributoCategoria)
    : undefined;

  const actual = declarada ?? calculada;
  const usoPct = actual.limiteAnual > 0 ? (facturado12m / actual.limiteAnual) * 100 : 0;
  const superado = declarada != null && facturado12m > declarada.limiteAnual;
  const aIdx = actual ? categorias.findIndex((c) => c.letra === actual.letra) : -1;
  const siguiente = aIdx >= 0 && aIdx < categorias.length - 1 ? categorias[aIdx + 1] : null;
  const proximoLimitePct = siguiente ? (facturado12m / siguiente.limiteAnual) * 100 : null;

  return {
    facturado12m,
    categoriaActual: actual,
    categoriaCalculada: calculada,
    siguiente,
    usoPct,
    superado,
    proximoLimitePct,
  };
}

export function calcularIva(monto: number, ivaPct: number, incluido: boolean): number {
  if (incluido) return (monto * ivaPct) / (100 + ivaPct);
  return (monto * ivaPct) / 100;
}

export function letraPara(fiscal: FiscalConfig): "A" | "B" | "C" {
  if (fiscal.condicionIva === "respin") return "A";
  if (fiscal.condicionIva === "exento") return "C";
  return "C";
}

export function condicionTitulo(condicion: string): string {
  if (condicion === "respin") return "Responsable Inscripto";
  if (condicion === "exento") return "Exento";
  return "Monotributo";
}

export function mesKeyDeFecha(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Factor para llevar un valor del mes `fromKey` al mes `toKey`, aplicando la
 * inflación acumulada entre ambos (valores nominales → reales).
 * Si no hay datos, devuelve 1 (sin ajuste).
 */
export function factorInflacion(
  inflacion: InflacionMes[],
  fromKey: string,
  toKey: string
): number {
  const map = new Map(inflacion.map((i) => [i.mesKey, i.variacionPct / 100]));
  const from = fromKey.localeCompare(toKey);
  const months: string[] = [];
  const [fy, fm] = fromKey.split("-").map(Number);
  const [ty, tm] = toKey.split("-").map(Number);
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m < tm)) {
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    months.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  let factor = 1;
  if (from <= 0) return factor; // no ajustar hacia atrás
  for (const k of months) {
    const pct = map.get(k);
    if (pct != null) factor *= 1 + pct;
  }
  return factor;
}

export function ajustarValor(
  valor: number,
  inflacion: InflacionMes[],
  fromKey: string,
  toKey: string
): number {
  return valor * factorInflacion(inflacion, fromKey, toKey);
}

export function gastosPorPresupuesto(
  gastos: Gasto[],
  year: number,
  monthIdx: number
): Map<string, number> {
  const map = new Map<string, number>();
  for (const g of gastos) {
    const d = new Date(g.fecha);
    if (d.getFullYear() === year && d.getMonth() === monthIdx) {
      map.set(g.categoria, (map.get(g.categoria) || 0) + g.monto);
    }
  }
  return map;
}