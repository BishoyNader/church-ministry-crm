"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormField } from "@/components/ui/form-field";
import { Checkbox } from "@/components/ui/checkbox";
import { InlineNotice } from "@/components/ui/inline-notice";
import { loginSchema } from "../schemas/auth.schema";
import type { LoginFormValues } from "../types/auth.types";
import type { AuthActionResult } from "../actions/auth.actions";

export function LoginForm({
  action,
  locale,
}: {
  action: (values: LoginFormValues, locale: string) => Promise<AuthActionResult>;
  locale: string;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { remember: true },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null);
    setIsLoading(true);

    const result = await action(values, locale);

    if (!result.success) {
      setFormError(result.message ?? t("generalError"));
      setIsLoading(false);
      return;
    }

    if (result.redirectTo) {
      router.push(result.redirectTo);
    }

    setIsLoading(false);
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
      {formError ? (
        <InlineNotice variant="error">
          <p>{formError}</p>
        </InlineNotice>
      ) : null}

      <div className="space-y-4">
        <FormField label={t("login.emailLabel")} error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register("email")} />
        </FormField>

        <FormField label={t("login.passwordLabel")} error={errors.password?.message}>
          <PasswordInput autoComplete="current-password" {...register("password")} />
        </FormField>
      </div>

      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <Controller
            name="remember"
            control={control}
            render={({ field }) => (
              <Checkbox
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked)}
              />
            )}
          />
          {t("login.rememberMe")}
        </label>
        <Link href={`/${locale}/forgot-password`} className="font-medium text-primary hover:underline">
          {t("login.forgotPassword")}
        </Link>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {t("loading")}
          </>
        ) : (
          t("login.submit")
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t("login.noAccount")} <Link href={`/${locale}/signup`} className="font-semibold text-primary hover:underline">{t("login.createAccount")}</Link>
      </p>
    </form>
  );
}
