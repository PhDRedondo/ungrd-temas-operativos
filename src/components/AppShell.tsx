"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FolderOpen,
  Info,
  LogOut,
  Menu,
  Radar,
  Route,
  Shield,
  Upload,
  X,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth";
import { canAdmin } from "@/lib/auth/roles";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeIcon } from "@/components/ThemeIcon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { startGuidedTour } from "@/lib/tour";

const SIDEBAR_KEY = "ungrd-sidebar-collapsed";

type AccessTheme = {
  id: string;
  name: string;
  icon: string;
  canRead: boolean;
  canWrite: boolean;
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, ready, logout, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [themesOpen, setThemesOpen] = useState(true);
  const [themes, setThemes] = useState<AccessTheme[]>([]);

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=/app");
  }, [ready, user, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function loadAccess() {
      try {
        const res = await fetch("/api/me/access");
        const data = await res.json();
        if (!cancelled && res.ok) setThemes(data.themes || []);
      } catch {
        /* ignore */
      }
    }
    void loadAccess();
    return () => {
      cancelled = true;
    };
  }, [user]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ungrd-bg text-ungrd-muted">
        Cargando sesión…
      </div>
    );
  }

  const userEmail = user.email;
  const userName = user.name;
  const admin = canAdmin(role || undefined);

  function renderNav(compact: boolean) {
    const linkClass = (active: boolean) =>
      clsx(
        "group flex items-center rounded-lg text-sm transition",
        compact ? "justify-center px-2 py-2.5" : "gap-2 px-3 py-2",
        active
          ? "bg-ungrd-sidebar-active text-white"
          : "text-[#9db5c8] hover:bg-ungrd-sidebar-hover hover:text-white",
      );

    return (
      <>
        <div
          className={clsx(
            "border-b border-ungrd-sidebar-border",
            compact ? "px-2 py-3" : "px-4 py-4",
          )}
        >
          <div
            className={clsx(
              "flex items-center",
              compact ? "justify-center" : "gap-3",
            )}
          >
            <BrandLogo
              width={compact ? 44 : 100}
              height={compact ? 52 : 120}
              className={clsx(
                "object-contain",
                compact ? "h-10 w-10" : "h-14 w-auto",
              )}
            />
            {!compact && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  Temas operativos
                </p>
                <p className="truncate text-[10px] uppercase tracking-wide text-ungrd-yellow">
                  {role}
                </p>
              </div>
            )}
          </div>
        </div>

        <nav
          className="scroll-thin flex-1 overflow-y-auto px-2 py-3"
          id={compact ? "tour-sidebar-compact" : "tour-sidebar"}
        >
          {!compact && (
            <button
              type="button"
              onClick={() => setThemesOpen((v) => !v)}
              className="mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-bold tracking-wider text-ungrd-yellow uppercase"
              id="tour-temas"
            >
              Temas ({themes.length})
              <ChevronLeft
                className={clsx(
                  "h-4 w-4 transition",
                  themesOpen ? "-rotate-90" : "rotate-180",
                )}
              />
            </button>
          )}

          {(compact || themesOpen) && (
            <ul className={clsx("mb-3", compact ? "space-y-1" : "space-y-0.5")}>
              {themes.map((theme) => {
                const href = `/app/temas/${theme.id}`;
                const active = pathname.startsWith(href);
                const isTemplate = theme.id === "plantilla";
                return (
                  <li key={theme.id}>
                    {isTemplate && !compact && (
                      <p className="mt-2 mb-1 px-3 text-[10px] font-bold tracking-wider text-[#7f98ad] uppercase">
                        Referencia
                      </p>
                    )}
                    <Link
                      href={href}
                      title={
                        isTemplate
                          ? `${theme.name} · línea base (no modificar)`
                          : theme.name
                      }
                      aria-label={theme.name}
                      className={linkClass(active)}
                    >
                      <ThemeIcon
                        name={theme.icon}
                        className={clsx(
                          "shrink-0",
                          compact ? "h-5 w-5" : "h-4 w-4",
                          active ? "text-ungrd-yellow" : "text-[#7f98ad]",
                        )}
                      />
                      {!compact && (
                        <span className="truncate">
                          {theme.name}
                          {isTemplate
                            ? " · base"
                            : theme.canWrite
                              ? ""
                              : " · L"}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <div
            className={clsx(
              "border-t border-ungrd-sidebar-border",
              compact ? "mt-2 space-y-1 pt-3" : "mt-2 space-y-0.5 pt-3",
            )}
          >
            <Link
              href="/app/mando-nacional"
              title="Mando nacional"
              aria-label="Mando nacional"
              className={linkClass(pathname.startsWith("/app/mando-nacional"))}
            >
              <Radar className={compact ? "h-5 w-5" : "h-4 w-4"} />
              {!compact && "Mando nacional"}
            </Link>
            <Link
              href="/app/tareas"
              title="Mis tareas"
              aria-label="Mis tareas"
              className={linkClass(pathname.startsWith("/app/tareas"))}
            >
              <ClipboardList className={compact ? "h-5 w-5" : "h-4 w-4"} />
              {!compact && "Mis tareas"}
            </Link>
            <Link
              href="/app/casos"
              title="Mis casos"
              aria-label="Mis casos"
              className={linkClass(pathname.startsWith("/app/casos"))}
            >
              <FolderOpen className={compact ? "h-5 w-5" : "h-4 w-4"} />
              {!compact && "Mis casos"}
            </Link>
            <Link
              href="/app/cargas"
              title="Cargas Excel"
              aria-label="Cargas Excel"
              className={linkClass(pathname.startsWith("/app/cargas"))}
            >
              <Upload className={compact ? "h-5 w-5" : "h-4 w-4"} />
              {!compact && "Cargas Excel"}
            </Link>
            {admin && (
              <Link
                href="/app/admin/permisos"
                title="Permisos por tema"
                aria-label="Permisos por tema"
                className={linkClass(pathname.startsWith("/app/admin"))}
              >
                <Shield className={compact ? "h-5 w-5" : "h-4 w-4"} />
                {!compact && "Permisos"}
              </Link>
            )}
            <button
              type="button"
              id={compact ? undefined : "tour-visita"}
              title="Visita guiada"
              aria-label="Visita guiada"
              onClick={() => startGuidedTour()}
              className={linkClass(false)}
            >
              <Route className={compact ? "h-5 w-5" : "h-4 w-4"} />
              {!compact && "Visita guiada"}
            </button>
            <Link
              href="/app/acerca"
              id={compact ? undefined : "tour-acerca"}
              title="Acerca de"
              aria-label="Acerca de"
              className={linkClass(pathname === "/app/acerca")}
            >
              <Info className={compact ? "h-5 w-5" : "h-4 w-4"} />
              {!compact && "Acerca de"}
            </Link>
            <Link
              href="/app"
              title="Panel general"
              aria-label="Panel general"
              className={linkClass(pathname === "/app")}
            >
              <BookOpen className={compact ? "h-5 w-5" : "h-4 w-4"} />
              {!compact && "Panel general"}
            </Link>
          </div>
        </nav>

        <div
          className={clsx(
            "border-t border-ungrd-sidebar-border",
            compact ? "p-2" : "p-3",
          )}
        >
          {!compact && (
            <div className="mb-2 truncate px-2 text-xs text-[#8fa7bb]">
              {userEmail}
            </div>
          )}
          <button
            type="button"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            onClick={() => {
              void logout();
            }}
            className={linkClass(false)}
          >
            <LogOut className={compact ? "h-5 w-5" : "h-4 w-4"} />
            {!compact && "Cerrar sesión"}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-screen bg-ungrd-bg">
      <aside
        className={clsx(
          "relative z-40 hidden shrink-0 bg-ungrd-sidebar text-white transition-[width] duration-300 ease-out lg:block",
          collapsed ? "w-16" : "w-72",
        )}
      >
        <div
          className={clsx(
            "flex h-full flex-col overflow-hidden",
            collapsed ? "w-16" : "w-72",
          )}
        >
          {renderNav(collapsed)}
        </div>

        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Desplegar menú" : "Plegar menú"}
          title={collapsed ? "Desplegar menú" : "Plegar menú"}
          className="absolute top-1/2 right-0 z-50 flex h-16 w-6 translate-x-full -translate-y-1/2 items-center justify-center rounded-r-lg border border-l-0 border-ungrd-sidebar-border bg-ungrd-sidebar text-ungrd-yellow shadow-[4px_0_14px_rgba(0,0,0,0.25)] transition hover:bg-ungrd-navy-mid hover:text-white"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-ungrd-sidebar text-white shadow-2xl">
            <button
              type="button"
              className="absolute top-3 right-3 rounded-md p-1 text-white/70 hover:bg-white/10"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            {renderNav(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ungrd-border bg-ungrd-surface/95 px-4 py-3 backdrop-blur lg:px-6">
          <button
            type="button"
            className="rounded-lg border border-ungrd-border p-2 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5 text-ungrd-heading" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold text-ungrd-heading">
              Plataforma de Temas Operativos
            </p>
            <p className="truncate text-xs text-ungrd-muted">
              Hola, {userName}
            </p>
          </div>
          <ThemeToggle />
          <div className="hidden h-2 w-16 overflow-hidden rounded-full sm:block">
            <div className="h-full w-full bg-[linear-gradient(90deg,#ffd100_0%,#002d5a_100%)]" />
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-5 lg:px-6 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
