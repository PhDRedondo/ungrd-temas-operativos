"use client";

import { Moon, Sun } from "lucide-react";
import clsx from "clsx";
import { useTheme } from "@/lib/theme";

type Props = {
  className?: string;
  /** Estilo para fondos claros (default) o hero oscuro/claro según tema */
  variant?: "default" | "hero";
};

export function ThemeToggle({ className, variant = "default" }: Props) {
  const { theme, toggleTheme, ready } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Activar tema claro" : "Activar tema oscuro"}
      title={isDark ? "Tema claro" : "Tema oscuro"}
      className={clsx(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition",
        variant === "hero"
          ? "border-ungrd-border bg-ungrd-surface/80 text-ungrd-text backdrop-blur hover:border-ungrd-yellow dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:border-ungrd-yellow dark:hover:text-ungrd-yellow"
          : "border-ungrd-border bg-ungrd-surface text-ungrd-heading hover:border-ungrd-navy/40 dark:text-ungrd-text",
        className,
      )}
      disabled={!ready}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">{isDark ? "Claro" : "Oscuro"}</span>
    </button>
  );
}
