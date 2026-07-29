import { PageHeader } from "./page-header";
import { SectionCard } from "./section-card";

export function PageShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-6">
      <PageHeader title={title} description={description} />
      <SectionCard className="p-6">{children}</SectionCard>
    </section>
  );
}
