import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">404</p>
        <h1 className="mt-3 text-3xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm text-slate-300">
          The page you requested could not be found.
        </p>
        <Link href="/ar" className="mt-6 inline-flex rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950">
          Go home
        </Link>
      </div>
    </main>
  );
}
