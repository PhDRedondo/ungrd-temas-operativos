import Link from "next/link";
import { THEMES } from "@/lib/themes";
import { ThemeIcon } from "@/components/ThemeIcon";

export default function AppHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-ungrd-heading">
          Panel general
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ungrd-muted">
          Seleccione un tema operativo para capturar información o explorar la
          analítica territorial. Use la visita guiada del menú lateral para un
          recorrido rápido.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {THEMES.map((theme) => (
          <Link
            key={theme.id}
            href={`/app/temas/${theme.id}`}
            className="group rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 transition hover:border-ungrd-navy/30 hover:shadow-[0_12px_30px_rgba(0,45,90,0.08)]"
          >
            <div className="mb-3 inline-flex rounded-lg bg-ungrd-navy p-2 text-ungrd-yellow transition group-hover:bg-ungrd-navy-mid">
              <ThemeIcon name={theme.icon} className="h-5 w-5" />
            </div>
            <h2 className="font-extrabold text-ungrd-heading">{theme.name}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-ungrd-muted">
              {theme.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
