// Licencia Pro: la clave es firmada offline (scripts/generarLicencia.mjs)
// con una llave RSA privada que queda solo en manos del vendedor. La app
// verifica la firma con la clave pública embebida (RSA-PSS / SHA-256).
import { getCuentaActivaId } from "./accounts";

const PRE = "MNBG";
const VER = "1";

// Clave pública SPKI (DER en base64) generada con scripts/generarLicencia.mjs
const PUB_SPKI_B64 =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAn1djeWea2MMg66gA50vNyo97oA23umTE51shh6NqToN1rPgP8y1mCZTO7TVbjSJAF442oMlood4aSL1r0SHux57fcXZaCjSbGtL3AQPU2bpf18q5vMH2QDSujbxC2t2+pU9/1wNsdVa+3KZpy4OBiCw+kvCUsHXDG2t22FqcUD0lXDI9J7WB9rkVOFoaBH8CVOHEBfBhlWngHMNbxITKtly3MIen71bFB5JfXBM2b+ZtGmFSWy+Qi/HXlDtXMgrvc9arEybpnBUdTPQNTbRmPqzNFFHfYLcVI0In7tRGyysYcz3HMvr0hru2+l3cWcbyT4omCQ/B3iRWUP6KsJTG1wIDAQAB";

export interface LicenciaPro {
  email: string;
  expDias: number;
  expIso: string;
  activada: number;
}

function keyFor(id: string): string {
  return `fin_pro_lic_${id}`;
}

function hoyDias(): number {
  return Math.floor(Date.now() / 86400000);
}

function b64uABase64(b: string): string {
  const pad = b.length % 4 === 0 ? "" : "=".repeat(4 - (b.length % 4));
  return b.replace(/-/g, "+").replace(/_/g, "/") + pad;
}

function decodificar(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64uABase64(b64));
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

let _pub: CryptoKey | null = null;

async function importarClavePublica(): Promise<CryptoKey> {
  if (!_pub) {
    _pub = await crypto.subtle.importKey(
      "spki",
      decodificar(PUB_SPKI_B64),
      { name: "RSA-PSS", hash: "SHA-256" },
      false,
      ["verify"]
    );
  }
  return _pub;
}

/** Lee la licencia guardada (sin re-verificar la firma). */
export function getProGuardado(): LicenciaPro | null {
  const id = getCuentaActivaId() || "default";
  try {
    const raw = localStorage.getItem(keyFor(id));
    if (!raw) return null;
    const lic = JSON.parse(raw) as LicenciaPro;
    if (
      !lic ||
      typeof lic.email !== "string" ||
      typeof lic.expDias !== "number" ||
      typeof lic.expIso !== "string"
    ) {
      return null;
    }
    return lic;
  } catch {
    return null;
  }
}

export const tienePro = (): boolean => {
  const lic = getProGuardado();
  return !!lic && lic.expDias >= hoyDias();
};

export function desactivarPro(): void {
  const id = getCuentaActivaId() || "default";
  localStorage.removeItem(keyFor(id));
  _pub = null;
}

export async function verificarLicenciaPro(
  clave: string
): Promise<{ ok: boolean; mensaje: string; expIso?: string; email?: string }> {
  const text = (clave || "").trim();
  if (!text) return { ok: false, mensaje: "Ingresá la clave de licencia." };
  const p1 = text.indexOf("-");
  const p2 = text.indexOf("-", p1 + 1);
  if (p1 <= 0 || p2 <= p1 + 1 || text.slice(p1 + 1, p2).length === 0) {
    return { ok: false, mensaje: "El formato de la clave no es válido." };
  }
  const prefijo = text.slice(0, p1);
  const B = text.slice(p1 + 1, p2);
  const S = text.slice(p2 + 1);
  if (prefijo !== PRE || !B || !S) {
    return { ok: false, mensaje: "El formato de la clave no es válido." };
  }
  try {
    const pup = await importarClavePublica();
    const msg = `${PRE}-${VER}|${B}`;
    const ok = await crypto.subtle.verify(
      { name: "RSA-PSS", saltLength: 32 },
      pup,
      decodificar(S),
      new TextEncoder().encode(msg)
    );
    if (!ok) return { ok: false, mensaje: "La clave no es válida para esta app." };
    const payload = JSON.parse(atob(b64uABase64(B))) as {
      p: string;
      e: string;
      x: number;
    };
    if (payload.p !== "pro") {
      return { ok: false, mensaje: "La clave no corresponde a este plan." };
    }
    if (typeof payload.x !== "number" || typeof payload.e !== "string") {
      return { ok: false, mensaje: "La clave está corrupta." };
    }
    if (payload.x < hoyDias()) {
      return { ok: false, mensaje: "Esta licencia está vencida." };
    }
    const lic: LicenciaPro = {
      email: payload.e,
      expDias: payload.x,
      expIso: new Date(payload.x * 86400000).toISOString().slice(0, 10),
      activada: Date.now(),
    };
    const id = getCuentaActivaId() || "default";
    localStorage.setItem(keyFor(id), JSON.stringify(lic));
    return { ok: true, mensaje: "Plan Pro activado correctamente.", email: lic.email, expIso: lic.expIso };
  } catch {
    return { ok: false, mensaje: "No se pudo verificar la clave ahora. Intentá de nuevo." };
  }
}

// re-export para código que importa desde acá
export { VER as VERSION_LICENCIA };