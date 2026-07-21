"use client";

import { UploadsInbox } from "@/components/UploadsInbox";

export default function CargasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-ungrd-heading">
          Cargas masivas
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ungrd-muted">
          Historial de Excel subidos. Descargue el CSV de errores para corregir
          y volver a cargar. Todo queda en PostgreSQL (open source, local).
        </p>
      </div>
      <UploadsInbox />
    </div>
  );
}
