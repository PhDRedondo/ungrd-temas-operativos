import type { AccountRecord } from "@/lib/accounts";

/** Cuenta segura para respuestas API (nunca incluye password). */
export type PublicAccount = Omit<AccountRecord, "password">;

export function toPublicAccount(account: AccountRecord): PublicAccount {
  const { password: _password, ...rest } = account;
  return rest;
}

export function toPublicAccounts(accounts: AccountRecord[]): PublicAccount[] {
  return accounts.map(toPublicAccount);
}
