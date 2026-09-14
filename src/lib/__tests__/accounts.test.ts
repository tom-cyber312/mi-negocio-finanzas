// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  crearCuenta,
  validarLogin,
  getCuentas,
  eliminarCuenta,
  setCuentaActiva,
  getCuentaActiva,
  emailValido,
} from "../accounts";

describe("accounts", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("crearCuenta: primera cuenta usa id default y normaliza email", async () => {
    const c = await crearCuenta("Mi negocio", "  USUARIO@Ejemplo.com ", "clave1234");
    expect(c.id).toBe("default");
    expect(c.email).toBe("usuario@ejemplo.com");
    expect(getCuentas()).toHaveLength(1);
  });

  it("crearCuenta rechaza emails duplicados", async () => {
    await crearCuenta("A", "a@b.com", "clave1234");
    await expect(crearCuenta("B", "A@b.com  ", "otra1234")).rejects.toThrow(/Ya existe/);
  });

  it("validarLogin valida contra el hash", async () => {
    await crearCuenta("A", "a@b.com", "clave1234");
    expect((await validarLogin("a@b.com", "clave1234"))?.id).toBe("default");
    expect(await validarLogin("a@b.com", "mala")).toBeNull();
    expect(await validarLogin("", "")).toBeNull();
  });

  it("eliminarCuenta y cuenta activa", async () => {
    await crearCuenta("A", "a@b.com", "clave1234");
    setCuentaActiva("default");
    expect(getCuentaActiva()?.nombre).toBe("A");
    eliminarCuenta("default");
    expect(getCuentas()).toHaveLength(0);
    expect(getCuentaActiva()).toBeNull();
  });

  it("emailValido", () => {
    expect(emailValido("x@y.com")).toBe(true);
    expect(emailValido("x@y")).toBe(false);
    expect(emailValido("nada")).toBe(false);
  });
});