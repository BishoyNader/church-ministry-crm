import { Skeleton } from "@/components/ui/skeleton";

type LoadingStateProps = {
  count?: number;
  height?: string;
};

export function LoadingState({ count = 3, height = "h-64" }: LoadingStateProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={`${height} w-full`} />
      ))}
    </div>
  );
}
