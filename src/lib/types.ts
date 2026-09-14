export type CategoriaGasto =
  | "Insumos"
  | "Publicidad"
  | "Servicios"
  | "Sueldos"
  | "Otros";

export type MetodoPago =
  | "Efectivo"
  | "Tarjeta"
  | "Transferencia"
  | "Mercado Pago"
  | "Otro";

export type Periodo = "todo" | "30d" | "90d" | "12m";

export interface Producto {
  id?: number;
  uid?: string;
  updatedAt?: number;
  nombre: string;
  categoria: string;
  sku: string;
  costo: number;
  precio: number;
  stock: number;
  umbralStock: number;
  createdAt: number;
}

export interface Venta {
  id?: number;
  uid?: string;
  updatedAt?: number;
  productoId: number | null;
  nombreProducto: string;
  cantidad: number;
  precioUnitario: number;
  costoUnitario: number;
  fecha: number;
  cliente: string;
  metodoPago: MetodoPago;
  externa?: boolean;
  referencia?: string;
}

export interface Presupuesto {
  id?: number;
  uid?: string;
  updatedAt?: number;
  categoria: CategoriaGasto;
  montoMensual: number;
}

export interface Factura {
  id?: number;
  uid?: string;
  updatedAt?: number;
  tipo: "emitida" | "recibida";
  letra: "A" | "B" | "C";
  numero: string;
  fecha: number;
  cliente?: string;
  cuit?: string;
  condicion: string;
  monto: number;
  detalle: string;
  ventaId?: number | null;
  gastoId?: number | null;
}

export interface InflacionMes {
  id?: number;
  uid?: string;
  updatedAt?: number;
  mesKey: string; // "yyyy-mm"
  variacionPct: number;
}

export interface FiscalConfig {
  razonSocial: string;
  cuit: string;
  condicionIva: "monotributo" | "respin" | "exento";
  monotributoCategoria: string;
  ivaPct: number;
  ptoVenta: string;
  direccion: string;
  localidad: string;
}

export interface GatewayConfig {
  mpEnabled: boolean;
  mpSaveToken: boolean;
  mpUsarServidor: boolean;
  stripeEnabled: boolean;
  stripeSaveToken: boolean;
  stripeUsarServidor: boolean;
  paypalEnabled: boolean;
  paypalSaveToken: boolean;
  paypalUsarServidor: boolean;
}

export interface TransaccionExterna {
  externalId: string;
  fecha: number;
  monto: number;
  moneda: string;
  concepto: string;
  cliente?: string;
  metodoPago: MetodoPago;
}

export interface Gasto {
  id?: number;
  uid?: string;
  updatedAt?: number;
  categoria: CategoriaGasto;
  descripcion: string;
  monto: number;
  fecha: number;
  recurrente: boolean;
}

export const CATEGORIAS_GASTO: CategoriaGasto[] = [
  "Insumos",
  "Publicidad",
  "Servicios",
  "Sueldos",
  "Otros",
];

export const CATEGORIAS_GASTO_COLORS: Record<CategoriaGasto, string> = {
  Insumos: "#f59e0b",
  Publicidad: "#8b5cf6",
  Servicios: "#38bdf8",
  Sueldos: "#f43f5e",
  Otros: "#94a3b8",
};

export const METODOS_PAGO: MetodoPago[] = [
  "Efectivo",
  "Tarjeta",
  "Transferencia",
  "Mercado Pago",
  "Otro",
];

export const CATEGORIAS_PRODUCTO = [
  "remeras regular",
  "remeras boxy",
  "remeras over",
  "camperas",
  "joggins",
  "buzos",
  "bermudas",
  "jeans",
];

export interface Recomendacion {
  id: string;
  tipo: "danger" | "warning" | "info" | "success";
  titulo: string;
  descripcion: string;
  accion?: string;
  link?: string;
}