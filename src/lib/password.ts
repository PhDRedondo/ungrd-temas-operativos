import { compareSync, hashSync } from "bcryptjs";

const BCRYPT_ROUNDS = 10;

/** Detecta hashes bcrypt ($2a$ / $2b$ / $2y$). */
export function isPasswordHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

/** Hash seguro para persistencia. No usar en el cliente para seeds demo si no hace falta. */
export function hashPassword(plain: string): string {
  return hashSync(plain, BCRYPT_ROUNDS);
}

/**
 * Verifica contraseña contra hash bcrypt o texto plano legado.
 * Compatibilidad: no invalida cuentas existentes al desplegar.
 */
export function verifyPassword(plain: string, stored: string): boolean {
  if (!plain || !stored) return false;
  if (isPasswordHash(stored)) {
    try {
      return compareSync(plain, stored);
    } catch {
      return false;
    }
  }
  return plain === stored;
}

/** Si el valor aún es texto plano, lo hashea; si ya es hash, lo deja. */
export function ensurePasswordHashed(value: string): string {
  if (!value) return value;
  if (isPasswordHash(value)) return value;
  return hashPassword(value);
}
