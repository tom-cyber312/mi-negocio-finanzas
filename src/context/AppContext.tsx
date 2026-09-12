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
import {
  changePassword as changePwd,
  closeSession,
  createPassword as createPwd,
  hasPassword,
  isSessionValid,
  openSession,
  verifyPassword,
} from "@/lib/auth";
import { setCurrency } from "@/lib/format";

export type Phase = "loading" | "setup" | "locked" | "open";

interface ThemeContextValue {
  phase: Phase;
  theme: "light" | "dark";
  userInitial: string;
  toggleTheme: () => void;
  createPassword: (pw: string) => Promise<void>;
  login: (pw: string) => Promise<boolean>;
  logout: () => void;
  changePassword: (oldPw: string, newPw: string) => Promise<boolean>;
  currency: string;
  setCurrencyCode: (code: string) => void;
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

  useEffect(() => {
    // Bootstrap de estado client-only tras la hidratación (localStorage/
    // sessionStorage). Requiere sincronizar estado en el efecto por diseño.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(getInitialTheme());
    setCurrencyState(localStorage.getItem("fin_settings_currency") || "ARS");
    if (!hasPassword()) setPhase("setup");
    else if (isSessionValid()) setPhase("open");
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

  const createPassword = useCallback(async (pw: string) => {
    await createPwd(pw);
    setPhase("open");
  }, []);

  const login = useCallback(async (pw: string): Promise<boolean> => {
    const ok = await verifyPassword(pw);
    if (ok) {
      openSession();
      setPhase("open");
    }
    return ok;
  }, []);

  const logout = useCallback(() => {
    closeSession();
    setPhase("locked");
  }, []);

  const changePassword = useCallback(
    async (oldPw: string, newPw: string): Promise<boolean> => {
      const ok = await changePwd(oldPw, newPw);
      if (ok) openSession();
      return ok;
    },
    []
  );

  const setCurrencyCode = useCallback((code: string) => {
    setCurrency(code);
    setCurrencyState(code);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      phase,
      theme,
      userInitial: "N",
      toggleTheme,
      createPassword,
      login,
      logout,
      changePassword,
      currency,
      setCurrencyCode,
    }),
    [
      phase,
      theme,
      toggleTheme,
      createPassword,
      login,
      logout,
      changePassword,
      currency,
      setCurrencyCode,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useApp(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useApp debe usarse dentro de AppProvider");
  return ctx;
}