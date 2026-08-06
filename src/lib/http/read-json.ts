/** Parseo seguro de respuestas fetch (evita "Unexpected end of JSON input"). */
export async function readJson<T = unknown>(
  res: Response,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const raw = await res.text();
  if (!raw.trim()) {
    return {
      ok: false,
      status: res.status,
      error:
        res.status >= 500
          ? `Servidor ${res.status} (respuesta vacía). Suele ser DATABASE_URL / Postgres caído.`
          : `Respuesta vacía (${res.status})`,
    };
  }
  try {
    const data = JSON.parse(raw) as T;
    if (!res.ok) {
      const err =
        data && typeof data === "object" && "error" in data
          ? String((data as { error?: unknown }).error || "")
          : "";
      return {
        ok: false,
        status: res.status,
        error: err || `Error HTTP ${res.status}`,
      };
    }
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      status: res.status,
      error: `JSON inválido del servidor (${res.status})`,
    };
  }
}
