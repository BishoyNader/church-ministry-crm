"use client";

import { useEffect } from "react";
import { useForm, type UseFormReturn, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { useCreateChurch, useUpdateChurch } from "../hooks/use-churches";
import { createChurchSchema, updateChurchSchema } from "../schemas/church.schema";
import type { ChurchListItem } from "../types/church.types";
import type { CreateChurchFormValues, UpdateChurchFormValues } from "../schemas/church.schema";

type ChurchFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  church?: ChurchListItem | null;
};

export function ChurchFormDialog({ open, onOpenChange, church }: ChurchFormDialogProps) {
  const t = useTranslations("churches.form");
  const isEdit = !!church;

  const createForm = useForm<CreateChurchFormValues>({
    resolver: zodResolver(createChurchSchema),
    defaultValues: {
      name_ar: "",
      slug: "",
      contact_email: "",
      contact_phone: "",
      address_ar: "",
      address_en: "",
      subscription_tier: "trial",
      subscription_status: "active",
      locale: "ar",
    },
  });

  const updateForm = useForm<UpdateChurchFormValues>({
    resolver: zodResolver(updateChurchSchema),
    defaultValues: {
      name_ar: "",
      slug: "",
      contact_email: "",
      contact_phone: "",
      address_ar: "",
      address_en: "",
      subscription_tier: "trial",
      subscription_status: "active",
      locale: "ar",
    },
  });

  useEffect(() => {
    if (isEdit && church) {
      updateForm.reset({
        name_ar: church.name_ar,
        slug: church.slug,
        contact_email: church.contact_email ?? "",
        contact_phone: church.contact_phone ?? "",
        address_ar: church.address_ar ?? "",
        address_en: church.address_en ?? "",
        subscription_tier: church.subscription_tier ?? "trial",
        subscription_status: church.subscription_status ?? "active",
        locale: church.locale ?? "ar",
      });
    }
  }, [isEdit, church, updateForm]);

  const createMutation = useCreateChurch();
  const updateMutation = useUpdateChurch();

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  async function onCreate(values: CreateChurchFormValues) {
    await createMutation.mutateAsync(values);
    if (createMutation.isSuccess) {
      onOpenChange(false);
      createForm.reset();
    }
  }

  async function onUpdate(values: UpdateChurchFormValues) {
    if (!church) return;
    await updateMutation.mutateAsync({ churchId: church.id, values });
    if (updateMutation.isSuccess) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>
            {isEdit ? t("editDescription") : t("createDescription")}
          </DialogDescription>
        </DialogHeader>

        {isEdit ? (
          <form onSubmit={updateForm.handleSubmit(onUpdate)} className="space-y-4">
            <ChurchFields form={updateForm as unknown as UseFormReturn<FieldValues>} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("saving") : t("save")}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={createForm.handleSubmit(onCreate)} className="space-y-4">
            <ChurchFields form={createForm as unknown as UseFormReturn<FieldValues>} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("creating") : t("create")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogPopup>
    </Dialog>
  );
}

type ChurchFieldsProps = {
  form: UseFormReturn<FieldValues>;
};

function ChurchFields({ form }: ChurchFieldsProps) {
  const t = useTranslations("churches.form");
  const errors = form.formState.errors as Record<string, { message?: string } | undefined>;

  return (
    <>
      <FormField label={t("nameAr")} error={errors.name_ar?.message} required>
        <Input {...form.register("name_ar")} placeholder={t("placeholderNameAr")} />
      </FormField>

      <FormField label={t("slug")} error={errors.slug?.message} required>
        <Input {...form.register("slug")} placeholder={t("placeholderSlug")} />
      </FormField>

      <FormField label={t("contactEmail")} error={errors.contact_email?.message}>
        <Input type="email" {...form.register("contact_email")} placeholder={t("placeholderEmail")} />
      </FormField>

      <FormField label={t("contactPhone")} error={errors.contact_phone?.message}>
        <Input {...form.register("contact_phone")} placeholder={t("placeholderPhone")} />
      </FormField>

      <FormField label={t("addressAr")} error={errors.address_ar?.message}>
        <Input {...form.register("address_ar")} placeholder={t("placeholderAddressAr")} />
      </FormField>

      <FormField label={t("addressEn")} error={errors.address_en?.message}>
        <Input {...form.register("address_en")} placeholder={t("placeholderAddressEn")} />
      </FormField>

      <FormField label={t("subscriptionTier")} error={errors.subscription_tier?.message}>
        <Input {...form.register("subscription_tier")} placeholder={t("placeholderTier")} />
      </FormField>

      <FormField label={t("subscriptionStatus")} error={errors.subscription_status?.message}>
        <Input {...form.register("subscription_status")} placeholder={t("placeholderStatus")} />
      </FormField>

      <FormField label={t("locale")} error={errors.locale?.message}>
        <Input {...form.register("locale")} placeholder={t("placeholderLocale")} />
      </FormField>
    </>
  );
}
