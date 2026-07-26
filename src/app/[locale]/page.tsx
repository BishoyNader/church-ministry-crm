import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocalizedHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <main className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.14),_transparent_45%),linear-gradient(135deg,_#f8fafc_0%,_#eef2ff_100%)] text-slate-900 dark:bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.2),_transparent_45%),linear-gradient(135deg,_#020617_0%,_#111827_100%)] dark:text-slate-100">
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-20 sm:px-8 lg:px-12">
        <div className="max-w-3xl rounded-3xl border border-white/60 bg-white/80 p-8 shadow-2xl shadow-slate-200/70 backdrop-blur xl:p-12 dark:border-slate-800/80 dark:bg-slate-900/70 dark:shadow-black/30">
          <p className="mb-4 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            {t("home.badge")}
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            {t("home.title")}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            {t("home.description")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#features"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
            >
              {t("home.primaryAction")}
            </a>
            <a
              href="https://nextjs.org/docs"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t("home.secondaryAction")}
            </a>
          </div>
        </div>

        <div id="features" className="mt-10 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
            <h2 className="text-lg font-semibold">{t("features.volunteerCoordination.title")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {t("features.volunteerCoordination.description")}
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
            <h2 className="text-lg font-semibold">{t("features.memberEngagement.title")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {t("features.memberEngagement.description")}
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
            <h2 className="text-lg font-semibold">{t("features.simpleReporting.title")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {t("features.simpleReporting.description")}
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
