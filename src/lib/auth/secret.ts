/**
 * AUTH_SECRET obligatorio en runtime de producción.
 * En desarrollo local se permite un fallback explícito solo-dev.
 * Durante `next build` (NODE_ENV=production) no se lanza error:
 * el secreto real se valida al arrancar el servidor.
 */
export function resolveAuthSecret(): string {
  const fromEnv = process.env.AUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;

  // `next build` evalúa rutas con NODE_ENV=production sin secretos de runtime.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return "build-time-placeholder-not-for-runtime";
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET no está configurado. Genere uno con: openssl rand -base64 32",
    );
  }

  return "ungrd-dev-only-local-not-for-production";
}
