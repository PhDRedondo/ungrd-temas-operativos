import { notFound } from "next/navigation";
import { ThemeWorkspace } from "@/components/ThemeWorkspace";
import { parseFiltersFromParams } from "@/lib/analytics/recordFilters";
import { getTheme, THEMES } from "@/lib/themes";

export function generateStaticParams() {
  return THEMES.map((t) => ({ slug: t.id }));
}

export default async function ThemePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const theme = getTheme(slug);
  if (!theme) notFound();

  const tab = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const initialFilters = parseFiltersFromParams(sp);

  return (
    <ThemeWorkspace
      theme={theme}
      initialTab={tab}
      initialFilters={initialFilters}
    />
  );
}
