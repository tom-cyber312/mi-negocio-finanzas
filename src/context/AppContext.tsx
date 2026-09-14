"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  aplicarBarraDeEstado,
  inicializarNativo,
  sintonizarPersistenciaNativa,
} from "@/lib/capacitor";
import { closeSession, esHashLegacy, hashPassword, isSessionValid, openSession, verifyPasswordHash } from "@/lib/auth";
import {
  actualizarCuenta,
  crearCuenta as crearCuentaRegistrada,
  eliminarCuenta as eliminarCuentaRegistrada,
  getCuentaActiva,
  getCuentaActivaId,
  getCuentas,
  reemplazarCuentas,
  renombrarCuenta as renombrarCuentaRegistrada,
  setCuentaActiva,
  validarLogin,
  type Cuenta,
} from "@/lib/accounts";
import {
  cambiarClaveNube,
  eliminarCuentaNube,
  haySesionNube,
  listarCuentasNube,
  loginNube,
  registrarNube,
  renombrarCuentaNube,
  salirNube,
  supabaseConfigurado,
} from "@/lib/supabase";
import { sincronizar, type ResultadoSync } from "@/lib/sync";
import { setCurrency } from "@/lib/format";
import { currencyCode } from "@/lib/format";
import {
  crearClave,
  limpiarClave,
  limpiarSecretosDeCuenta,
} from "@/lib/secureStore";

export type Phase = "loading" | "setup" | "locked" | "open";

export interface EstadoSync {
  sincronizando: boolean;
  ultimaSync: ResultadoSync | null;
  error: string | null;
}

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
  syncAhora: () => Promise<void>;
  estadoSync: EstadoSync;
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
  const [estadoSync, setEstadoSync] = useState<EstadoSync>({
    sincronizando: false,
    ultimaSync: null,
    error: null,
  });
  const sincronizadoEnOpen = useRef(false);

  useEffect(() => {
    // Bootstrap de estado client-only tras la hidratación (localStorage/
    // sessionStorage). Requiere sincronizar estado en el efecto por diseño.
    setTheme(getInitialTheme());
    setCurrencyState(currencyCode());
    const list = getCuentas();
    const act = getCuentaActiva();
    setCuentas(list);
    setCuentaActivaState(act);
    if (list.length === 0) setPhase("setup");
    else if (isSessionValid() && act) setPhase("open");
    else setPhase("locked");
    void inicializarNativo();
    void sintonizarPersistenciaNativa();
    void hidratarNube();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hidratarNube = useCallback(async () => {
    if (!supabaseConfigurado()) return;
    try {
      if (!(await haySesionNube())) return;
      const nube = await listarCuentasNube();
      if (nube.length === 0) return;
      reemplazarCuentas(nube);
      const act = getCuentaActiva();
      const activa = nube.find((c) => c.id === act?.id) ?? nube[0];
      setCuentas(nube);
      setCuentaActivaState(activa);
      setCuentaActiva(activa.id);
      if (nube.some((c) => c.id === getCuentaActivaId())) {
        openSession();
        setPhase("open");
      }
    } catch {
      /* sin sesión o sin red: se usa la copia local */
    }
  }, []);

  // Sincronización automática al abrir la app (un vez por apertura).
  useEffect(() => {
    if (phase !== "open" || sincronizadoEnOpen.current) return;
    if (!supabaseConfigurado()) return;
    sincronizadoEnOpen.current = true;
    void ejecutarSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const ejecutarSync = useCallback(async () => {
    setEstadoSync((s) => ({ ...s, sincronizando: true, error: null }));
    try {
      const res = await sincronizar();
      setEstadoSync((s) => ({ ...s, sincronizando: false, ultimaSync: res }));
    } catch (e) {
      setEstadoSync((s) => ({
        ...s,
        sincronizando: false,
        error: e instanceof Error ? e.message : "Error al sincronizar.",
      }));
    }
  }, []);

  const syncAhora = useCallback(async () => {
    await ejecutarSync();
    sincronizadoEnOpen.current = true;
  }, [ejecutarSync]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("fin_theme", theme);
    } catch {
      /* noop */
    }
    void aplicarBarraDeEstado(theme === "dark");
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
      if (supabaseConfigurado()) {
        const nube = await registrarNube(email, pw, nombre);
        reemplazarCuentas(nube);
        const cuenta =
          nube.find((c) => c.email === email.trim().toLowerCase()) ?? nube[0];
        setCuentas(getCuentas());
        return cuenta;
      }
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
      if (supabaseConfigurado()) {
        try {
          const nube = await loginNube(email, pw);
          reemplazarCuentas(nube);
          const cuenta =
            nube.find((c) => c.email === email.trim().toLowerCase()) ?? nube[0];
          setCuentas(getCuentas());
          if (!cuenta) return false;
          try {
            await crearClave(pw);
          } catch {
            /* sin WebCrypto: se degrada a token sin cifrado */
          }
          iniciarSesionCon(cuenta.id);
          return true;
        } catch {
          // Fallback a la cuenta local si Supabase no responde o rechaza.
        }
      }
      const cuenta = await validarLogin(email, pw);
      if (!cuenta) return false;
      // Migración: si el hash es legacy (SHA-256), lo actualizamos a PBKDF2.
      if (esHashLegacy(cuenta.hash)) {
        const hash = await hashPassword(pw);
        actualizarCuenta({ ...cuenta, hash });
        setCuentas(getCuentas());
        refrescarCuentaActiva();
      }
      try {
        await crearClave(pw);
      } catch {
        /* sin WebCrypto: se degrada a token sin cifrado */
      }
      iniciarSesionCon(cuenta.id);
      return true;
    },
    [iniciarSesionCon, refrescarCuentaActiva]
  );

  const desbloquearClaves = useCallback(async (pw: string): Promise<boolean> => {
    const act = getCuentaActiva();
    if (!act) return false;
    if (act.hash === "cloud") {
      if (!supabaseConfigurado()) return false;
      const ok = await loginNube(act.email, pw)
        .then(() => true)
        .catch(() => false);
      if (!ok) return false;
      try {
        await crearClave(pw);
      } catch {
        /* noop */
      }
      return true;
    }
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
    sincronizadoEnOpen.current = false;
    setEstadoSync({ sincronizando: false, ultimaSync: null, error: null });
    setPhase("locked");
    void salirNube();
  }, []);

  const cambiarCuenta = useCallback((cuentaId: string) => {
    setCuentaActiva(cuentaId);
    closeSession();
    limpiarClave();
    refrescarCuentaActiva();
    setPhase("locked");
  }, [refrescarCuentaActiva]);

  const renombrarCuenta = useCallback((cuentaId: string, nombre: string) => {
    const esNube = getCuentas().find((c) => c.id === cuentaId)?.hash === "cloud";
    if (esNube && supabaseConfigurado()) {
      renombrarCuentaNube(cuentaId, nombre).then(
        () => undefined,
        () => undefined
      );
    }
    renombrarCuentaRegistrada(cuentaId, nombre);
    setCuentas(getCuentas());
    refrescarCuentaActiva();
  }, [refrescarCuentaActiva]);

  const eliminarCuenta = useCallback((cuentaId: string): boolean => {
    const esNube = getCuentas().find((c) => c.id === cuentaId)?.hash === "cloud";
    if (esNube && supabaseConfigurado()) {
      eliminarCuentaNube(cuentaId).then(
        () => undefined,
        () => undefined
      );
    }
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
      if (act.hash === "cloud" && supabaseConfigurado()) {
        const ok = await loginNube(act.email, oldPw)
          .then(() => true)
          .catch(() => false);
        if (!ok) return false;
        await cambiarClaveNube(newPw);
        limpiarSecretosDeCuenta(act.id);
        limpiarClave();
        refrescarCuentaActiva();
        openSession();
        return true;
      }
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
      syncAhora,
      estadoSync,
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
      syncAhora,
      estadoSync,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useApp(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useApp debe usarse dentro de AppProvider");
  return ctx;
}