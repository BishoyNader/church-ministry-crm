"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { User, Mail, Phone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useUpdateProfile } from "../hooks/use-settings";
import { updateProfileSchema } from "../schemas/settings.schema";
import type { UpdateProfileFormValues } from "../schemas/settings.schema";
import type { ProfileSettings } from "../types/settings.types";
import { FormField } from "@/components/ui/form-field";
import { SectionCard } from "@/components/layout/section-card";

type ProfileSettingsCardProps = {
  profile: ProfileSettings;
};

export function ProfileSettingsCard({ profile }: ProfileSettingsCardProps) {
  const t = useTranslations("settings");
  const updateMutation = useUpdateProfile();

  const form = useForm<UpdateProfileFormValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      fullNameAr: profile.fullNameAr,
      fullNameEn: profile.fullNameEn ?? "",
      phone: profile.phone ?? "",
      preferredLocale: profile.preferredLocale === "en" ? "en" : "ar",
    },
  });

  useEffect(() => {
    form.reset({
      fullNameAr: profile.fullNameAr,
      fullNameEn: profile.fullNameEn ?? "",
      phone: profile.phone ?? "",
      preferredLocale: profile.preferredLocale === "en" ? "en" : "ar",
    });
  }, [profile, form]);

  const handleSubmit = async (values: UpdateProfileFormValues) => {
    const result = await updateMutation.mutateAsync(values);
    if (result.success) form.reset(values);
  };

  const formError = updateMutation.data?.message;

  return (
    <SectionCard className="p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-ministry/10 p-3 text-ministry">
            <User className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">{t("profile.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("profile.description")}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-2 text-sm">
          <Mail className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">{t("profile.email")}:</span>
          <span className="font-medium">{profile.email ?? "\u2014"}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Phone className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">{t("profile.phone")}:</span>
          <span className="font-medium">{profile.phone ?? "\u2014"}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Users className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">{t("profile.roles")}:</span>
          <div className="flex flex-wrap gap-1">
            {profile.roles.length > 0 ? (
              profile.roles.map((role) => (
                <Badge key={role.id} variant="secondary">
                  {role.name_ar}
                </Badge>
              ))
            ) : (
              <span className="font-medium">\u2014</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t("profile.church")}:</span>
          <span className="font-medium">{profile.church?.name_ar ?? "\u2014"}</span>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={t("profile.fullNameAr")}
            error={form.formState.errors.fullNameAr?.message}
            required
          >
            <Input {...form.register("fullNameAr")} />
          </FormField>
          <FormField label={t("profile.fullNameEn")}>
            <Input {...form.register("fullNameEn")} />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("profile.phone")}>
            <Input {...form.register("phone")} />
          </FormField>
          <FormField label={t("profile.preferredLocale")}>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              {...form.register("preferredLocale")}
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </FormField>
        </div>

        {formError ? <p className="text-xs text-destructive">{formError}</p> : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? t("profile.processing") : t("profile.save")}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}