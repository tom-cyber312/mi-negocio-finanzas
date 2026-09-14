// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  openSession,
  closeSession,
  isSessionValid,
  hashPassword,
  verifyPasswordHash,
  sha256Hex,
  esHashLegacy,
} from "../auth";

describe("auth", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("hashPassword/verifyPasswordHash roundtrip", async () => {
    const hash = await hashPassword("miClaveSegura123");
    expect(hash.startsWith("pbkdf2:250000:")).toBe(true);
    expect(await verifyPasswordHash("miClaveSegura123", hash)).toBe(true);
    expect(await verifyPasswordHash("otraClave", hash)).toBe(false);
    expect(esHashLegacy(hash)).toBe(false);
  });

  it("verifyPasswordHash acepta hashes legacy sha256:salt", async () => {
    const salt = "sal";
    const legacy = `${await sha256Hex("sal" + "pass")}:${salt}`;
    expect(esHashLegacy(legacy)).toBe(true);
    expect(await verifyPasswordHash("pass", legacy)).toBe(true);
    expect(await verifyPasswordHash("nope", legacy)).toBe(false);
    expect(await verifyPasswordHash("x", "")).toBe(false);
    expect(await verifyPasswordHash("x", "solo_hash_sin_formato")).toBe(false);
  });

  it("sesión: abre, valida y cierra", () => {
    expect(isSessionValid()).toBe(false);
    openSession();
    expect(isSessionValid()).toBe(true);
    closeSession();
    expect(isSessionValid()).toBe(false);
  });
});