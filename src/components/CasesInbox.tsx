"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Send } from "lucide-react";

type CaseRow = {
  id: string;
  caseCode: string;
  title: string;
  status: string;
  caseType: string;
  moduleId?: string | null;
  updatedAt: string;
};

export function CasesInbox() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/v1/cases");
    const data = await res.json();
    if (res.ok) setCases(data.cases || []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createPilot() {
    setCreating(true);
    try {
      const res = await fetch("/api/v1/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseType: "ASSET_REGISTRATION",
          moduleId: "carrotanques",
          title: "Registro carrotanque piloto",
          payload: {
            placa: "ABC123",
            volumen_m3: 10,
            destino: "La Guajira",
            departamento: "La Guajira",
            municipio: "Riohacha",
            modalidad: "Comodato",
            instrument_code: "COM-2026-014",
            valor: 15000000,
          },
        }),
      });
      if (res.ok) await load();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ungrd-heading">Mis casos</h1>
          <p className="mt-1 text-sm text-ungrd-muted">
            Expedientes multidependencia con versiones y workflow.
          </p>
        </div>
        <button
          type="button"
          disabled={creating}
          onClick={() => void createPilot()}
          className="inline-flex items-center gap-2 rounded-lg bg-ungrd-yellow px-4 py-2 text-sm font-extrabold text-ungrd-navy-deep"
        >
          <Plus className="h-4 w-4" />
          Caso piloto carrotanque
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-ungrd-muted">Cargando…</p>
      ) : cases.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-ungrd-muted">
          Sin casos. Cree el piloto para probar el flujo completo.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ungrd-border">
          <table className="min-w-full text-sm">
            <thead className="bg-ungrd-bg text-left text-xs font-bold uppercase text-ungrd-muted">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Acción</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className="border-t border-ungrd-border">
                  <td className="px-4 py-3 font-mono font-bold">{c.caseCode}</td>
                  <td className="px-4 py-3">{c.title}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-ungrd-bg px-2 py-0.5 text-xs font-bold">
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ungrd-muted">{c.caseType}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/app/casos/${c.id}`}
                      className="font-bold text-ungrd-navy underline"
                    >
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CaseDetail({ caseId }: { caseId: string }) {
  const [data, setData] = useState<{
    case: CaseRow;
    versions: unknown[];
    findings: unknown[];
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/v1/cases/${caseId}`);
    const json = await res.json();
    if (res.ok) setData(json);
  }

  useEffect(() => {
    void load();
  }, [caseId]);

  async function submit() {
    setBusy(true);
    try {
      await fetch(`/api/v1/cases/${caseId}/submit`, { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="text-sm text-ungrd-muted">Cargando caso…</p>;

  const c = data.case;

  return (
    <div className="space-y-4">
      <Link href="/app/casos" className="text-sm font-bold text-ungrd-navy">
        ← Mis casos
      </Link>
      <div className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-5">
        <p className="font-mono text-sm font-bold text-ungrd-muted">{c.caseCode}</p>
        <h1 className="text-2xl font-extrabold">{c.title}</h1>
        <p className="mt-2 text-sm">
          Estado: <strong>{c.status}</strong> · Tipo: {c.caseType}
        </p>
        {["DRAFT", "RETURNED", "CORRECTION_IN_PROGRESS"].includes(c.status) && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-ungrd-navy px-4 py-2 text-sm font-bold text-white"
          >
            <Send className="h-4 w-4" />
            Enviar a revisión
          </button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border p-4">
          <h2 className="font-extrabold">Versiones ({data.versions.length})</h2>
          <pre className="mt-2 max-h-48 overflow-auto text-xs">
            {JSON.stringify(data.versions, null, 2)}
          </pre>
        </section>
        <section className="rounded-xl border p-4">
          <h2 className="font-extrabold">Hallazgos ({data.findings.length})</h2>
          <pre className="mt-2 max-h-48 overflow-auto text-xs">
            {JSON.stringify(data.findings, null, 2)}
          </pre>
        </section>
      </div>
    </div>
  );
}
