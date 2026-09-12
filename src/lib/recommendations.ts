import type { FiscalConfig, Gasto, Presupuesto, Producto, Recomendacion, Venta } from "./types";
import {
  diasSinVender,
  isStockBajo,
  marginPct,
  pctVariacion,
  resumenMes,
  seriePorMes,
} from "./calc";
import { MESES, MESES_CORTO } from "./format";
import { estadoMonotributo } from "./fiscal";

export interface DatosParaAnalisis {
  productos: Producto[];
  ventas: Venta[];
  gastos: Gasto[];
  presupuestos?: Presupuesto[];
  fiscal?: FiscalConfig;
  limitesMonotributo?: { letra: string; limiteAnual: number }[];
}

export function generarRecomendaciones(
  datos: DatosParaAnalisis,
  now = new Date()
): Recomendacion[] {
  const { productos, ventas, gastos, presupuestos, fiscal, limitesMonotributo } = datos;
  const out: Recomendacion[] = [];
  const nowTs = now.getTime();

  // 1. Stock bajo / agotado
  for (const p of productos) {
    if (p.stock === 0) {
      out.push({
        id: `stock0-${p.id}`,
        tipo: "danger",
        titulo: `"${p.nombre}" agotado`,
        descripcion: `No queda stock y el costo de reposición es de tu registro normal. Tené en cuenta reabastecer para no perder ventas.`,
        accion: "Ir a Productos",
        link: "/productos",
      });
    } else if (isStockBajo(p)) {
      out.push({
        id: `stockbajo-${p.id}`,
        tipo: "warning",
        titulo: `Stock bajo: ${p.nombre}`,
        descripcion: `Quedan ${p.stock} unidades (umbral: ${p.umbralStock}). Considerá reponer antes de quedarte sin stock.`,
        accion: "Ir a Productos",
        link: "/productos",
      });
    }
  }

  // 2. Margen muy bajo
  for (const p of productos) {
    const m = marginPct(p);
    if (p.stock > 0 && p.precio > 0 && m < 25) {
      out.push({
        id: `margen-${p.id}`,
        tipo: m < 10 ? "danger" : "warning",
        titulo: `Margen muy bajo en ${p.nombre}`,
        descripcion: `El margen actual es de ${m.toFixed(1)}%. Para llegar al menos al 25%, el precio sugerido sería ≈ $${(p.costo / (1 - 0.25)).toFixed(0)}.`,
        accion: "Ver producto",
        link: "/productos",
      });
    }
  }

  // 3. Stock estancado (sin ventas en 60 días)
  for (const p of productos) {
    if (p.stock > 0) {
      const dias = diasSinVender(ventas, p.id as number, nowTs);
      if (dias >= 60) {
        out.push({
          id: `estancado-${p.id}`,
          tipo: "warning",
          titulo: `Stock estancado: ${p.nombre}`,
          descripcion: `No se vende hace ${dias === Infinity ? "mucho tiempo" : `${dias} días`} y tenés ${p.stock} unidades. Considerá una promoción, pack o reducción de precio.`,
          accion: "Definir promoción",
          link: "/productos",
        });
      }
    }
  }

  // 4. Publicidad con bajo retorno (últimos 4 meses)
  const meses = seriePorMes(ventas, gastos, 4, now);
  for (const mes of meses) {
    const ing = mes.ingresos;
    const pub = mes.egresos;
    if (pub > 0) {
      const retorno = ing / pub;
      if (retorno < 2 && ing > 0) {
        out.push({
          id: `publicidad-${mes.key}`,
          tipo: retorno < 1 ? "danger" : "warning",
          titulo: `Publicidad con bajo retorno (${mes.label})`,
          descripcion: `Se invirtió $${pub.toLocaleString("es-AR")} en anuncios y se generaron $${ing.toLocaleString("es-AR")} en ventas (retorno x${retorno.toFixed(1)}). Revisá la campaña o el público objetivo.`,
          accion: "Ver gastos",
          link: "/gastos?categoria=Publicidad",
        });
      }
    }
  }

  // 5. Flujo de caja negativo (mes actual)
  const actual = resumenMes(ventas, gastos, now.getFullYear(), now.getMonth());
  if (actual.balance < 0) {
    out.push({
      id: `flujo-${now.getMonth()}`,
      tipo: "danger",
      titulo: "Flujo de caja negativo este mes",
      descripcion: `Balance del mes en curso: $${actual.balance.toLocaleString("es-AR")}. Buscá bajar costos o acelerar ventas para evitar quedarte sin liquidez.`,
      accion: "Ver Dashboard mensual",
      link: "/dashboard-mensual",
    });
  }

  // 6. Variación vs mes anterior
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const anterior = resumenMes(ventas, gastos, prev.getFullYear(), prev.getMonth());
  const pct = pctVariacion(actual.ingresos, anterior.ingresos);
  if (pct !== null && pct < -15) {
    out.push({
      id: "caida-ventas",
      tipo: "warning",
      titulo: `Ventas ↓ ${Math.abs(pct).toFixed(1)}% vs mes anterior`,
      descripcion: `Los ingresos del mes actual ($${actual.ingresos.toLocaleString("es-AR")}) están por debajo de ${MESES[prev.getMonth()]} ($${anterior.ingresos.toLocaleString("es-AR")}).`,
      accion: "Ver Dashboard mensual",
      link: "/dashboard-mensual",
    });
  } else if (pct !== null && pct > 15) {
    out.push({
      id: "subida-ventas",
      tipo: "success",
      titulo: `Ventas ↑ ${pct.toFixed(1)}% vs mes anterior`,
      descripcion: `El mes en curso va ${pct.toFixed(0)}% por encima de ${MESES[prev.getMonth()]}. ¡Seguí así! Asegurate de tener stock suficiente.`,
      accion: "Ver Productos",
      link: "/productos",
    });
  }

  // 7. Buen retorno de publicidad general
  const gastoPub = gastos
    .filter((g) => g.categoria === "Publicidad")
    .reduce((s, g) => s + g.monto, 0);
  if (gastoPub > 0) {
    const ingresosTotales = ventas.reduce(
      (s, v) => s + v.cantidad * v.precioUnitario,
      0
    );
    const retorno = ingresosTotales / gastoPub;
    if (retorno >= 3) {
      out.push({
        id: "roi-bueno",
        tipo: "success",
        titulo: "La publicidad está rindiendo",
        descripcion: `Históricamente cada $1 invertido en publicidad genera ~$${retorno.toFixed(1)} en ventas. Considerá escalar la inversión.`,
        accion: "Ver Gastos",
        link: "/gastos",
      });
    }
  }

  // 8. Producto clave (mejor margen con stock)
  let clave: Producto | null = null;
  for (const p of productos) {
    if (p.precio > 0 && p.stock > 0 && marginPct(p) >= 25) {
      if (!clave || marginPct(p) > marginPct(clave)) clave = p;
    } else if (!clave && p.stock > 0) {
      clave = p;
    }
  }
  if (clave) {
    out.push({
      id: "top-focus",
      tipo: "info",
      titulo: `Producto clave: ${clave.nombre}`,
      descripcion: `Tiene margen de ${marginPct(clave).toFixed(1)}% y stock disponible (${clave.stock}). Mantener abastecido este producto protege tu utilidad.`,
      accion: "Ver Productos",
      link: "/productos",
    });
  }

  // 9. Presupuesto por categoría superado o cerca (mes actual)
  if (presupuestos && presupuestos.length) {
    const mesPresupuestos = resumenMes(ventas, gastos, now.getFullYear(), now.getMonth());
    const gg = new Map<string, number>();
    for (const g of mesPresupuestos.gastos) gg.set(g.categoria, (gg.get(g.categoria) || 0) + g.monto);
    for (const p of presupuestos) {
      if (p.montoMensual <= 0) continue;
      const gastado = gg.get(p.categoria) || 0;
      const pct = (gastado / p.montoMensual) * 100;
      if (pct >= 100) {
        out.push({
          id: `presupuesto-${p.categoria}`,
          tipo: "danger",
          titulo: `Presupuesto de ${p.categoria} superado`,
          descripcion: `Gastaste $${gastado.toLocaleString("es-AR")} sobre un tope de $${p.montoMensual.toLocaleString("es-AR")} (${pct.toFixed(0)}%) este mes. Revisá si podés diferir gastos al mes que viene.`,
          accion: "Ir a Presupuestos",
          link: "/presupuestos",
        });
      } else if (pct >= 80) {
        out.push({
          id: `presupuesto-cerca-${p.categoria}`,
          tipo: "warning",
          titulo: `Cerca del presupuesto de ${p.categoria}`,
          descripcion: `Llevás $${gastado.toLocaleString("es-AR")} de $${p.montoMensual.toLocaleString("es-AR")} (${pct.toFixed(0)}%). Moderá gastos en esta categoría para no excederte.`,
          accion: "Ir a Presupuestos",
          link: "/presupuestos",
        });
      }
    }
  }

  // 10. Monotributo: límite de categoría próximo o superado
  if (fiscal && limitesMonotributo && limitesMonotributo.length) {
    const mono = estadoMonotributo(ventas, limitesMonotributo, fiscal, now);
    if (mono.superado) {
      out.push({
        id: "monotributo-superado",
        tipo: "danger",
        titulo: `Monotributo: superaste el tope de la categoría ${mono.categoriaActual?.letra}`,
        descripcion: `Facturaste $${mono.facturado12m.toLocaleString("es-AR")} en los últimos 12 meses. Recategorizate o evaluá regularizar la situación con tu contador.`,
        accion: "Ver Facturación",
        link: "/facturacion",
      });
    } else if (mono.proximoLimitePct != null && mono.proximoLimitePct > 75) {
      out.push({
        id: "monotributo-proximo",
        tipo: "warning",
        titulo: `Monotributo: cerca del límite de la categoría ${mono.categoriaActual?.letra} (${mono.usoPct.toFixed(0)}%)`,
        descripcion: `Te quedan $${((mono.categoriaActual?.limiteAnual ?? 0) - mono.facturado12m).toLocaleString("es-AR")} de margen anual. Controlá la facturación para no pasarte.`,
        accion: "Ver Facturación",
        link: "/facturacion",
      });
    }
  }

  // Ordenar por severidad
  const order = { danger: 0, warning: 1, info: 2, success: 3 };
  return out.sort((a, b) => order[a.tipo] - order[b.tipo]);
}

/**
 * Genera el "contexto" en texto plano que le darías a un modelo de lenguaje
 * (IA) para obtener recomendaciones más finas. Hoy el sistema usa reglas,
 * pero si querés conectar un LLM, pasá esto como prompt + datos del negocio.
 */
export function construirPromptParaIA(
  datos: DatosParaAnalisis,
  now = new Date()
): string {
  const { productos, ventas, gastos } = datos;
  const mes = seriePorMes(ventas, gastos, 6, now)
    .map(
      (m) =>
        `${m.label}: ingresos $${m.ingresos.toLocaleString(
          "es-AR"
        )}, egresos $${m.egresos.toLocaleString("es-AR")}, utilidad $${m.utilidad.toLocaleString(
          "es-AR"
        )}`
    )
    .join("\n");
  const prods = productos
    .map(
      (p) =>
        `${p.nombre} (${p.categoria}) costo $${p.costo}/precio $${p.precio}/stock ${p.stock}/umbral ${p.umbralStock}`
    )
    .join("\n");
  return `DATOS DEL NEGOCIO (${MESES_CORTO[now.getMonth()]} ${now.getFullYear()})
MESES:
${mes}
PRODUCTOS:
${prods}
VENTAS TOTALES: ${ventas.length}
GASTOS TOTALES: ${gastos.length}`;
}