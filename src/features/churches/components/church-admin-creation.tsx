"use client";

import { useTranslations } from "next-intl";
import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import type { ProvisionChurchWizardValues } from "../schemas/provisioning.schema";

type ChurchAdminCreationProps = {
  form: UseFormReturn<ProvisionChurchWizardValues>;
};

export function ChurchAdminCreation({ form }: ChurchAdminCreationProps) {
  const t = useTranslations("churches");
  const errors = form.formState.errors;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        label={t("wizard.admin.fullNameAr")}
        error={errors.fullNameAr?.message}
        required
      >
        <Input {...form.register("fullNameAr")} placeholder={t("wizard.admin.fullNameArPlaceholder")} />
      </FormField>

      <FormField label={t("wizard.admin.fullNameEn")} error={errors.fullNameEn?.message}>
        <Input {...form.register("fullNameEn")} placeholder={t("wizard.admin.fullNameEnPlaceholder")} />
      </FormField>

      <FormField label={t("wizard.admin.email")} error={errors.email?.message} required>
        <Input type="email" {...form.register("email")} placeholder="admin@church.org" />
      </FormField>

      <FormField label={t("wizard.admin.phone")} error={errors.phone?.message}>
        <Input {...form.register("phone")} placeholder="+20 123 456 7890" />
      </FormField>

      <div className="sm:col-span-2">
        <FormField
          label={t("wizard.admin.password")}
          error={errors.password?.message}
          hint={t("wizard.admin.passwordHint")}
        >
          <Input
            type="password"
            {...form.register("password")}
            placeholder={t("wizard.admin.passwordPlaceholder")}
          />
        </FormField>
      </div>
    </div>
  );
}
