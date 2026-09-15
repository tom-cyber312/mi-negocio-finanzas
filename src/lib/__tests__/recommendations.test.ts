import { describe, it, expect } from "vitest";
import {
  generarRecomendaciones,
  type DatosParaAnalisis,
} from "../recommendations";
import type { CategoriaGasto, Gasto, Producto, Venta } from "../types";

function producto(nombre: string, over: Partial<Producto> = {}): Producto {
  return {
    nombre,
    categoria: "General",
    sku: "",
    costo: 100,
    precio: 150,
    stock: 10,
    umbralStock: 3,
    createdAt: 0,
    ...over,
  };
}

function venta(ts: number, u: number, p: number, prod = 1): Venta {
  return {
    id: 0,
    productoId: prod,
    nombreProducto: "Prod" + prod,
    cantidad: u,
    precioUnitario: p,
    costoUnitario: 0,
    fecha: ts,
    cliente: "",
    metodoPago: "Efectivo",
  };
}

function gasto(monto: number, categoria: CategoriaGasto = "Servicios"): Gasto {
  return {
    id: 0,
    fecha: Date.now(),
    categoria,
    descripcion: "x",
    monto,
    recurrente: false,
    updatedAt: 0,
  };
}

const now = new Date(2026, 8, 15);

describe("generarRecomendaciones", () => {
  it("no devuelve más de 3 recomendaciones", () => {
    const datos: DatosParaAnalisis = {
      productos: [
        producto("A", { stock: 0 }),
        producto("B", { stock: 0 }),
        producto("C", { stock: 0 }),
        producto("Margen", { stock: 5, costo: 100, precio: 108 }),
      ],
      ventas: [venta(now.getTime(), 10, 50, 1)],
      gastos: [gasto(10000), gasto(1000, "Publicidad")],
    };
    const recs = generarRecomendaciones(datos, now);
    expect(recs.length).toBe(3);
  });

  it("agrupa los productos agotados o con stock bajo en una sola recomendación", () => {
    const datos: DatosParaAnalisis = {
      productos: [
        producto("Agotado", { stock: 0 }),
        producto("Bajo", { stock: 1 }),
        producto("Bajo2", { stock: 2 }),
      ],
      ventas: [],
      gastos: [],
    };
    const recs = generarRecomendaciones(datos, now);
    const reponer = recs.filter((r) => r.id === "productos-reponer");
    expect(reponer).toHaveLength(1);
    expect(recs.length).toBeLessThanOrEqual(3);
  });

  it("agrupa todos los márgenes bajos en una sola recomendación", () => {
    const datos: DatosParaAnalisis = {
      productos: [
        producto("M1", { stock: 5, costo: 100, precio: 108 }),
        producto("M2", { stock: 5, costo: 100, precio: 110 }),
        producto("M3", { stock: 5, costo: 100, precio: 112 }),
      ],
      ventas: [],
      gastos: [],
    };
    const recs = generarRecomendaciones(datos, now);
    expect(recs.filter((r) => r.id === "margen-bajo")).toHaveLength(1);
    expect(recs.filter((r) => r.id.startsWith("margen-") && r.id !== "margen-bajo")).toHaveLength(0);
    expect(recs.length).toBeLessThanOrEqual(3);
  });

  it("respeta el tope personalizado", () => {
    const datos: DatosParaAnalisis = {
      productos: [producto("A", { stock: 0 })],
      ventas: [],
      gastos: [],
    };
    const recs = generarRecomendaciones(datos, now, 1);
    expect(recs.length).toBeGreaterThanOrEqual(1);
    expect(recs.length).toBeLessThanOrEqual(1);
  });

  it("sin problemas devuelve pocas o ninguna recomendación y sin críticas", () => {
    const datos: DatosParaAnalisis = {
      productos: [producto("Sano", { stock: 50 })],
      ventas: [venta(now.getTime(), 2, 300, 1)],
      gastos: [],
    };
    const recs = generarRecomendaciones(datos, now);
    expect(recs.length).toBeLessThanOrEqual(3);
    expect(recs.some((r) => r.tipo === "danger")).toBe(false);
  });
});