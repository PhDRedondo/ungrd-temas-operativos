import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import Credentials from "next-auth/providers/credentials";
import { extractKeycloakRoles, pickPrimaryRole } from "@/lib/auth/roles";
import {
  normalizeAccountRole,
  resolveLoginEmail,
  type AccountRole,
} from "@/lib/accounts";
import {
  findAccountOnServer,
  upgradePasswordHashIfNeeded,
} from "@/lib/accountsServer";
import { resolveAuthSecret } from "@/lib/auth/secret";
import { verifyPassword } from "@/lib/password";
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

function asAppRole(role: AccountRole | string | undefined): AppRole {
  return normalizeAccountRole(role);
}

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
  providers.push(
    Credentials({
      name: "UNGRD",
      credentials: {
        email: { label: "Usuario o correo", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email = resolveLoginEmail(
          String(credentials?.email || "").normalize("NFKC"),
        );
        const password = String(credentials?.password || "")
          .normalize("NFKC")
          .trim();
        const account = findAccountOnServer(email);

        const ok =
          Boolean(account?.active) &&
          email.length > 0 &&
          password.length > 0 &&
          verifyPassword(password, account!.password);

        if (!ok) {
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

        upgradePasswordHashIfNeeded(account!.email, password);

        const role = asAppRole(account!.role);
        return {
          id: `demo:${account!.email}`,
          email: account!.email,
          name: account!.name,
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
        token.role = asAppRole(user.role || "operativo");
        token.roles = (user.roles || [token.role]).map((r) => asAppRole(r));
      } else if (token.role) {
        // Sesiones JWT antiguas (captura/analista/auditor) → roles actuales
        token.role = asAppRole(token.role);
        token.roles = (token.roles || [token.role]).map((r) => asAppRole(r));
      }
      if (account?.provider === "keycloak" && profile) {
        const roles = extractKeycloakRoles(profile as Record<string, unknown>);
        const role = pickPrimaryRole(roles.length ? roles : ["operativo"]);
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
        session.user.role = asAppRole(token.role || "operativo");
        session.user.roles = ((token.roles as AppRole[]) || [
          session.user.role,
        ]).map((r) => asAppRole(r));
      }
      session.accessToken = token.accessToken;
      return session;
    },
  },
  trustHost: true,
  secret: resolveAuthSecret(),
});
