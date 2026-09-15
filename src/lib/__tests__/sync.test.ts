// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { db, deleteProducto, saveProducto } from "../db";
import { sincronizar } from "../sync";
import type { Producto } from "../types";

const mockFilas = new Map<string, Record<string, unknown>>();
let mockFailUpsert = false;

vi.mock("../supabase", () => {
  function listar(): { data: unknown[]; error: null } {
    const filas = [...mockFilas.values()].map((r) => ({
      tabla: r.tabla as string,
      registro_id: r.registro_id as string,
      payload: r.payload,
      updated_at: r.updated_at as string,
      deleted: r.deleted as boolean,
    }));
    return { data: filas, error: null };
  }
  return {
    supabaseConfigurado: () => true,
    supabase: () => ({
      auth: {
        getSession: async () => ({ data: { session: {} } }),
      },
      from: (tabla: string) => {
        if (tabla === "registros") {
          return {
            select: () => ({
              eq: () => ({
                then: async (resolve: (r: unknown) => void) => resolve(listar()),
              }),
            }),
            upsert: async (
              rows: Record<string, unknown>[]
            ): Promise<{ error: { message: string } | null }> => {
              if (mockFailUpsert) return { error: { message: "write failed" } };
              for (const r of rows) {
                const key = `${r.cuenta_id}|${r.tabla}|${r.registro_id}`;
                mockFilas.set(key, { ...(mockFilas.get(key) || {}), ...r });
              }
              return { error: null };
            },
          };
        }
        return {
          select: () => ({
            eq: () => ({
              then: async (resolve: (r: unknown) => void) => resolve(listar()),
            }),
          }),
          upsert: async () => ({ error: null }),
        };
      },
    }),
  };
});

vi.mock("../accounts", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../accounts")>();
  return { ...mod, getCuentaActivaId: () => "default" };
});

function productoBase(): Producto {
  return {
    nombre: "Remera test",
    categoria: "remeras",
    sku: "T-1",
    costo: 100,
    precio: 200,
    stock: 5,
    umbralStock: 2,
    createdAt: Date.now(),
  };
}

describe("sync: borrado de productos", () => {
  beforeEach(async () => {
    mockFilas.clear();
    mockFailUpsert = false;
    localStorage.clear();
    await Promise.all([
      db.productos.clear(),
      db.ventas.clear(),
      db.gastos.clear(),
      db.presupuestos.clear(),
      db.facturas.clear(),
      db.inflacion.clear(),
      db.sync_marcas.clear(),
    ]);
  });

  it("borrar y sincronizar propaga la baja y no resucita el producto", async () => {
    const id = await saveProducto(productoBase());
    await sincronizar();
    await deleteProducto(id);

    // La marca de borrado debe existir luego del delete
    expect(await db.sync_marcas.toArray()).toHaveLength(1);

    await sincronizar();

    expect(await db.productos.toArray()).toHaveLength(0);
    expect(await db.sync_marcas.toArray()).toHaveLength(0);
    expect([...mockFilas.values()].every((r) => r.deleted === true)).toBe(true);
  });

  it("no re-adopta un producto aunque la nube tenga una copia más nueva", async () => {
    const id = await saveProducto(productoBase());
    await sincronizar();
    const uid = (mockFilas.values().next().value as { registro_id: string }).registro_id;
    const key = [...mockFilas.keys()].find((k) => k.endsWith(`|productos|${uid}`))!;

    await deleteProducto(id);
    // La nube queda más nueva que el tombstone (p. ej. sync concurrente)
    mockFilas.get(key)!.updated_at = new Date(Date.now() + 30_000).toISOString();
    await sincronizar();

    expect(await db.productos.where("uid").equals(uid).toArray()).toHaveLength(0);
    expect((mockFilas.get(key) as { deleted: boolean }).deleted).toBe(true);

    // Reentrada: el siguiente sync tampoco lo revive
    mockFilas.get(key)!.updated_at = new Date(Date.now() + 60_000).toISOString();
    await sincronizar();
    expect(await db.productos.where("uid").equals(uid).toArray()).toHaveLength(0);
    expect(await db.sync_marcas.toArray()).toHaveLength(0);
  });

  it("si falla la escritura a la nube, la marca persiste y el borrado se re-intenta", async () => {
    const id = await saveProducto(productoBase());
    await sincronizar();
    await deleteProducto(id);

    mockFailUpsert = true;
    await expect(sincronizar()).rejects.toThrow();
    // La marca no se consumió y el producto sigue borrado localmente
    expect(await db.sync_marcas.toArray()).toHaveLength(1);
    expect(await db.productos.toArray()).toHaveLength(0);

    mockFailUpsert = false;
    await sincronizar();
    expect([...mockFilas.values()].every((r) => r.deleted === true)).toBe(true);
    expect(await db.sync_marcas.toArray()).toHaveLength(0);
    expect(await db.productos.toArray()).toHaveLength(0);
  });
});