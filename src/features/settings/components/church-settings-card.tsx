"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Church } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useChurchSettings, useUpdateChurch } from "../hooks/use-settings";
import { updateChurchSchema } from "../schemas/settings.schema";
import type { UpdateChurchFormValues } from "../schemas/settings.schema";
import { FormField } from "@/components/ui/form-field";
import { SectionCard } from "@/components/layout/section-card";

export function ChurchSettingsCard() {
  const t = useTranslations("settings");
  const { data, isLoading, error } = useChurchSettings();
  const updateMutation = useUpdateChurch();

  const form = useForm<UpdateChurchFormValues>({
    resolver: zodResolver(updateChurchSchema),
    defaultValues: {
      nameAr: "",
      nameEn: "",
      contactEmail: "",
      contactPhone: "",
      addressAr: "",
      addressEn: "",
      logoUrl: "",
    },
  });

  useEffect(() => {
    if (data?.data) {
      form.reset({
        nameAr: data.data.name_ar ?? "",
        nameEn: data.data.name_en ?? "",
        contactEmail: data.data.contact_email ?? "",
        contactPhone: data.data.contact_phone ?? "",
        addressAr: data.data.address_ar ?? "",
        addressEn: data.data.address_en ?? "",
        logoUrl: data.data.logo_url ?? "",
      });
    }
  }, [data, form]);

  const handleSubmit = async (values: UpdateChurchFormValues) => {
    const result = await updateMutation.mutateAsync(values);
    if (result.success) form.reset(values);
  };

  const formError = updateMutation.data?.message;

  if (isLoading) {
    return (
      <SectionCard>
        <div className="space-y-3 p-6">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard className="p-6">
        <p className="text-sm text-destructive">{error.message}</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard className="p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-ministry/10 p-3 text-ministry">
          <Church className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold">{t("church.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("church.description")}</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("church.nameAr")} error={form.formState.errors.nameAr?.message} required>
            <Input {...form.register("nameAr")} />
          </FormField>
          <FormField label={t("church.nameEn")}>
            <Input {...form.register("nameEn")} />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("church.contactEmail")} error={form.formState.errors.contactEmail?.message}>
            <Input type="email" {...form.register("contactEmail")} />
          </FormField>
          <FormField label={t("church.contactPhone")}>
            <Input {...form.register("contactPhone")} />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("church.addressAr")}>
            <Textarea rows={2} {...form.register("addressAr")} />
          </FormField>
          <FormField label={t("church.addressEn")}>
            <Textarea rows={2} {...form.register("addressEn")} />
          </FormField>
        </div>

        <FormField label={t("church.logoUrl")} error={form.formState.errors.logoUrl?.message}>
          <Input {...form.register("logoUrl")} />
        </FormField>

        {formError ? <p className="text-xs text-destructive">{formError}</p> : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? t("church.processing") : t("church.save")}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}