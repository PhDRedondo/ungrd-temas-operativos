import { notFound } from "next/navigation";
import { ThemeWorkspace } from "@/components/ThemeWorkspace";
import { getTheme, THEMES } from "@/lib/themes";

export function generateStaticParams() {
  return THEMES.map((t) => ({ slug: t.id }));
}

export default async function ThemePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab } = await searchParams;
  const theme = getTheme(slug);
  if (!theme) notFound();
  return <ThemeWorkspace theme={theme} initialTab={tab} />;
}
