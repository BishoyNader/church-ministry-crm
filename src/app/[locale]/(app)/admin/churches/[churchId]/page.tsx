import { ChurchDetailPage } from "@/features/churches/components/church-detail-page";

export default async function ChurchDetailRoute({ params }: { params: Promise<{ churchId: string }> }) {
  const { churchId } = await params;
  return <ChurchDetailPage churchId={churchId} />;
}
