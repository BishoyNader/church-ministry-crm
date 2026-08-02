"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { forgotPasswordSchema } from "../schemas/auth.schema";
import type { AuthActionResult } from "../actions/auth.actions";
import type { ForgotPasswordFormValues } from "../types/auth.types";

export function ForgotPasswordForm({
  action,
  locale,
}: {
  action: (values: ForgotPasswordFormValues, locale: string) => Promise<AuthActionResult>;
  locale: string;
}) {
  const t = useTranslations("auth");
  const [formState, setFormState] = useState<{ message?: string; error?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setFormState({});
    setIsLoading(true);

    const result = await action(values, locale);

    if (!result.success) {
      setFormState({ error: result.message ?? t("generalError") });
    } else {
      setFormState({ message: result.message ?? t("forgotPassword.sent") });
    }

    setIsLoading(false);
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      {formState.error ? (
        <div role="alert" className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {formState.error}
        </div>
      ) : null}
      {formState.message ? (
        <div role="status" className="rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          {formState.message}
        </div>
      ) : null}

      <FormField label={t("forgotPassword.email")} error={errors.email?.message}>
        <Input type="email" autoComplete="email" {...register("email")} />
      </FormField>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? t("loading") : t("forgotPassword.submit")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t("forgotPassword.remembered")} <Link href={`/${locale}/login`} className="font-semibold text-primary hover:underline">{t("forgotPassword.login")}</Link>
      </p>
    </form>
  );
}
