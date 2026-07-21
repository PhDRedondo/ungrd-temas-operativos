import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import Credentials from "next-auth/providers/credentials";
import { extractKeycloakRoles, pickPrimaryRole } from "@/lib/auth/roles";
import type { AppRole } from "@/themes/shared/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      role: AppRole;
      roles: AppRole[];
    };
    accessToken?: string;
  }

  interface User {
    role?: AppRole;
    roles?: AppRole[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
    roles?: AppRole[];
    accessToken?: string;
    sub?: string;
  }
}

const authMode = process.env.AUTH_MODE || "demo";

const providers = [];

if (authMode === "keycloak") {
  providers.push(
    Keycloak({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
    }),
  );
} else {
  // Modo demo local (sin Keycloak): útil hasta levantar Docker.
  providers.push(
    Credentials({
      name: "Demo UNGRD",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
        role: { label: "Rol", type: "text" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").trim();
        const password = String(credentials?.password || "");
        if (!email || password.length < 4) {
          try {
            const { headers } = await import("next/headers");
            const { registerAuthFailure } = await import("@/lib/security");
            const h = await headers();
            const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
            const ip =
              h.get("cf-connecting-ip")?.trim() ||
              h.get("x-real-ip")?.trim() ||
              fwd ||
              "127.0.0.1";
            registerAuthFailure(ip);
          } catch {
            /* ignore */
          }
          return null;
        }
        const requested = String(credentials?.role || "captura") as AppRole;
        const role: AppRole = [
          "captura",
          "analista",
          "admin",
          "auditor",
        ].includes(requested)
          ? requested
          : "captura";
        return {
          id: `demo:${email}`,
          email,
          name:
            email.split("@")[0]?.replace(/[._]/g, " ") || "Usuario UNGRD",
          role,
          roles: [role],
        };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role || "analista";
        token.roles = user.roles || [token.role];
      }
      if (account?.provider === "keycloak" && profile) {
        const roles = extractKeycloakRoles(profile as Record<string, unknown>);
        const role = pickPrimaryRole(roles.length ? roles : ["analista"]);
        token.roles = roles.length ? roles : [role];
        token.role = role;
        token.accessToken = account.access_token;
        if (profile.sub) token.sub = String(profile.sub);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.sub || "");
        session.user.role = (token.role as AppRole) || "analista";
        session.user.roles = (token.roles as AppRole[]) || [
          session.user.role,
        ];
      }
      session.accessToken = token.accessToken;
      return session;
    },
  },
  trustHost: true,
  secret: process.env.AUTH_SECRET || "ungrd-dev-secret-change-me",
});
