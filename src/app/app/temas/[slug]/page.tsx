import { notFound } from "next/navigation";
import { ThemeWorkspace } from "@/components/ThemeWorkspace";
import { getTheme, THEMES } from "@/lib/themes";

export function generateStaticParams() {
  return THEMES.map((t) => ({ slug: t.id }));
}

export default async function ThemePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const theme = getTheme(slug);
  if (!theme) notFound();
  return <ThemeWorkspace theme={theme} />;
}
