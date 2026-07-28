"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { resetPasswordSchema } from "../schemas/auth.schema";
import type { ResetPasswordFormValues } from "../types/auth.types";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
  });

  useEffect(() => {
    const initializeResetSession = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      setHasSession(Boolean(data.session));
      setInitialized(true);
    };

    initializeResetSession().catch((err) => {
      setError(err?.message ?? t("resetPassword.generalError"));
      setInitialized(true);
    });
  }, [t]);

  const onSubmit = async (values: ResetPasswordFormValues) => {
    setMessage(null);
    setError(null);
    setIsLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.updateUser({ password: values.password });

    if (authError) {
      setError(authError.message);
    } else {
      setMessage(t("resetPassword.success"));
    }

    setIsLoading(false);
  };

  if (initialized && !hasSession) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-100">
        {t("resetPassword.noToken")}
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      {error ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-900/20 dark:text-emerald-200">{message}</div>
      ) : null}

      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        {t("resetPassword.password")}
        <input
          type="password"
          autoComplete="new-password"
          {...register("password")}
          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        {errors.password ? <p className="mt-1 text-xs text-destructive">{errors.password.message}</p> : null}
      </label>

      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        {t("resetPassword.confirmPassword")}
        <input
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        {errors.confirmPassword ? <p className="mt-1 text-xs text-destructive">{errors.confirmPassword.message}</p> : null}
      </label>

      <Button type="submit" className="w-full" disabled={isLoading || !initialized}>
        {isLoading ? t("loading") : t("resetPassword.submit")}
      </Button>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        <Link href={`/${locale}/login`} className="font-semibold text-primary hover:underline">{t("resetPassword.login")}</Link>
      </p>
    </form>
  );
}
