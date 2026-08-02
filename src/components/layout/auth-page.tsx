import Link from "next/link";
import { Church } from "lucide-react";

export function AuthPage({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-dashboard px-4 py-16 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 start-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 end-8 h-72 w-72 rounded-full bg-ministry/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-xl">
        <Link
          href={`/${locale}`}
          className="mb-8 flex items-center justify-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <div className="rounded-2xl bg-primary p-2.5 text-primary-foreground shadow-diffused-md">
            <Church className="size-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Church CRM</span>
        </Link>
        {children}
      </div>
    </main>
  );
}
