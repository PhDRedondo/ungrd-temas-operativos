/**
 * Harness — shared helpers
 */
export const BASE =
  process.env.HARNESS_BASE ||
  process.env.SMOKE_BASE ||
  "http://127.0.0.1:3000";

export type Jar = Map<string, string>;

export function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

export function parseSetCookie(headers: Headers, jar: Jar) {
  const raw =
    typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  for (const line of raw) {
    const [pair] = line.split(";");
    const eq = pair!.indexOf("=");
    if (eq > 0) jar.set(pair!.slice(0, eq), pair!.slice(eq + 1));
  }
  if (raw.length === 0) {
    const single = headers.get("set-cookie");
    if (single) {
      const [pair] = single.split(";");
      const eq = pair!.indexOf("=");
      if (eq > 0) jar.set(pair!.slice(0, eq), pair!.slice(eq + 1));
    }
  }
}

export function cookieHeader(jar: Jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

export async function req(
  jar: Jar,
  urlPath: string,
  init: RequestInit = {},
): Promise<{ res: Response; json?: unknown; text?: string }> {
  const headers = new Headers(init.headers || {});
  if (jar.size) headers.set("cookie", cookieHeader(jar));
  const res = await fetch(`${BASE}${urlPath}`, {
    ...init,
    headers,
    redirect: init.redirect ?? "manual",
  });
  parseSetCookie(res.headers, jar);
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return { res, json: await res.json() };
  }
  return { res, text: await res.text() };
}

export async function loginDemo(
  jar: Jar,
  role = "captura",
): Promise<{ email: string; role: string }> {
  const { res, json } = await req(jar, "/api/auth/csrf");
  assert(res.ok, `csrf ${res.status}`);
  const csrf = (json as { csrfToken: string }).csrfToken;
  const body = new URLSearchParams({
    csrfToken: csrf,
    email: "harness@ungrd.gov.co",
    password: "ungrd2026",
    role,
    callbackUrl: "/app",
    json: "true",
  });
  await req(jar, "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const session = await req(jar, "/api/auth/session");
  const user = (session.json as { user?: { email?: string; role?: string } })
    ?.user;
  assert(user?.email, `sesión: ${JSON.stringify(session.json)}`);
  return { email: user.email!, role: user.role || role };
}

export function ok(label: string) {
  console.log(`  ✓ ${label}`);
}

export function section(title: string) {
  console.log(`\n▸ ${title}`);
}
