"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, RotateCcw, XCircle, RefreshCw } from "lucide-react";

type Task = {
  id: string;
  caseId: string;
  title: string;
  taskType: string;
  stepCode: string;
  status: string;
  assigneeRole?: string | null;
  dueAt?: string | null;
  createdAt: string;
};

export function TasksInbox() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/me/tasks");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar");
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(
    taskId: string,
    action: "approve" | "return" | "reject",
    findings?: Task["id"][],
  ) {
    setBusy(taskId);
    try {
      const body: Record<string, unknown> = { action };
      if (action === "return") {
        body.findings = [
          {
            fieldCode: "placa",
            severity: "MEDIUM",
            observation: "Verificar placa y documento soporte",
          },
        ];
      }
      const res = await fetch(`/api/v1/tasks/${taskId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ungrd-heading">
            Bandeja central de tareas
          </h1>
          <p className="mt-1 text-sm text-ungrd-muted">
            Revisiones, aprobaciones y correcciones pendientes — una sola entrada.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-ungrd-border px-3 py-2 text-sm font-bold"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-ungrd-danger">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-ungrd-muted">Cargando tareas…</p>
      ) : tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ungrd-border px-6 py-12 text-center text-sm text-ungrd-muted">
          No hay tareas pendientes para su rol.
        </p>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => (
            <article
              key={t.id}
              className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-ungrd-muted">
                    {t.taskType} · {t.stepCode}
                  </p>
                  <h2 className="text-lg font-extrabold text-ungrd-heading">
                    {t.title}
                  </h2>
                  <p className="mt-1 text-sm text-ungrd-muted">
                    Caso{" "}
                    <Link
                      href={`/app/casos/${t.caseId}`}
                      className="font-bold text-ungrd-navy underline"
                    >
                      {t.caseId.slice(0, 8)}…
                    </Link>
                    {t.dueAt && (
                      <> · vence {new Date(t.dueAt).toLocaleDateString("es-CO")}</>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy === t.id}
                    onClick={() => void act(t.id, "approve")}
                    className="inline-flex items-center gap-1 rounded-lg bg-ungrd-navy px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Aprobar
                  </button>
                  <button
                    type="button"
                    disabled={busy === t.id}
                    onClick={() => void act(t.id, "return")}
                    className="inline-flex items-center gap-1 rounded-lg border border-ungrd-border px-3 py-2 text-xs font-bold"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Devolver
                  </button>
                  <button
                    type="button"
                    disabled={busy === t.id}
                    onClick={() => void act(t.id, "reject")}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-ungrd-danger"
                  >
                    <XCircle className="h-4 w-4" />
                    Rechazar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
