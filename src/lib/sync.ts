import { db } from "./db";
import { supabase, supabaseConfigurado } from "./supabase";
import { getCuentaActivaId } from "./accounts";

export type TablaSync =
  | "productos"
  | "ventas"
  | "gastos"
  | "presupuestos"
  | "facturas"
  | "inflacion";

interface FilaLocal {
  id?: number;
  uid?: string;
  updatedAt?: number;
  [k: string]: unknown;
}

interface RegistroNube {
  tabla: TablaSync;
  registro_id: string;
  payload: Record<string, unknown>;
  updated_at: string;
  deleted: boolean;
}

interface Marca {
  tabla: TablaSync;
  uid: string;
  ts: number;
}

/** API genérica para operar sobre cualquier tabla de Dexie del sync. */
interface TablaGenerica {
  name: string;
  toArray(): Promise<FilaLocal[]>;
  add(data: Record<string, unknown>): Promise<unknown>;
  update(id: number, changes: Record<string, unknown>): Promise<number>;
  where(field: string): {
    equals(value: string): { first(): Promise<FilaLocal | undefined>; delete(): Promise<number> };
  };
}

export interface ResultadoSync {
  subidos: number;
  bajados: number;
  borrados: number;
}

const TABLAS: TablaSync[] = [
  "productos",
  "ventas",
  "gastos",
  "presupuestos",
  "facturas",
  "inflacion",
];

function tablaDex(tabla: TablaSync): TablaGenerica {
  return db[tabla] as unknown as TablaGenerica;
}

function limpiarPayload(p: Record<string, unknown>): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, uid, updatedAt, ...rest } = p;
  return rest;
}

/**
 * Sincronización bidireccional (offline-first, last-write-wins por
 * `updatedAt`) entre la base local (IndexedDB) y Supabase.
 * Devuelve el resultado o null si Supabase no está configurado o sin sesión.
 */
export async function sincronizar(cuentaId?: string): Promise<ResultadoSync | null> {
  if (!supabaseConfigurado()) return null;
  const client = supabase();
  if (!client) return null;
  const { data: sesion } = await client.auth.getSession();
  if (!sesion.session) return null;
  const cta = cuentaId ?? getCuentaActivaId();
  if (!cta) return null;

  // Marcas de borrado local pendientes
  const marcas = (await db.sync_marcas.toArray()) as unknown as Marca[];
  const marcasLocal = new Map<string, number>();
  for (const m of marcas) marcasLocal.set(`${m.tabla}|${m.uid}`, m.ts);
  const marcasUsadas: string[] = [];

  const { data, error } = await client
    .from("registros")
    .select("tabla, registro_id, payload, updated_at, deleted")
    .eq("cuenta_id", cta);
  if (error) throw new Error(`No se pudo leer la nube: ${error.message}`);

  const nube = new Map<TablaSync, Map<string, RegistroNube>>();
  for (const r of (data as RegistroNube[]) || []) {
    if (!nube.has(r.tabla)) nube.set(r.tabla, new Map());
    nube.get(r.tabla)!.set(r.registro_id, r);
  }

  const upserts: Record<string, unknown>[] = [];
  let subidos = 0;
  let bajados = 0;
  let borrados = 0;

  for (const tabla of TABLAS) {
    const t = tablaDex(tabla);
    const mapa = nube.get(tabla) || new Map();
    const filas = await t.toArray();
    const uidsLocales = new Set<string>();

    // Fase 1: fusionar filas locales con la nube
    for (const fila of filas) {
      const teniaUid = Boolean(fila.uid);
      const uid = asegurarUid(fila);
      if (!teniaUid && fila.id != null) {
        // Persistir el uid asignado a filas legadas (sin él no habría
        // forma de identificarlas en la nube en el próximo sync).
        await t.update(fila.id, { uid, updatedAt: fila.updatedAt });
      }
      uidsLocales.add(uid);
      const cloud = mapa.get(uid);
      const localTs = fila.updatedAt ?? 0;
      const cloudTs = cloud ? Date.parse(cloud.updated_at) : 0;

      if (cloud && cloud.deleted && cloudTs >= localTs) {
        await t.where("uid").equals(uid).delete();
        borrados += 1;
        continue;
      }
      if (!cloud || cloudTs < localTs) {
        upserts.push({
          cuenta_id: cta,
          tabla,
          registro_id: uid,
          payload: limpiarPayload(fila),
          updated_at: new Date(localTs).toISOString(),
          deleted: false,
        });
        mapa.set(uid, {
          tabla,
          registro_id: uid,
          payload: limpiarPayload(fila),
          updated_at: new Date(localTs).toISOString(),
          deleted: false,
        });
        subidos += 1;
        continue;
      }
      // La nube es más nueva: aplicarla localmente conservando el PK/uid
      const patch = { ...cloud.payload, uid, updatedAt: cloudTs };
      delete patch.id;
      if (fila.id != null) await t.update(fila.id, patch);
      else await t.add({ ...patch });
      bajados += 1;
    }

    // Fase 2: adoptar filas de la nube que no tenemos localmente
    // (excepto las borradas localmente con fecha >= a la de la nube)
    for (const [uid, cloud] of mapa) {
      if (cloud.deleted) continue;
      if (uidsLocales.has(uid)) continue;
      const marcaTs = marcasLocal.get(`${tabla}|${uid}`);
      const cloudTs = Date.parse(cloud.updated_at);
      if (marcaTs != null && marcaTs >= cloudTs) continue;
      await t.add({
        ...(cloud.payload as Record<string, unknown>),
        id: undefined,
        uid,
        updatedAt: cloudTs,
      });
      uidsLocales.add(uid);
      if (marcaTs != null) {
        marcasLocal.delete(`${tabla}|${uid}`);
        marcasUsadas.push(`${tabla}|${uid}`);
      }
      bajados += 1;
    }

    // Fase 3: propagar eliminaciones locales (marcas) a la nube
    const presente = new Set(uidsLocales);
    for (const [uid, cloud] of mapa) {
      if (cloud.deleted || presente.has(uid)) continue;
      const marcaTs = marcasLocal.get(`${tabla}|${uid}`);
      if (marcaTs == null) continue;
      const cloudTs = Date.parse(cloud.updated_at);
      if (marcaTs < cloudTs) continue;
      upserts.push({
        cuenta_id: cta,
        tabla,
        registro_id: uid,
        payload: cloud.payload,
        updated_at: new Date().toISOString(),
        deleted: true,
      });
      marcasUsadas.push(`${tabla}|${uid}`);
      borrados += 1;
    }

    // Limpiar marcas ya utilizadas
    for (const k of marcasUsadas) {
      const [tb, uid] = k.split("|") as [TablaSync, string];
      await db.sync_marcas
        .where("uid")
        .equals(uid)
        .filter((m: unknown) => (m as Marca).tabla === tb)
        .delete();
    }
    marcasUsadas.length = 0;
  }

  for (let i = 0; i < upserts.length; i += 400) {
    const { error } = await client
      .from("registros")
      .upsert(upserts.slice(i, i + 400), { onConflict: "cuenta_id,tabla,registro_id" });
    if (error) throw new Error(`No se pudo escribir en la nube: ${error.message}`);
  }

  return { subidos, bajados, borrados };
}

function asegurarUid(fila: FilaLocal): string {
  if (fila.uid) return fila.uid;
  fila.uid = nuevoUid();
  fila.updatedAt = fila.updatedAt ?? 0;
  return fila.uid!;
}

function nuevoUid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}