// Generación de claves de licencia Pro para Mi Negocio — Finanzas.
//
// Uso (correr en la máquina del vendedor, NUNCA compartir la llave privada):
//   node scripts/generarLicencia.mjs nombre@correo.com 12
//
// - La primera ejecución crea scripts/license-key.pem (privada) y
//   scripts/license-pub.pem (pública) si no existen.
// - Dejá `license-key.pem` SOLO en tu máquina; está ignorada por git (*.pem).
// - La clave pública va embebida en src/lib/license.ts del cliente.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PRIV = path.join(DIR, "license-key.pem");
const PUB = path.join(DIR, "license-pub.pem");

const PRE = "MNBG";
const VER = "1";

function asegurarLlaves() {
  if (fs.existsSync(PRIV)) return;
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicExponent: 0x10001,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  fs.writeFileSync(PRIV, privateKey.trim() + "\n");
  fs.writeFileSync(PUB, publicKey.trim() + "\n");
  console.log("✏️  Llaves generadas:");
  console.log("   Privada : scripts/license-key.pem (guardala, NO la subas)");
  console.log("   Pública : scripts/license-pub.pem");
}

function b64(bufOrStr) {
  const base = Buffer.from(bufOrStr).toString("base64");
  return base.replace(/=+$/, "");
}

function parClaves() {
  const privPem = fs.readFileSync(PRIV, "utf8");
  const pubB64 = fs
    .readFileSync(PUB, "utf8")
    .replace(/-----[^-]+-----/g, "")
    .replace(/\s+/g, "");
  return { priv: crypto.createPrivateKey(privPem), pubB64 };
}

export function generarLicencia(email, meses) {
  const { priv, pubB64 } = parClaves();
  const hoyDias = Math.floor(Date.now() / 86400000);
  const expDias = hoyDias + Math.max(1, Math.round(meses * 30.44));
  const payload = {
    p: "pro",
    e: email.trim().toLowerCase(),
    x: expDias,
    s: crypto.randomBytes(4).toString("hex"),
  };
  const B = b64(Buffer.from(JSON.stringify(payload)));
  const msg = `${PRE}-${VER}|${B}`;
  const sig = crypto.sign("sha256", Buffer.from(msg), {
    key: priv,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: 32,
  });
  return {
    clave: `${PRE}-${B}-${b64(sig)}`,
    expIso: new Date(expDias * 86400000).toISOString().slice(0, 10),
    email: payload.e,
    pubB64,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  asegurarLlaves();
  const email = (process.argv[2] || "").trim();
  const meses = Number(process.argv[3] || "12");
  if (!email) {
    console.error("Uso: node scripts/generarLicencia.mjs nombre@correo.com [meses]");
    process.exit(1);
  }
  const { clave, expIso, email: em, pubB64 } = generarLicencia(email, meses);
  console.log("Clave SPKI pública (base64) para src/lib/license.ts:");
  console.log(pubB64);
  console.log("--------------------------------------------------");
  console.log(`Licencia para ${em} (vigente hasta ${expIso}):`);
  console.log(clave);
  console.log("--------------------------------------------------");
  console.log("Activación: la ingresa el cliente en el plan Pro de Ajustes.");
  console.log("Verificación: se hace en el navegador con la clave pública.");
}