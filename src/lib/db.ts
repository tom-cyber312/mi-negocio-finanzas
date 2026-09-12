import Dexie, { type Table } from "dexie";
import type { Factura, Gasto, InflacionMes, Presupuesto, Producto, Venta } from "./types";
import { METODOS_PAGO } from "./types";
import { getCuentaActivaId } from "./accounts";
import { guardarArchivo } from "./download";

export class FinDB extends Dexie {
  productos!: Table<Producto, number>;
  ventas!: Table<Venta, number>;
  gastos!: Table<Gasto, number>;
  presupuestos!: Table<Presupuesto, number>;
  facturas!: Table<Factura, number>;
  inflacion!: Table<InflacionMes, number>;

  constructor(name = "finanzasDB") {
    super(name);
    this.version(1).stores({
      productos: "++id, nombre, categoria, sku",
      ventas: "++id, productoId, fecha, metodoPago",
      gastos: "++id, fecha, categoria, recurrente",
    });
    this.version(2).stores({
      productos: "++id, nombre, categoria, sku",
      ventas: "++id, productoId, fecha, metodoPago",
      gastos: "++id, fecha, categoria, recurrente",
      presupuestos: "++id, categoria",
      facturas: "++id, fecha, tipo",
      inflacion: "++id, mesKey",
    });
  }
}

export const db = new FinDB(nombreBasePorCuenta());

function nombreBasePorCuenta(): string {
  return nombreBaseDeCuenta(getCuentaActivaId());
}

export function nombreBaseDeCuenta(id: string | null): string {
  return id && id !== "default" ? `finanzasDB_${id}` : "finanzasDB";
}

// Borra por completo la base IndexedDB de una cuenta (erasure total).
// Noop si no existe o si el navegador no permite eliminarla.
export function eliminarBase(name: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve();
    try {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function saveProducto(p: Producto): Promise<number> {
  if (p.id) {
    await db.productos.update(p.id, {
      nombre: p.nombre,
      categoria: p.categoria,
      sku: p.sku,
      costo: p.costo,
      precio: p.precio,
      stock: p.stock,
      umbralStock: p.umbralStock,
    });
    return p.id;
  }
  return db.productos.add({
    ...p,
    createdAt: Date.now(),
  });
}

export async function deleteProducto(id: number): Promise<void> {
  await db.productos.delete(id);
}

export async function registrarVenta(
  v: Omit<Venta, "id" | "nombreProducto" | "costoUnitario" | "externa" | "referencia">
): Promise<number> {
  return db.transaction("rw", db.productos, db.ventas, async () => {
    const prod = v.productoId != null ? await db.productos.get(v.productoId) : undefined;
    if (v.productoId != null && !prod) throw new Error("El producto no existe");
    if (v.cantidad <= 0) throw new Error("La cantidad debe ser mayor a 0");
    if (prod && prod.stock < v.cantidad)
      throw new Error(
        `Stock insuficiente: quedan ${prod.stock} unidades de ${prod.nombre}`
      );

    const id = await db.ventas.add({
      ...v,
      nombreProducto: prod ? prod.nombre : "Venta",
      costoUnitario: prod ? prod.costo : 0,
    });
    if (prod && v.productoId != null) {
      await db.productos.update(prod.id!, {
        stock: prod.stock - v.cantidad,
      });
    }
    return id;
  });
}

export async function agregarVentaExterna(v: Omit<Venta, "id" | "costoUnitario">): Promise<number> {
  return db.ventas.add({
    ...v,
    costoUnitario: 0,
    externa: true,
  });
}

export async function eliminarVenta(id: number): Promise<void> {
  await db.transaction("rw", db.productos, db.ventas, async () => {
    const v = await db.ventas.get(id);
    if (!v) return;
    await db.ventas.delete(id);
    if (v.productoId != null) {
      const prod = await db.productos.get(v.productoId);
      if (prod) {
        await db.productos.update(prod.id!, { stock: prod.stock + v.cantidad });
      }
    }
  });
}

export async function saveGasto(g: Gasto): Promise<number> {
  if (g.id) {
    await db.gastos.update(g.id, {
      categoria: g.categoria,
      descripcion: g.descripcion,
      monto: g.monto,
      fecha: g.fecha,
      recurrente: g.recurrente,
    });
    return g.id;
  }
  return db.gastos.add(g);
}

export async function deleteGasto(id: number): Promise<void> {
  await db.gastos.delete(id);
}

export async function savePresupuesto(p: Presupuesto): Promise<number> {
  const exist = await db.presupuestos.where("categoria").equals(p.categoria).first();
  if (exist) {
    await db.presupuestos.update(exist.id!, { montoMensual: p.montoMensual });
    return exist.id!;
  }
  return db.presupuestos.add({ categoria: p.categoria, montoMensual: p.montoMensual });
}

export async function saveFactura(f: Factura): Promise<number> {
  if (f.id) {
    await db.facturas.update(f.id, {
      tipo: f.tipo,
      letra: f.letra,
      numero: f.numero,
      fecha: f.fecha,
      cliente: f.cliente,
      cuit: f.cuit,
      condicion: f.condicion,
      monto: f.monto,
      detalle: f.detalle,
      ventaId: f.ventaId,
      gastoId: f.gastoId,
    });
    return f.id;
  }
  return db.facturas.add(f);
}

export async function deleteFactura(id: number): Promise<void> {
  await db.facturas.delete(id);
}

export async function saveInflacion(m: InflacionMes): Promise<number> {
  const exist = await db.inflacion.where("mesKey").equals(m.mesKey).first();
  if (exist) {
    await db.inflacion.update(exist.id!, { variacionPct: m.variacionPct });
    return exist.id!;
  }
  return db.inflacion.add({ mesKey: m.mesKey, variacionPct: m.variacionPct });
}

export async function deleteInflacion(id: number): Promise<void> {
  await db.inflacion.delete(id);
}

export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.productos.clear(),
    db.ventas.clear(),
    db.gastos.clear(),
    db.presupuestos.clear(),
    db.facturas.clear(),
    db.inflacion.clear(),
  ]);
}

export async function exportarBackup(): Promise<void> {
  const data = {
    app: "mi-negocio-finanzas",
    version: 2,
    exportado: new Date().toISOString(),
    productos: await db.productos.toArray(),
    ventas: await db.ventas.toArray(),
    gastos: await db.gastos.toArray(),
    presupuestos: await db.presupuestos.toArray(),
    facturas: await db.facturas.toArray(),
    inflacion: await db.inflacion.toArray(),
  };
  await guardarArchivo({
    nombre: `backup-finanzas-${new Date().toISOString().slice(0, 10)}.json`,
    data: new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  });
}

export async function importarBackup(file: File): Promise<number> {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.productos)) {
    throw new Error("El archivo no parece ser un respaldo válido.");
  }
  await db.transaction(
    "rw",
    [db.productos, db.ventas, db.gastos, db.presupuestos, db.facturas, db.inflacion],
    async () => {
    await Promise.all([
      db.productos.clear(),
      db.ventas.clear(),
      db.gastos.clear(),
      db.presupuestos.clear(),
      db.facturas.clear(),
      db.inflacion.clear(),
    ]);
    await db.productos.bulkAdd(data.productos || []);
    await db.ventas.bulkAdd(data.ventas || []);
    await db.gastos.bulkAdd(data.gastos || []);
    await db.presupuestos.bulkAdd(data.presupuestos || []);
    await db.facturas.bulkAdd(data.facturas || []);
    await db.inflacion.bulkAdd(data.inflacion || []);
  });
  return (data.ventas || []).length;
}

/* ============================ DATOS DE EJEMPLO ============================ */

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function cargarDatosEjemplo(): Promise<void> {
  await clearAllData();
  const rand = mulberry32(20260912);

  const productSeeds = [
    { nombre: "Remera básica algodón", categoria: "remeras regular", sku: "RGL-001", costo: 4500, precio: 12500, stock: 40, umbralStock: 15 },
    { nombre: "Remera oversized estampada", categoria: "remeras over", sku: "OVR-002", costo: 5500, precio: 15500, stock: 25, umbralStock: 10 },
    { nombre: "Remera boxy mujer", categoria: "remeras boxy", sku: "BXY-003", costo: 5000, precio: 14000, stock: 18, umbralStock: 12 },
    { nombre: "Campera rompevientos", categoria: "camperas", sku: "CMP-004", costo: 18000, precio: 42000, stock: 12, umbralStock: 6 },
    { nombre: "Jogging corderito", categoria: "joggins", sku: "JGG-005", costo: 14000, precio: 33000, stock: 20, umbralStock: 8 },
    { nombre: "Buzo hoodie unisex", categoria: "buzos", sku: "BZO-006", costo: 16000, precio: 18500, stock: 8, umbralStock: 10 },
    { nombre: "Bermuda jean", categoria: "bermudas", sku: "BRM-007", costo: 9000, precio: 22000, stock: 30, umbralStock: 12 },
    { nombre: "Jean dad fit", categoria: "jeans", sku: "JNS-008", costo: 15000, precio: 36000, stock: 0, umbralStock: 10 },
    { nombre: "Remera longline negra", categoria: "remeras over", sku: "OVR-009", costo: 5200, precio: 14500, stock: 50, umbralStock: 15 },
    { nombre: "Campera denim", categoria: "camperas", sku: "CMP-010", costo: 20000, precio: 46000, stock: 6, umbralStock: 8 },
    { nombre: "Jogging cargo", categoria: "joggins", sku: "JGG-011", costo: 13000, precio: 31000, stock: 4, umbralStock: 10 },
    { nombre: "Buzo crew", categoria: "buzos", sku: "BZO-012", costo: 15000, precio: 35000, stock: 90, umbralStock: 15 },
  ];

  const clientes = [
    "Juan Pérez",
    "María Gómez",
    "Cliente mostrador",
    "Lucía Fernández",
    "Pedro Álvarez",
    "",
    "Cliente mostrador",
    "Carolina Ruiz",
    "",
  ];

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const nowTs = now.getTime();
  const DAY = 86400000;
  const MESES_ATRAS = 8;

  const productos = await Promise.all(
    productSeeds.map((p, i) =>
      db.productos.add({ ...p, createdAt: nowTs - (MESES_ATRAS - 1) * 30 * DAY - i * 3 * DAY })
    )
  );

  const popularidad = productSeeds.map((_, i) => 0.5 + (i % 4) * 0.12 + ((i * 7) % 5) * 0.05);
  const estancados = new Set([6, 10]); // bermuda jean + jogging cargo: sin ventas recientes

  // Generar ventas en los últimos 8 meses
  for (let m = MESES_ATRAS - 1; m >= 0; m--) {
    const mesInicio = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const dias = new Date(now.getFullYear(), now.getMonth() - m + 1, 0).getDate();
    // tendencia creciente + un mes malo hace 2 meses (para recomendar ROI)
    const shock = m === 2 ? 0.45 : 1;
    const croissance = 0.75 + (MESES_ATRAS - m) * 0.06;
    const factor = shock * croissance;

    for (let d = 0; d < dias; d++) {
      const dia = new Date(mesInicio.getFullYear(), mesInicio.getMonth(), d + 1).getTime();
      if (dia > nowTs) break;
      const esFinDeSemana = [0, 6].includes(new Date(dia).getDay());
      for (let p = 0; p < productSeeds.length; p++) {
        if (estancados.has(p) && m >= 3) continue; // no vender productos estancados recientemente
        const prob = popularidad[p] * factor * (esFinDeSemana ? 1.35 : 0.75) * 0.14;
        if (rand() < prob) {
          const cantidad = 1 + Math.floor(rand() * 4);
          const precioUnitario = productSeeds[p].precio;
          const cliente = clientes[Math.floor(rand() * clientes.length)];
          const metodo = METODOS_PAGO[Math.floor(rand() * METODOS_PAGO.length)];
          const hora = 10 + Math.floor(rand() * 9);
          const ts = dia + hora * 3600000 + Math.floor(rand() * 60) * 60000;
          await db.ventas.add({
            productoId: productos[p],
            nombreProducto: productSeeds[p].nombre,
            cantidad,
            precioUnitario,
            costoUnitario: productSeeds[p].costo,
            fecha: ts,
            cliente,
            metodoPago: metodo,
          });
        }
      }
    }

    // Gastos del mes
    const mesLabel = `${mesInicio.getFullYear()}-${String(mesInicio.getMonth() + 1).padStart(2, "0")}`;

    // Insumos: reposición de mercadería
    const insumos = 5 + Math.floor(rand() * 4);
    for (let i = 0; i < insumos; i++) {
      const diaI = Math.floor(rand() * dias);
      const ts = new Date(mesInicio.getFullYear(), mesInicio.getMonth(), diaI + 1, 12 + Math.floor(rand() * 5)).getTime();
      const monto = Math.round((productSeeds[Math.floor(rand() * productSeeds.length)].costo * (8 + rand() * 25) * factor) / 500) * 500;
      await db.gastos.add({
        categoria: "Insumos",
        descripcion: `Reposición mercadería ${mesLabel}`,
        monto,
        fecha: ts,
        recurrente: false,
      });
    }

    // Sueldos (fijos, recurrentes)
    await db.gastos.add({
      categoria: "Sueldos",
      descripcion: "Sueldo colaborador",
      monto: 180000,
      fecha: new Date(mesInicio.getFullYear(), mesInicio.getMonth(), Math.min(5, dias)).getTime(),
      recurrente: true,
    });

    // Servicios: alquiler + luz + internet
    await db.gastos.add({
      categoria: "Servicios",
      descripcion: "Alquiler local",
      monto: 250000,
      fecha: new Date(mesInicio.getFullYear(), mesInicio.getMonth(), 1).getTime(),
      recurrente: true,
    });
    await db.gastos.add({
      categoria: "Servicios",
      descripcion: "Luz e internet",
      monto: Math.round((18000 + rand() * 9000) / 100) * 100,
      fecha: new Date(mesInicio.getFullYear(), mesInicio.getMonth(), Math.floor(rand() * 6)).getTime(),
      recurrente: true,
    });

    // Publicidad
    const basePub = 25000 + rand() * 20000;
    const pubAlta = m === 2 ? 95000 : basePub * (0.7 + rand() * 0.4);
    await db.gastos.add({
      categoria: "Publicidad",
      descripcion: m === 2 ? "Campaña redes sociales y ads" : "Campaña redes sociales",
      monto: Math.round(pubAlta / 100) * 100,
      fecha: new Date(mesInicio.getFullYear(), mesInicio.getMonth(), 8 + Math.floor(rand() * 10)).getTime(),
      recurrente: false,
    });

    // Otros
    if (rand() < 0.6) {
      await db.gastos.add({
        categoria: "Otros",
        descripcion: "Reparaciones y varios",
        monto: Math.round((8000 + rand() * 20000) / 500) * 500,
        fecha: new Date(mesInicio.getFullYear(), mesInicio.getMonth(), Math.floor(rand() * 20)).getTime(),
        recurrente: false,
      });
    }
  }

  // Presupuestos por categoría (monto mensual)
  const presupuestosSeed = [
    { categoria: "Insumos" as const, montoMensual: 450000 },
    { categoria: "Publicidad" as const, montoMensual: 60000 },
    { categoria: "Servicios" as const, montoMensual: 300000 },
    { categoria: "Sueldos" as const, montoMensual: 200000 },
    { categoria: "Otros" as const, montoMensual: 50000 },
  ];
  await db.presupuestos.bulkAdd(presupuestosSeed);

  // Tabla de inflación mensual (últimos 9 meses, valores de ejemplo)
  const inflacionSeed = [
    2.2, 2.0, 1.9, 2.4, 2.1, 1.8, 2.3, 2.0, 1.7,
  ];
  for (let i = inflacionSeed.length - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mesKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    await db.inflacion.add({ mesKey, variacionPct: inflacionSeed[inflacionSeed.length - 1 - i] });
  }
}