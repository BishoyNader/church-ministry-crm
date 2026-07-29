import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type ChartCardProps = {
  title: string;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyState?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
};

export function ChartCard({ title, isLoading, isEmpty, emptyState, children, contentClassName }: ChartCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className={cn("min-h-[256px] w-full", contentClassName)} />
        </CardContent>
      </Card>
    );
  }

  if (isEmpty && emptyState) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>{emptyState}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("min-h-[256px]", contentClassName)}>{children}</div>
      </CardContent>
    </Card>
  );
}
