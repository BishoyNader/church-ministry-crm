"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { generateSlug } from "@/lib/utils/slug";
import type { ProvisionChurchWizardValues } from "../schemas/provisioning.schema";

type ChurchConfigFormProps = {
  form: UseFormReturn<ProvisionChurchWizardValues>;
};

export function ChurchConfigForm({ form }: ChurchConfigFormProps) {
  const t = useTranslations("churches");
  const errors = form.formState.errors;

  const watchedNameAr = form.watch("churchNameAr");
  const slugValue = form.watch("slug");

  const lastAutoSlug = useRef<string | null>(null);

  useEffect(() => {
    const base = (watchedNameAr ?? "").trim();
    const current = slugValue ?? "";
    const isAuto = current === "" || (lastAutoSlug.current !== null && current === lastAutoSlug.current);

    if (!base) {
      if (isAuto && current !== "") {
        lastAutoSlug.current = null;
        form.setValue("slug", "", { shouldValidate: false });
      }
      return;
    }

    const candidate = generateSlug(base);
    if (isAuto && candidate !== current) {
      lastAutoSlug.current = candidate;
      form.setValue("slug", candidate, { shouldValidate: false });
    } else if (isAuto) {
      lastAutoSlug.current = candidate;
    }
  }, [watchedNameAr, slugValue, form]);

  const regenerateSlug = () => {
    const base = (watchedNameAr ?? "").trim();
    const candidate = generateSlug(base || "church");
    lastAutoSlug.current = candidate;
    form.setValue("slug", candidate, { shouldValidate: true });
  };

  const handleSlugChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    lastAutoSlug.current = null;
    form.setValue("slug", event.target.value, { shouldValidate: false });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormField
          label={t("wizard.church.churchNameAr")}
          error={errors.churchNameAr?.message}
          required
        >
          <Input {...form.register("churchNameAr")} placeholder={t("wizard.church.churchNameArPlaceholder")} />
        </FormField>
      </div>

      <div className="sm:col-span-2">
        <FormField
          label={t("wizard.church.slug")}
          error={errors.slug?.message}
          required
          hint={t("wizard.church.slugHint")}
        >
          <div className="flex items-center gap-2">
            <Input
              value={slugValue ?? ""}
              onChange={handleSlugChange}
              dir="ltr"
              placeholder="church-slug"
              className="font-mono"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={regenerateSlug}
              aria-label={t("wizard.church.regenerateSlug")}
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </FormField>
      </div>

      <FormField label={t("wizard.church.contactEmail")} error={errors.contactEmail?.message}>
        <Input type="email" {...form.register("contactEmail")} placeholder="contact@church.org" />
      </FormField>

      <FormField label={t("wizard.church.contactPhone")} error={errors.contactPhone?.message}>
        <Input {...form.register("contactPhone")} placeholder="+20 123 456 7890" />
      </FormField>

      <div className="sm:col-span-2">
        <FormField label={t("wizard.church.addressAr")} error={errors.addressAr?.message}>
          <Input {...form.register("addressAr")} placeholder={t("wizard.church.addressArPlaceholder")} />
        </FormField>
      </div>
    </div>
  );
}
