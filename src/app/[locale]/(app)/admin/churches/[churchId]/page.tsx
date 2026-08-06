import { ChurchDetailPage } from "@/features/churches/components/church-detail-page";

type Props = {
  params: Promise<{ churchId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function ChurchDetailRoute({ params, searchParams }: Props) {
  const [{ churchId }, { tab }] = await Promise.all([params, searchParams]);
  return <ChurchDetailPage churchId={churchId} initialTab={tab} />;
}
