"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { closeSession, hashPassword, isSessionValid, openSession, verifyPasswordHash } from "@/lib/auth";
import {
  actualizarCuenta,
  crearCuenta as crearCuentaRegistrada,
  eliminarCuenta as eliminarCuentaRegistrada,
  getCuentaActiva,
  getCuentaActivaId,
  getCuentas,
  renombrarCuenta as renombrarCuentaRegistrada,
  setCuentaActiva,
  validarLogin,
  type Cuenta,
} from "@/lib/accounts";
import { setCurrency } from "@/lib/format";
import { currencyCode } from "@/lib/format";
import {
  crearClave,
  limpiarClave,
  limpiarSecretosDeCuenta,
} from "@/lib/secureStore";

export type Phase = "loading" | "setup" | "locked" | "open";

interface ThemeContextValue {
  phase: Phase;
  theme: "light" | "dark";
  userInitial: string;
  toggleTheme: () => void;
  currency: string;
  setCurrencyCode: (code: string) => void;
  cuentas: Cuenta[];
  cuentaActiva: Cuenta | null;
  crearCuenta: (nombre: string, email: string, pw: string) => Promise<Cuenta>;
  iniciarSesionCon: (cuentaId: string) => void;
  login: (email: string, pw: string) => Promise<boolean>;
  desbloquearClaves: (pw: string) => Promise<boolean>;
  logout: () => void;
  cambiarCuenta: (cuentaId: string) => void;
  renombrarCuenta: (cuentaId: string, nombre: string) => void;
  eliminarCuenta: (cuentaId: string) => boolean;
  changePassword: (oldPw: string, newPw: string) => Promise<boolean>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("fin_theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [currency, setCurrencyState] = useState("ARS");
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [cuentaActiva, setCuentaActivaState] = useState<Cuenta | null>(null);

  useEffect(() => {
    // Bootstrap de estado client-only tras la hidratación (localStorage/
    // sessionStorage). Requiere sincronizar estado en el efecto por diseño.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(getInitialTheme());
    setCurrencyState(currencyCode());
    const list = getCuentas();
    const act = getCuentaActiva();
    setCuentas(list);
    setCuentaActivaState(act);
    if (list.length === 0) setPhase("setup");
    else if (isSessionValid() && act) setPhase("open");
    else setPhase("locked");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("fin_theme", theme);
    } catch {
      /* noop */
    }
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    []
  );

  const refrescarCuentaActiva = useCallback(() => {
    setCuentaActivaState(getCuentaActiva());
  }, []);

  const crearCuenta = useCallback(
    async (nombre: string, email: string, pw: string): Promise<Cuenta> => {
      const cuenta = await crearCuentaRegistrada(nombre, email, pw);
      setCuentas(getCuentas());
      return cuenta;
    },
    []
  );

  const iniciarSesionCon = useCallback((cuentaId: string) => {
    const cambia = getCuentaActivaId() !== cuentaId;
    setCuentaActiva(cuentaId);
    openSession();
    if (cambia) {
      window.location.reload();
      return;
    }
    refrescarCuentaActiva();
    setPhase("open");
  }, [refrescarCuentaActiva]);

  const login = useCallback(
    async (email: string, pw: string): Promise<boolean> => {
      const cuenta = await validarLogin(email, pw);
      if (!cuenta) return false;
      try {
        await crearClave(pw);
      } catch {
        /* sin WebCrypto: se degrada a token sin cifrado */
      }
      iniciarSesionCon(cuenta.id);
      return true;
    },
    [iniciarSesionCon]
  );

  const desbloquearClaves = useCallback(async (pw: string): Promise<boolean> => {
    const act = getCuentaActiva();
    if (!act) return false;
    const ok = await validarLogin(act.email, pw);
    if (!ok) return false;
    try {
      await crearClave(pw);
    } catch {
      /* noop */
    }
    return true;
  }, []);

  const logout = useCallback(() => {
    closeSession();
    limpiarClave();
    setPhase("locked");
  }, []);

  const cambiarCuenta = useCallback((cuentaId: string) => {
    setCuentaActiva(cuentaId);
    closeSession();
    limpiarClave();
    refrescarCuentaActiva();
    setPhase("locked");
  }, [refrescarCuentaActiva]);

  const renombrarCuenta = useCallback((cuentaId: string, nombre: string) => {
    renombrarCuentaRegistrada(cuentaId, nombre);
    setCuentas(getCuentas());
    refrescarCuentaActiva();
  }, [refrescarCuentaActiva]);

  const eliminarCuenta = useCallback((cuentaId: string): boolean => {
    const rest = eliminarCuentaRegistrada(cuentaId);
    setCuentas(rest);
    limpiarSecretosDeCuenta(cuentaId);
    const eraActiva = getCuentaActivaId() === cuentaId;
    if (eraActiva) {
      closeSession();
      limpiarClave();
      if (rest.length > 0) {
        setCuentaActiva(rest[0].id);
        refrescarCuentaActiva();
        setPhase("locked");
      } else {
        setCuentaActiva(null);
        setCuentaActivaState(null);
        setPhase("setup");
      }
    }
    return eraActiva;
  }, [refrescarCuentaActiva]);

  const changePassword = useCallback(
    async (oldPw: string, newPw: string): Promise<boolean> => {
      const act = getCuentaActiva();
      if (!act) return false;
      const ok = await verifyPasswordHash(oldPw, act.hash);
      if (!ok) return false;
      actualizarCuenta({ ...act, hash: await hashPassword(newPw) });
      limpiarSecretosDeCuenta(act.id);
      limpiarClave();
      refrescarCuentaActiva();
      openSession();
      return true;
    },
    [refrescarCuentaActiva]
  );

  const setCurrencyCode = useCallback((code: string) => {
    setCurrency(code);
    setCurrencyState(code);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      phase,
      theme,
      userInitial: (cuentaActiva?.nombre?.trim().charAt(0) || "N").toUpperCase(),
      toggleTheme,
      currency,
      setCurrencyCode,
      cuentas,
      cuentaActiva,
      crearCuenta,
      iniciarSesionCon,
      login,
      desbloquearClaves,
      logout,
      cambiarCuenta,
      renombrarCuenta,
      eliminarCuenta,
      changePassword,
    }),
    [
      phase,
      theme,
      currency,
      cuentas,
      cuentaActiva,
      toggleTheme,
      setCurrencyCode,
      crearCuenta,
      iniciarSesionCon,
      login,
      desbloquearClaves,
      logout,
      cambiarCuenta,
      renombrarCuenta,
      eliminarCuenta,
      changePassword,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useApp(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useApp debe usarse dentro de AppProvider");
  return ctx;
}