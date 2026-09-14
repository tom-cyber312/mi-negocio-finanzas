import type { LucideIcon } from "lucide-react";
import {
  CalendarRange,
  LayoutDashboard,
  Package,
  Plug,
  Receipt,
  ShoppingCart,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";

export interface ItemNav {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  descripcion: string;
}

export interface GrupoNav {
  id: string;
  titulo: string;
  descripcion: string;
  items: ItemNav[];
}

export const GRUPOS_NAV: GrupoNav[] = [
  {
    id: "vision",
    titulo: "Visión general",
    descripcion:
      "Empezá por acá: el estado real de tu negocio de un vistazo, hoy y mes a mes.",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard General",
        shortLabel: "Dashboard",
        icon: LayoutDashboard,
        descripcion:
          "Tus números del período actual: ingresos, egresos, ganancia, margen, productos más vendidos, deudores y la comparación con el mes anterior. Es el lugar para responder “¿cómo viene el negocio?”.",
      },
      {
        href: "/dashboard-mensual",
        label: "Dashboard Mensual",
        shortLabel: "Mensual",
        icon: CalendarRange,
        descripcion:
          "Elegí un mes y analizalo en detalle: ingresos vs. egresos, gastos por categoría, presupuestos y venta por día. Ideal para seguir la evolución a lo largo del año.",
      },
    ],
  },
  {
    id: "operacion",
    titulo: "Operación diaria",
    descripcion:
      "Lo que usás todos los días para registrar y controlar tu negocio.",
    items: [
      {
        href: "/productos",
        label: "Productos",
        shortLabel: "Productos",
        icon: Package,
        descripcion:
          "Cargá tu catálogo: nombre, categoría, SKU, costo, precio de venta y stock. La app te avisa cuando algo queda bajo stock y calcula tus márgenes.",
      },
      {
        href: "/ventas",
        label: "Ventas",
        shortLabel: "Ventas",
        icon: ShoppingCart,
        descripcion:
          "Registrá cada venta: elegís el producto, el stock se descuenta automáticamente y queda en tu historial de ingresos.",
      },
      {
        href: "/gastos",
        label: "Gastos",
        shortLabel: "Gastos",
        icon: Wallet,
        descripcion:
          "Anotá tus costos por categoría (insumos, servicios, sueldos, publicidad…). Es clave para medir cuánto gastás y el retorno de tu inversión.",
      },
    ],
  },
  {
    id: "planificacion",
    titulo: "Planificación y cumplimiento",
    descripcion:
      "Anticipate a lo que viene: poné metas mensuales y tené tus comprobantes e impuestos al día.",
    items: [
      {
        href: "/presupuestos",
        label: "Presupuestos",
        shortLabel: "Presupuestos",
        icon: Target,
        descripcion:
          "Definí un tope mensual por categoría de gasto y la app te muestra, en tiempo real, presupuestado vs. gastado con semáforos de avance.",
      },
      {
        href: "/facturacion",
        label: "Facturación",
        shortLabel: "Facturación",
        icon: Receipt,
        descripcion:
          "Generá comprobantes (letra A, B o C según tu condición), estimá Monotributo e IVA y cargá la inflación para comparar meses en términos reales.",
      },
    ],
  },
  {
    id: "crecimiento",
    titulo: "Crecimiento y conexiones",
    descripcion:
      "Sacale el jugo a tus datos: conectá tus medios de cobro y dejá que la app te señale oportunidades.",
    items: [
      {
        href: "/integraciones",
        label: "Integraciones",
        shortLabel: "Integraciones",
        icon: Plug,
        descripcion:
          "Importá ventas de Mercado Pago, Stripe o PayPal, o cargá un extracto en CSV. Preparate para e-commerce y open banking.",
      },
      {
        href: "/recomendaciones",
        label: "Recomendaciones",
        shortLabel: "Recomendaciones",
        icon: Sparkles,
        descripcion:
          "Reglas inteligentes sobre tus propios datos: productos con poco margen, stock bajo, deudores, clientes destacados y oportunidades para crecer.",
      },
    ],
  },
];