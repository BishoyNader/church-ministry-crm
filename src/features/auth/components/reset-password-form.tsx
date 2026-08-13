"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/ui/password-input";
import { InlineNotice } from "@/components/ui/inline-notice";
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
      <InlineNotice variant="warning">
        <p>{t("resetPassword.noToken")}</p>
      </InlineNotice>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
      {error ? (
        <InlineNotice variant="error">
          <p>{error}</p>
        </InlineNotice>
      ) : null}
      {message ? (
        <InlineNotice variant="success">
          <p>{message}</p>
        </InlineNotice>
      ) : null}

      <FormField label={t("resetPassword.password")} error={errors.password?.message}>
        <PasswordInput autoComplete="new-password" {...register("password")} />
      </FormField>

      <FormField label={t("resetPassword.confirmPassword")} error={errors.confirmPassword?.message}>
        <PasswordInput autoComplete="new-password" {...register("confirmPassword")} />
      </FormField>

      <Button type="submit" className="w-full" disabled={isLoading || !initialized}>
        {isLoading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {t("loading")}
          </>
        ) : (
          t("resetPassword.submit")
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href={`/${locale}/login`} className="font-semibold text-primary hover:underline">{t("resetPassword.login")}</Link>
      </p>
    </form>
  );
}
