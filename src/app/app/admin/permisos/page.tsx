"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";

/** Redirige al hub unificado de cuentas (pestaña permisos). */
export default function PermisosPageRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/cuentas?tab=permisos");
  }, [router]);

  return (
    <div className="py-16 text-center text-sm text-ungrd-muted">
      Redirigiendo a Cuentas y permisos…
    </div>
  );
}
