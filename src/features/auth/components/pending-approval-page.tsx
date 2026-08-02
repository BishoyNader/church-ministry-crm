"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle, ArrowRight, CheckCircle2, Church, Clock, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccessState } from "../hooks/use-access-state";
import { useAuth } from "../hooks/use-auth";

export function PendingApprovalPage({ locale }: { locale: string }) {
  const t = useTranslations("auth.pending");
  const router = useRouter();
  const { data, isLoading } = useAccessState();
  const { user } = useAuth();

  const state = data?.data;
  const hasAccess =
    !!state &&
    state.is_active &&
    state.servant_approval_status === "approved" &&
    state.has_roles;

  useEffect(() => {
    if (hasAccess) {
      const timer = setTimeout(() => router.replace(`/${locale}/dashboard`), 1500);
      return () => clearTimeout(timer);
    }
  }, [hasAccess, locale, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-dashboard px-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("loading")}
        </div>
      </main>
    );
  }

  const status = state?.servant_approval_status ?? null;

  const content =
    hasAccess ? (
      <ApprovedView t={t} locale={locale} churchName={state.church_name_ar} />
    ) : status === "pending" ? (
      <PendingView t={t} churchName={state?.church_name_ar ?? null} />
    ) : status === "rejected" ? (
      <RejectedView t={t} churchName={state?.church_name_ar ?? null} />
    ) : (
      <NoProfileView t={t} locale={locale} userEmail={user?.email} />
    );

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-dashboard px-4 py-16 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 start-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 end-8 h-72 w-72 rounded-full bg-ministry/10 blur-3xl" />
      </div>
      <div className="relative mx-auto w-full max-w-md rounded-3xl border border-border-whisper bg-surface-elevated p-8 shadow-diffused-lg">
        {content}
      </div>
    </main>
  );
}

type T = ReturnType<typeof useTranslations>;

function StatusCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mt-6 w-full rounded-2xl border border-border-whisper bg-muted p-4 text-sm">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}

function PendingView({ t, churchName }: { t: T; churchName: string | null }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="rounded-full bg-warning/10 p-4">
        <Clock className="size-10 text-warning" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {t("status.pending")}
      </p>
      {churchName ? (
        <StatusCard title={churchName} description={t("submittedOn")}>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
            <Clock className="size-3.5" />
            {t("badge.pending")}
          </span>
        </StatusCard>
      ) : null}
      <p className="mt-6 text-sm text-muted-foreground">{t("instructions.pending")}</p>
    </div>
  );
}

function ApprovedView({
  t,
  locale,
  churchName,
}: {
  t: T;
  locale: string;
  churchName: string | null;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="rounded-full bg-success/10 p-4">
        <CheckCircle2 className="size-10 text-success" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {t("status.approved")}
      </p>
      {churchName ? (
        <StatusCard title={churchName} description={t("submittedOn")}>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
            <CheckCircle2 className="size-3.5" />
            {t("badge.approved")}
          </span>
        </StatusCard>
      ) : null}
      <Button render={<Link href={`/${locale}/dashboard`} />} className="mt-8">
        {t("instructions.approved")}
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

function RejectedView({ t, churchName }: { t: T; churchName: string | null }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="rounded-full bg-danger/10 p-4">
        <AlertCircle className="size-10 text-danger" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {t("status.rejected")}
      </p>
      {churchName ? (
        <StatusCard title={churchName} description={t("submittedOn")}>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-danger/10 px-2.5 py-1 text-xs font-medium text-danger">
            <AlertCircle className="size-3.5" />
            {t("badge.rejected")}
          </span>
        </StatusCard>
      ) : null}
      <p className="mt-6 text-sm text-muted-foreground">{t("instructions.rejected")}</p>
    </div>
  );
}

function NoProfileView({
  t,
  locale,
  userEmail,
}: {
  t: T;
  locale: string;
  userEmail?: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="rounded-full bg-muted p-4">
        <Church className="size-10 text-muted-foreground" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {t("status.noProfile")}
      </p>
      {userEmail ? (
        <p className="mt-4 text-xs text-muted-foreground">{userEmail}</p>
      ) : null}
      <p className="mt-6 text-sm text-muted-foreground">{t("instructions.noProfile")}</p>
      <Button render={<Link href={`/${locale}/signup`} />} variant="outline" className="mt-8">
        <LogIn className="size-4" />
        {t("goToSignup")}
      </Button>
    </div>
  );
}
