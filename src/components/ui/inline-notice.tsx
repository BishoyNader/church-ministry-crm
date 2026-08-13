import { AlertCircle, CheckCircle2, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const noticeVariants = cva(
  "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
  {
    variants: {
      variant: {
        info: "border-info/30 bg-info/5 text-foreground",
        success: "border-success/30 bg-success/5 text-foreground",
        warning: "border-warning/30 bg-warning/10 text-foreground",
        error: "border-destructive/30 bg-destructive/10 text-foreground",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

const ICONS: Record<NonNullable<NonNullable<VariantProps<typeof noticeVariants>["variant"]>>, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle,
};

type InlineNoticeProps = React.ComponentProps<"div"> &
  VariantProps<typeof noticeVariants> & {
    /** Emphasis colour applied to the leading icon. */
    tone?: "info" | "success" | "warning" | "error";
  };

export function InlineNotice({
  variant,
  tone,
  className,
  children,
  ...props
}: InlineNoticeProps) {
  const resolvedTone = tone ?? variant ?? "info";
  const Icon = ICONS[resolvedTone];

  return (
    <div
      role={resolvedTone === "error" ? "alert" : "status"}
      className={cn(noticeVariants({ variant: variant ?? resolvedTone }), className)}
      {...props}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          resolvedTone === "info" && "text-info",
          resolvedTone === "success" && "text-success",
          resolvedTone === "warning" && "text-warning",
          resolvedTone === "error" && "text-destructive",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 [&>p]:leading-6">{children}</div>
    </div>
  );
}
