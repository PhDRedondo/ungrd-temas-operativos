"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { SessionProvider, signIn, signOut, useSession } from "next-auth/react";
import type { AppRole } from "@/themes/shared/types";

type User = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
};

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  role: AppRole | null;
  login: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string; redirectTo?: string }>;
  loginWithKeycloak: () => Promise<void>;
  logout: () => Promise<void>;
  authMode: "demo" | "keycloak";
};

const AuthContext = createContext<AuthContextValue | null>(null);

const authMode =
  (process.env.NEXT_PUBLIC_AUTH_MODE as "demo" | "keycloak") || "demo";

function AuthBridge({ children }: { children: ReactNode }) {
  const { data, status } = useSession();

  const value = useMemo<AuthContextValue>(() => {
    const ready = status !== "loading";
    const user: User | null = data?.user
      ? {
          id: data.user.id,
          name: data.user.name || "Usuario UNGRD",
          email: data.user.email || "",
          role: data.user.role || "analista",
        }
      : null;

    return {
      user,
      ready,
      role: user?.role ?? null,
      authMode,
      async login(email, password) {
        if (authMode === "keycloak") {
          await signIn("keycloak", { callbackUrl: "/app" });
          return { ok: true };
        }
        const res = await signIn("credentials", {
          email: email.trim(),
          password,
          redirect: false,
          callbackUrl: "/app",
        });
        if (!res || res.error || res.ok === false) {
          return {
            ok: false,
            error: "Correo o contraseña incorrectos.",
          };
        }
        return { ok: true, redirectTo: res.url || "/app" };
      },
      async loginWithKeycloak() {
        await signIn("keycloak", { callbackUrl: "/app" });
      },
      async logout() {
        await signOut({ callbackUrl: "/" });
      },
    };
  }, [data, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthBridge>{children}</AuthBridge>
    </SessionProvider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
