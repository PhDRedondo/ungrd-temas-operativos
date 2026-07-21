"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { THEMES } from "@/lib/themes";
import { useAuth } from "@/lib/auth";
import { canAdmin } from "@/lib/auth/roles";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type AccessEntry = {
  themeId: string;
  canRead: boolean;
  canWrite: boolean;
};

export default function PermisosPage() {
  const { role } = useAuth();
  const isAdmin = canAdmin(role || undefined);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [access, setAccess] = useState<AccessEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(
    () => users.find((u) => u.id === selectedUserId),
    [users, selectedUserId],
  );

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/admin/access");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Sin acceso admin");
      return;
    }
    setUsers(data.users || []);
    if (!selectedUserId && data.users?.[0]) {
      setSelectedUserId(data.users[0].id);
    }
  }, [selectedUserId]);

  const loadAccess = useCallback(async (userId: string) => {
    if (!userId) return;
    const res = await fetch(`/api/admin/access?userId=${userId}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Error");
      return;
    }
    const map = new Map<string, AccessEntry>(
      (data.access as AccessEntry[]).map((a) => [a.themeId, a]),
    );
    setAccess(
      THEMES.map((t) => ({
        themeId: t.id,
        canRead: map.get(t.id)?.canRead ?? false,
        canWrite: map.get(t.id)?.canWrite ?? false,
      })),
    );
  }, []);

  useEffect(() => {
    if (isAdmin) void loadUsers();
  }, [isAdmin, loadUsers]);

  useEffect(() => {
    if (selectedUserId) void loadAccess(selectedUserId);
  }, [selectedUserId, loadAccess]);

  function toggle(themeId: string, key: "canRead" | "canWrite") {
    setAccess((prev) =>
      prev.map((a) => {
        if (a.themeId !== themeId) return a;
        const next = { ...a, [key]: !a[key] };
        if (key === "canWrite" && next.canWrite) next.canRead = true;
        if (key === "canRead" && !next.canRead) next.canWrite = false;
        return next;
      }),
    );
  }

  async function save() {
    if (!selectedUserId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const entries = access.filter((a) => a.canRead || a.canWrite);
      const res = await fetch("/api/admin/access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, entries }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      setMessage(
        entries.length
          ? `Permisos guardados (${entries.length} temas).`
          : "ACL vacía: el usuario recupera acceso amplio (modo local).",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  function selectAllWrite() {
    setAccess(
      THEMES.map((t) => ({ themeId: t.id, canRead: true, canWrite: true })),
    );
  }

  function clearAll() {
    setAccess(
      THEMES.map((t) => ({ themeId: t.id, canRead: false, canWrite: false })),
    );
  }

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-950">
        Esta pantalla requiere rol <strong>admin</strong>. En login demo,
        elija el rol admin.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-ungrd-heading">
          Permisos por tema
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ungrd-muted">
          Asigne qué temas puede leer/escribir cada usuario. Si un usuario no
          tiene ACL, en local ve todos los temas (según su rol). Con{" "}
          <code className="rounded bg-ungrd-bg px-1">ACL_STRICT=true</code> sin
          ACL = sin acceso.
        </p>
      </div>

      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-ungrd-success">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-ungrd-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm font-semibold text-ungrd-heading">
          Usuario
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="mt-1.5 block min-w-[260px] rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2.5 text-sm"
          >
            {users.length === 0 && (
              <option value="">(Aún no hay usuarios en BD — inicie sesión primero)</option>
            )}
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email} · {u.role}
              </option>
            ))}
          </select>
        </label>
        {selected && (
          <p className="pb-2 text-sm text-ungrd-muted">
            {selected.name} ({selected.role})
          </p>
        )}
        <button
          type="button"
          onClick={selectAllWrite}
          className="rounded-lg border border-ungrd-border px-3 py-2 text-sm font-bold"
        >
          Todos escritura
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="rounded-lg border border-ungrd-border px-3 py-2 text-sm font-bold"
        >
          Limpiar ACL
        </button>
        <button
          type="button"
          disabled={busy || !selectedUserId}
          onClick={() => void save()}
          className="rounded-lg bg-ungrd-yellow px-4 py-2 text-sm font-extrabold text-ungrd-navy-deep disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar permisos"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-ungrd-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-ungrd-bg text-ungrd-heading">
            <tr>
              <th className="px-3 py-2 font-bold">Tema</th>
              <th className="px-3 py-2 font-bold">Lectura</th>
              <th className="px-3 py-2 font-bold">Escritura</th>
            </tr>
          </thead>
          <tbody>
            {access.map((a) => {
              const theme = THEMES.find((t) => t.id === a.themeId);
              return (
                <tr key={a.themeId} className="border-t border-ungrd-border">
                  <td className="px-3 py-2 font-semibold text-ungrd-heading">
                    {theme?.name || a.themeId}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={a.canRead}
                      onChange={() => toggle(a.themeId, "canRead")}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={a.canWrite}
                      onChange={() => toggle(a.themeId, "canWrite")}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
