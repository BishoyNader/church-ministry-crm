"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChangePassword } from "../hooks/use-settings";
import { changePasswordSchema } from "../schemas/settings.schema";
import type { ChangePasswordFormValues } from "../schemas/settings.schema";
import { FormField } from "@/components/ui/form-field";
import { SectionCard } from "@/components/layout/section-card";
import { InlineNotice } from "@/components/ui/inline-notice";

const emptyValues: ChangePasswordFormValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function ChangePasswordCard() {
  const t = useTranslations("settings");
  const changeMutation = useChangePassword();

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: emptyValues,
  });

  const handleSubmit = async (values: ChangePasswordFormValues) => {
    const result = await changeMutation.mutateAsync(values);
    if (result.success) {
      form.reset(emptyValues);
    }
  };

  const formError = changeMutation.data?.message;
  const successMessage = changeMutation.data?.success ? changeMutation.data.message : undefined;

  return (
    <SectionCard className="p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-ministry/10 p-3 text-ministry">
          <KeyRound className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold">{t("password.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("password.description")}</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)} className="mt-6 space-y-4">
        <FormField
          label={t("password.currentPassword")}
          error={form.formState.errors.currentPassword?.message}
          required
        >
          <Input type="password" {...form.register("currentPassword")} />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={t("password.newPassword")}
            error={form.formState.errors.newPassword?.message}
            required
          >
            <Input type="password" {...form.register("newPassword")} />
          </FormField>
          <FormField
            label={t("password.confirmPassword")}
            error={form.formState.errors.confirmPassword?.message}
            required
          >
            <Input type="password" {...form.register("confirmPassword")} />
          </FormField>
        </div>

        {formError ? <InlineNotice variant="error" className="mt-1"><p>{formError}</p></InlineNotice> : null}
        {successMessage ? <InlineNotice variant="success" className="mt-1"><p>{successMessage}</p></InlineNotice> : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={changeMutation.isPending}>
            {changeMutation.isPending ? t("password.processing") : t("password.save")}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}