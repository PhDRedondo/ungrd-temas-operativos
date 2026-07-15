"use client";

import Image from "next/image";
import { useTheme } from "@/lib/theme";

type Props = {
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
};

export function BrandLogo({
  className = "h-16 w-auto object-contain",
  width = 120,
  height = 140,
  priority = false,
}: Props) {
  const { theme, ready } = useTheme();
  const src =
    ready && theme === "dark"
      ? "/branding/UNGRD-Vertical-1tinta.png"
      : "/branding/UNGRD-Vertical.png";

  return (
    <Image
      src={src}
      alt="UNGRD — Unidad Nacional para la Gestión del Riesgo de Desastres"
      width={width}
      height={height}
      className={className}
      priority={priority}
    />
  );
}
