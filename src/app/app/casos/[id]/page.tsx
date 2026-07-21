import { CaseDetail } from "@/components/CasesInbox";

type Props = { params: Promise<{ id: string }> };

export default async function CasoDetailPage({ params }: Props) {
  const { id } = await params;
  return <CaseDetail caseId={id} />;
}
