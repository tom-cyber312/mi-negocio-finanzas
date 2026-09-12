import type { Gasto, Producto, Venta } from "./types";
import { CATEGORIAS_GASTO } from "./types";

export const DAY_MS = 86400000;

export function marginPct(p: Producto): number {
  if (!p.precio) return 0;
  return ((p.precio - p.costo) / p.precio) * 100;
}

export function isStockBajo(p: Producto): boolean {
  return p.stock <= p.umbralStock;
}

export interface Resumen {
  ingresos: number;
  costeVentas: number;
  utilidadBruta: number;
  egresos: number;
  utilidadNeta: number;
  gananciaPotencialInventario: number;
  capitalInventario: number;
  valorPotencialVentas: number;
  gastoPublicidad: number;
  numVentas: number;
  unidadesVendidas: number;
  roiPublicidad: number | null;
  margenPromedio: number;
}

export function calcResumen(
  productos: Producto[],
  ventas: Venta[],
  gastos: Gasto[]
): Resumen {
  let ingresos = 0;
  let costeVentas = 0;
  let numVentas = 0;
  let unidadesVendidas = 0;

  for (const v of ventas) {
    ingresos += v.cantidad * v.precioUnitario;
    costeVentas += v.cantidad * v.costoUnitario;
    numVentas += 1;
    unidadesVendidas += v.cantidad;
  }

  let egresos = 0;
  let gastoPublicidad = 0;
  for (const g of gastos) {
    egresos += g.monto;
    if (g.categoria === "Publicidad") gastoPublicidad += g.monto;
  }

  let capitalInventario = 0;
  let valorPotencialVentas = 0;
  let gananciaPotencialInventario = 0;
  for (const p of productos) {
    capitalInventario += p.costo * p.stock;
    valorPotencialVentas += p.precio * p.stock;
    gananciaPotencialInventario += (p.precio - p.costo) * p.stock;
  }

  const utilidadBruta = ingresos - costeVentas;
  const utilidadNeta = ingresos - egresos;
  const roiPublicidad =
    gastoPublicidad > 0 ? ingresos / gastoPublicidad : null;

  return {
    ingresos,
    costeVentas,
    utilidadBruta,
    egresos,
    utilidadNeta,
    gananciaPotencialInventario,
    capitalInventario,
    valorPotencialVentas,
    gastoPublicidad,
    numVentas,
    unidadesVendidas,
    roiPublicidad,
    margenPromedio: utilidadBruta / (ingresos || 1),
  };
}

export function filtrarPorRango<T extends { fecha: number }>(
  registros: T[],
  desde?: number,
  hasta?: number
): T[] {
  return registros.filter((r) => {
    if (desde && r.fecha < desde) return false;
    if (hasta && r.fecha > hasta) return false;
    return true;
  });
}

export function rangoPeriodo(periodo: "todo" | "30d" | "90d" | "12m", now = Date.now()) {
  if (periodo === "todo") return { desde: undefined, hasta: undefined };
  const dias = periodo === "30d" ? 30 : periodo === "90d" ? 90 : 365;
  return { desde: now - dias * DAY_MS, hasta: now };
}

export interface MesSeries {
  label: string;
  short: string;
  ingresos: number;
  egresos: number;
  utilidad: number;
  key: string; // "yyyy-mm"
}

export function seriePorMes(
  ventas: Venta[],
  gastos: Gasto[],
  n: number,
  now = new Date()
): MesSeries[] {
  const out: MesSeries[] = [];
  const byKey = new Map<string, MesSeries>();
  const push = (key: string, label: string, short: string) => {
    const item: MesSeries = { label, short, ingresos: 0, egresos: 0, utilidad: 0, key };
    byKey.set(key, item);
    out.push(item);
  };

  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    push(key, `${m.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}`, `${m.toLocaleDateString("es-AR", { month: "short" })}`);
  }

  for (const v of ventas) {
    const d = new Date(v.fecha);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const item = byKey.get(key);
    if (item) {
      item.ingresos += v.cantidad * v.precioUnitario;
      item.utilidad += v.cantidad * v.precioUnitario;
    }
  }
  for (const g of gastos) {
    const d = new Date(g.fecha);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const item = byKey.get(key);
    if (item) {
      item.egresos += g.monto;
      item.utilidad -= g.monto;
    }
  }
  return out;
}

export function egresosPorCategoria(gastos: Gasto[]): { name: string; value: number; color: string }[] {
  const map = new Map<string, number>();
  for (const g of gastos) {
    map.set(g.categoria, (map.get(g.categoria) || 0) + g.monto);
  }
  return CATEGORIAS_GASTO.filter((c) => (map.get(c) || 0) > 0).map((c) => ({
    name: c,
    value: map.get(c) || 0,
    color:
      c === "Insumos"
        ? "#f59e0b"
        : c === "Publicidad"
          ? "#8b5cf6"
          : c === "Servicios"
            ? "#38bdf8"
            : c === "Sueldos"
              ? "#f43f5e"
              : "#94a3b8",
  }));
}

export function evolucionDiaria(
  ventas: Venta[],
  gastos: Gasto[],
  year: number,
  monthIdx: number
): { dia: string; num: number; ingresos: number; egresos: number; balance: number }[] {
  const diasMes = new Date(year, monthIdx + 1, 0).getDate();
  const out: { dia: string; num: number; ingresos: number; egresos: number; balance: number }[] = [];
  for (let d = 1; d <= diasMes; d++) {
    out.push({ dia: String(d).padStart(2, "0"), num: d, ingresos: 0, egresos: 0, balance: 0 });
  }
  for (const v of ventas) {
    const d = new Date(v.fecha);
    if (d.getFullYear() === year && d.getMonth() === monthIdx) {
      const item = out[d.getDate() - 1];
      if (item) {
        item.ingresos += v.cantidad * v.precioUnitario;
        item.balance += v.cantidad * v.precioUnitario;
      }
    }
  }
  for (const g of gastos) {
    const d = new Date(g.fecha);
    if (d.getFullYear() === year && d.getMonth() === monthIdx) {
      const item = out[d.getDate() - 1];
      if (item) {
        item.egresos += g.monto;
        item.balance -= g.monto;
      }
    }
  }
  return out;
}

export function acumuladoDiario(
  data: { dia: string; ingresos: number; egresos: number }[]
): { dia: string; ingresos: number; egresos: number }[] {
  let iAcc = 0;
  let eAcc = 0;
  return data.map((d) => {
    iAcc += d.ingresos;
    eAcc += d.egresos;
    return { dia: d.dia, ingresos: iAcc, egresos: eAcc };
  });
}

export interface MesResumen {
  ingresos: number;
  egresos: number;
  balance: number;
  ventas: Venta[];
  gastos: Gasto[];
}

export function resumenMes(
  ventas: Venta[],
  gastos: Gasto[],
  year: number,
  monthIdx: number
): MesResumen {
  const vs = ventas.filter(
    (v) => new Date(v.fecha).getFullYear() === year && new Date(v.fecha).getMonth() === monthIdx
  );
  const gs = gastos.filter(
    (g) => new Date(g.fecha).getFullYear() === year && new Date(g.fecha).getMonth() === monthIdx
  );
  const ingresos = vs.reduce((s, v) => s + v.cantidad * v.precioUnitario, 0);
  const egresos = gs.reduce((s, g) => s + g.monto, 0);
  return { ingresos, egresos, balance: ingresos - egresos, ventas: vs, gastos: gs };
}

export function pctVariacion(actual: number, anterior: number): number | null {
  if (!anterior && !actual) return null;
  if (!anterior) return null;
  return ((actual - anterior) / anterior) * 100;
}

interface TopProducto {
  id: number;
  nombre: string;
  categoria: string;
  unidades: number;
  ingresos: number;
  ganancia: number;
  margenPct: number;
  stock: number;
}

export function topProductos(
  ventas: Venta[],
  productos: Producto[]
): Map<number, TopProducto> {
  const map = new Map<number, TopProducto>();
  const precios = new Map<number, Producto>();
  for (const p of productos) precios.set(p.id as number, p);

  for (const v of ventas) {
    if (v.productoId == null) continue;
    let t = map.get(v.productoId);
    if (!t) {
      const p = precios.get(v.productoId);
      t = {
        id: v.productoId,
        nombre: v.nombreProducto,
        categoria: p?.categoria || "",
        unidades: 0,
        ingresos: 0,
        ganancia: 0,
        margenPct: p ? ((p.precio - p.costo) / (p.precio || 1)) * 100 : 0,
        stock: p?.stock ?? 0,
      };
      map.set(v.productoId, t);
    }
    t.unidades += v.cantidad;
    t.ingresos += v.cantidad * v.precioUnitario;
    t.ganancia += v.cantidad * (v.precioUnitario - v.costoUnitario);
  }
  return map;
}

export function diasSinVender(
  ventas: Venta[],
  productoId: number,
  now = Date.now()
): number {
  let last = 0;
  for (const v of ventas) {
    if (v.productoId != null && v.productoId === productoId && v.fecha > last) last = v.fecha;
  }
  if (!last) return Infinity;
  return Math.floor((now - last) / DAY_MS);
}