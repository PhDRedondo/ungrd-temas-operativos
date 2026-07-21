import type { AppRole } from "@/themes/shared/types";

export const APP_ROLES: AppRole[] = [
  "captura",
  "analista",
  "admin",
  "auditor",
];

export function canWrite(role: AppRole | string | undefined): boolean {
  return role === "captura" || role === "admin";
}

export function canRead(role: AppRole | string | undefined): boolean {
  return (
    role === "captura" ||
    role === "analista" ||
    role === "admin" ||
    role === "auditor"
  );
}

export function canAdmin(role: AppRole | string | undefined): boolean {
  return role === "admin";
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
  if (roles.includes("captura")) return "captura";
  if (roles.includes("auditor")) return "auditor";
  return "analista";
}
