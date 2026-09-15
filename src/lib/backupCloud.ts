// Copias de seguridad en la nube (Plan Pro): el respaldo completo del negocio
// se cifra con la clave derivada de la contraseña de la cuenta y se sube a la
// mísma tabla de sincronización (`registros`, con tabla `respaldo`) que ya usa
// la app. Como `sync` solo procesa las 6 tablas de datos, estas filas no
// interfieren y se pueden leer restauradas desde cualquier dispositivo.
import { db, aplicarBackupData, backupValido } from "./db";
import { supabase } from "./supabase";
import { getCuentaActivaId } from "./accounts";
import { encriptarTexto, desencriptarTexto } from "./secureStore";

const TABLA = "respaldo";
const REGISTRO_ID = "nube";
const DIAS_AUTO = 7;

interface RespaldoNube {
  version: number;
  iv: string;
  ct: string;
  tam: number;
  exportado: string;
}

export function getUltimoRespaldoNube(): number | null {
  const id = getCuentaActivaId() || "default";
  const raw = localStorage.getItem(`fin_pro_respaldo_nube_${id}`);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function sesionLista(): Promise<boolean> {
  const client = supabase();
  if (!client) return false;
  const { data } = await client.auth.getSession();
  return Boolean(data.session);
}

export async function crearRespaldoNube(): Promise<{ ok: boolean; mensaje: string }> {
  const client = supabase();
  const cta = getCuentaActivaId();
  if (!client || !cta) {
    return { ok: false, mensaje: "La sincronización no está configurada." };
  }
  if (!(await sesionLista())) {
    return { ok: false, mensaje: "Iniciá sesión para poder respaldar en la nube." };
  }
  try {
    const datos = {
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
    const json = JSON.stringify(datos);
    const cif = await encriptarTexto(json);
    const payload: RespaldoNube = {
      version: 1,
      iv: cif.iv,
      ct: cif.ct,
      tam: json.length,
      exportado: datos.exportado,
    };
    const { error } = await client.from("registros").upsert(
      {
        cuenta_id: cta,
        tabla: TABLA,
        registro_id: REGISTRO_ID,
        payload,
        updated_at: new Date().toISOString(),
        deleted: false,
      },
      { onConflict: "cuenta_id,tabla,registro_id" }
    );
    if (error) return { ok: false, mensaje: `No se pudo subir el respaldo: ${error.message}` };
    localStorage.setItem(`fin_pro_respaldo_nube_${cta}`, String(Date.now()));
    return { ok: true, mensaje: "Respaldo cifrado subido a la nube." };
  } catch (e) {
    return { ok: false, mensaje: (e as Error).message || "No se pudo respaldar en la nube." };
  }
}

export async function restaurarRespaldoNube(): Promise<{ ok: boolean; mensaje: string }> {
  const client = supabase();
  const cta = getCuentaActivaId();
  if (!client || !cta) {
    return { ok: false, mensaje: "La sincronización no está configurada." };
  }
  if (!(await sesionLista())) {
    return { ok: false, mensaje: "Iniciá sesión para poder restaurar." };
  }
  try {
    const { data, error } = await client
      .from("registros")
      .select("payload, updated_at")
      .eq("cuenta_id", cta)
      .eq("tabla", TABLA)
      .eq("registro_id", REGISTRO_ID)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const fila = ((data as { payload: RespaldoNube }[]) || [])[0];
    if (!fila) return { ok: false, mensaje: "Todavía no hay respaldos en la nube." };
    const json = await desencriptarTexto(fila.payload.iv, fila.payload.ct);
    const datos = JSON.parse(json) as unknown;
    if (!backupValido(datos)) {
      return { ok: false, mensaje: "El respaldo de la nube no es válido." };
    }
    await aplicarBackupData(datos);
    return { ok: true, mensaje: `Respaldo del ${fila.payload.exportado} restaurado.` };
  } catch (e) {
    return { ok: false, mensaje: (e as Error).message || "No se pudo restaurar." };
  }
}

export function respaldoVencido(): boolean {
  const ult = getUltimoRespaldoNube();
  if (ult === null) return true;
  return Date.now() - ult > DIAS_AUTO * 86400000;
}