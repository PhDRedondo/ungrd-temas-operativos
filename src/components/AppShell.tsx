"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Info,
  LogOut,
  Menu,
  Radar,
  Route,
  Shield,
  X,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth";
import { canAdmin } from "@/lib/auth/roles";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeIcon } from "@/components/ThemeIcon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { startGuidedTour } from "@/lib/tour";
import { readJson } from "@/lib/http/read-json";
import { getThemeVisual, themeIdFromPath } from "@/lib/theme-visuals";

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
        const parsed = await readJson<{ themes?: AccessTheme[] }>(res);
        if (!cancelled && parsed.ok) setThemes(parsed.data.themes || []);
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
    const visibleThemes = themes.filter((theme) => theme.id !== "plantilla");
    const linkClass = (active: boolean) =>
      clsx(
        "group flex items-center rounded-lg text-sm transition",
        compact ? "justify-center px-2 py-2.5" : "gap-2 px-3 py-2",
        active
          ? "bg-ungrd-sidebar-active font-semibold text-white"
          : "text-[#c5d4e0] hover:bg-ungrd-sidebar-hover hover:text-white",
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
              className="mb-2 flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left transition hover:border-ungrd-yellow/35 hover:bg-white/[0.07]"
              id="tour-temas"
              aria-expanded={themesOpen}
            >
              <span className="min-w-0">
                <span className="block text-[10px] font-extrabold tracking-[0.18em] text-ungrd-yellow uppercase">
                  Portafolio
                </span>
                <span className="mt-0.5 block truncate text-sm font-extrabold text-white">
                  Frentes operativos
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="rounded-md bg-ungrd-yellow px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums text-ungrd-navy-deep">
                  {visibleThemes.length}
                </span>
                <ChevronLeft
                  className={clsx(
                    "h-4 w-4 text-ungrd-yellow transition",
                    themesOpen ? "-rotate-90" : "rotate-180",
                  )}
                />
              </span>
            </button>
          )}

          {(compact || themesOpen) && (
            <ul className={clsx("mb-3", compact ? "space-y-1" : "space-y-0.5")}>
              {visibleThemes.map((theme) => {
                const href = `/app/temas/${theme.id}`;
                const active = pathname.startsWith(href);
                return (
                  <li key={theme.id}>
                    <Link
                      href={href}
                      title={theme.name}
                      aria-label={theme.name}
                      className={linkClass(active)}
                    >
                      <ThemeIcon
                        name={theme.icon}
                        className={clsx(
                          "shrink-0",
                          compact ? "h-5 w-5" : "h-4 w-4",
                        )}
                        style={{
                          color: active
                            ? "#ffd100"
                            : getThemeVisual(theme.id).accentSoft,
                        }}
                      />
                      {!compact && (
                        <span className="truncate">{theme.name}</span>
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
              title="Visión nacional"
              aria-label="Visión nacional"
              className={linkClass(pathname.startsWith("/app/mando-nacional"))}
            >
              <Radar className={compact ? "h-5 w-5" : "h-4 w-4"} />
              {!compact && "Visión nacional"}
            </Link>
            {admin && (
              <Link
                href="/app/cuentas"
                title="Cuentas y permisos"
                aria-label="Cuentas y permisos"
                className={linkClass(
                  pathname.startsWith("/app/cuentas") ||
                    pathname.startsWith("/app/admin/permisos"),
                )}
              >
                <Shield className={compact ? "h-5 w-5" : "h-4 w-4"} />
                {!compact && "Cuentas y permisos"}
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
              title="Inicio"
              aria-label="Inicio"
              className={linkClass(pathname === "/app")}
            >
              <BookOpen className={compact ? "h-5 w-5" : "h-4 w-4"} />
              {!compact && "Inicio"}
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

  const visualId = themeIdFromPath(pathname);

  return (
    <div
      className="flex min-h-screen bg-ungrd-bg"
      data-theme-visual={visualId || undefined}
    >
      <div
        className="ungrd-tricolor-bar pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
        title="UNGRD · Colombia"
        aria-hidden
      />
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
        <header className="ungrd-app-header sticky top-0 z-30 flex items-center gap-3 px-4 py-3 lg:px-6">
          <button
            type="button"
            className="ungrd-menu-btn lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
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
          <div
            className="ungrd-tricolor-bar hidden h-2 w-16 shrink-0 overflow-hidden rounded-full sm:block"
            title="UNGRD · Colombia"
            aria-hidden
          />
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-5 lg:px-6 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
