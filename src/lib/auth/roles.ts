import type { AppRole } from "@/themes/shared/types";

export const APP_ROLES: AppRole[] = [
  "admin",
  "subdirector",
  "coordinador",
  "operativo",
];

/** Roles asignables al crear/editar cuentas (sin admin). */
export const ASSIGNABLE_ROLES: Exclude<AppRole, "admin">[] = [
  "subdirector",
  "coordinador",
  "operativo",
];

export function canWrite(role: AppRole | string | undefined): boolean {
  return (
    role === "operativo" ||
    role === "coordinador" ||
    role === "subdirector" ||
    role === "admin"
  );
}

export function canRead(role: AppRole | string | undefined): boolean {
  return (
    role === "operativo" ||
    role === "coordinador" ||
    role === "subdirector" ||
    role === "admin"
  );
}

export function canAdmin(role: AppRole | string | undefined): boolean {
  return role === "admin";
}

/** Subdirector ve todos los temas (bypass ACL de lectura). */
export function canBypassThemeAcl(role: AppRole | string | undefined): boolean {
  return role === "admin" || role === "subdirector";
}

/** Extrae roles de realm/client desde el token Keycloak. */
export function extractKeycloakRoles(profile: Record<string, unknown>): AppRole[] {
  const realmAccess = profile.realm_access as { roles?: string[] } | undefined;
  const resourceAccess = profile.resource_access as
    | Record<string, { roles?: string[] }>
    | undefined;

  const clientId = process.env.KEYCLOAK_CLIENT_ID || "ungrd-app";
  const fromRealm = realmAccess?.roles ?? [];
  const fromClient = resourceAccess?.[clientId]?.roles ?? [];
  const all = new Set([...fromRealm, ...fromClient]);

  return APP_ROLES.filter((r) => all.has(r));
}

export function pickPrimaryRole(roles: AppRole[]): AppRole {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("subdirector")) return "subdirector";
  if (roles.includes("coordinador")) return "coordinador";
  return "operativo";
}
