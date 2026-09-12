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
  productoId: number;
  nombreProducto: string;
  cantidad: number;
  precioUnitario: number;
  costoUnitario: number;
  fecha: number;
  cliente: string;
  metodoPago: MetodoPago;
}

export interface Gasto {
  id?: number;
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
  "Alimentos",
  "Bebidas",
  "Limpieza",
  "Artículos del hogar",
  "Tecnología",
  "Ropa",
  "Cosmética",
  "Otros",
];

export interface Recomendacion {
  id: string;
  tipo: "danger" | "warning" | "info" | "success";
  titulo: string;
  descripcion: string;
  accion?: string;
  link?: string;
}