import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Cuenta } from "./accounts";

export interface CuentaNube {
  id: string;
  usuario_id: string;
  nombre: string;
  email: string;
  created_at: string;
}

function leerEnv(): { url: string; key: string } | null {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    (typeof window !== "undefined"
      ? (window as { __SUPABASE_URL__?: string }).__SUPABASE_URL__
      : undefined);
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    (typeof window !== "undefined"
      ? (window as { __SUPABASE_ANON_KEY__?: string }).__SUPABASE_ANON_KEY__
      : undefined);
  if (!url || !key) return null;
  return { url, key };
}

let _supabase: SupabaseClient | null = null;

/** true solo si el proyecto tiene Supabase configurado (env). */
export function supabaseConfigurado(): boolean {
  return leerEnv() !== null;
}

/** Cliente del navegador (anon). null si no hay configuración. */
export function supabase(): SupabaseClient | null {
  if (!supabaseConfigurado()) return null;
  const env = leerEnv()!;
  if (!_supabase) {
    _supabase = createClient(env.url, env.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return _supabase;
}

/** Convierte una cuenta de la nube al formato local de la app. */
export function cuentaNubeALocal(c: CuentaNube): Cuenta {
  return {
    id: c.id,
    nombre: c.nombre,
    email: c.email,
    hash: "cloud", // con Supabase la verificación la hace el servidor de auth
    createdAt: new Date(c.created_at).getTime(),
  };
}

export async function loginNube(
  email: string,
  password: string
): Promise<Cuenta[]> {
  const client = supabase();
  if (!client) throw new Error("Supabase no está configurado.");
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(traduciError(error.message));
  return listarCuentasNube();
}

export async function registrarNube(
  email: string,
  password: string,
  nombre: string
): Promise<Cuenta[]> {
  const client = supabase();
  if (!client) throw new Error("Supabase no está configurado.");
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw new Error(traduciError(error.message));
  const uid = data.user?.id;
  if (!uid) throw new Error("No se pudo crear la cuenta en la nube.");
  const { error: errCta } = await client.from("cuentas").insert({
    id: "default",
    usuario_id: uid,
    nombre,
    email,
  });
  if (errCta) throw new Error(traduciError(errCta.message));
  return listarCuentasNube();
}

export async function listarCuentasNube(): Promise<Cuenta[]> {
  const client = supabase();
  if (!client) return [];
  const { data, error } = await client
    .from("cuentas")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(traduciError(error.message));
  return ((data as CuentaNube[]) || []).map(cuentaNubeALocal);
}

/** true si la sesión de Supabase autenticada sigue vigente (se auto-refresca). */
export async function haySesionNube(): Promise<boolean> {
  const client = supabase();
  if (!client) return false;
  const { data } = await client.auth.getSession();
  return Boolean(data.session);
}

export async function renombrarCuentaNube(id: string, nombre: string): Promise<void> {
  const client = supabase();
  if (!client) return;
  const { error } = await client
    .from("cuentas")
    .update({ nombre: nombre.trim() || "Mi negocio" })
    .eq("id", id);
  if (error) throw new Error(traduciError(error.message));
}

export async function eliminarCuentaNube(id: string): Promise<void> {
  const client = supabase();
  if (!client) return;
  const { error } = await client.from("cuentas").delete().eq("id", id);
  if (error) throw new Error(traduciError(error.message));
}

export async function cambiarClaveNube(nueva: string): Promise<void> {
  const client = supabase();
  if (!client) return;
  const { error } = await client.auth.updateUser({ password: nueva });
  if (error) throw new Error(traduciError(error.message));
}

export async function salirNube(): Promise<void> {
  await supabase()?.auth.signOut();
}

export function traducirError(msg: string): string {
  return traduciError(msg);
}

function traduciError(msg: string): string {
  const m = (msg || "").toLowerCase();
  if (m.includes("invalid login credentials"))
    return "Correo o contraseña incorrectos.";
  if (m.includes("email not confirmed"))
    return "Confirmá el correo desde el link que te enviamos.";
  if (m.includes("already registered"))
    return "Ya existe una cuenta con ese correo.";
  if (m.includes("password should be at least"))
    return "La contraseña debe tener al menos 6 caracteres.";
  if (m.includes("rate limit"))
    return "Demasiados intentos. Esperá unos minutos y volvé a intentar.";
  return msg || "Error inesperado. Intentá de nuevo.";
}