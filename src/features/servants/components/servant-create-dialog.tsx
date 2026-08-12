"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { createServantSchema } from "../schemas/servant.schema";
import type { CreateServantFormValues } from "../schemas/servant.schema";
import { useCreateServant, useServantCreateOptions } from "../hooks/use-servants";

type ServantCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ServantCreateDialog({
  open,
  onOpenChange,
}: ServantCreateDialogProps) {
  const t = useTranslations("servants.form");
  const dt = useTranslations("servants.createDialog");

  const optionsQuery = useServantCreateOptions();
  const createMutation = useCreateServant();

  const form = useForm<CreateServantFormValues>({
    resolver: zodResolver(createServantSchema),
    defaultValues: {
      email: "",
      password: "",
      full_name_ar: "",
      full_name_en: "",
      phone: "",
      preferred_locale: "ar",
      roleId: "",
      serviceId: undefined,
      stageId: undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset();
      createMutation.reset();
    }
  }, [open, form, createMutation]);

  const roles = optionsQuery.data?.data?.roles ?? [];
  const services = optionsQuery.data?.data?.services ?? [];
  const stages = optionsQuery.data?.data?.stages ?? [];

  const selectedRoleId = useWatch({ control: form.control, name: "roleId" });
  const selectedRole = roles.find((role) => role.id === selectedRoleId);
  const isStageManager = selectedRole?.role_type === "stage_manager";
  const isServant = selectedRole?.role_type === "servant";
  const isAdmin = selectedRole?.role_type === "admin";
  // 050 rules: admin / stage_manager / servant all need a service; only the
  // servant additionally needs a stage (inside that service).
  const requiresService = isStageManager || isServant || isAdmin;

  const selectedServiceId = useWatch({ control: form.control, name: "serviceId" });
  const serviceStages = selectedServiceId
    ? stages.filter((stage) => stage.service_id === selectedServiceId)
    : [];

  const preferredLocale = useWatch({ control: form.control, name: "preferred_locale" });
  const selectedStageId = useWatch({ control: form.control, name: "stageId" });

  const handleRoleChange = (roleId: unknown) => {
    if (typeof roleId !== "string") return;
    form.setValue("roleId", roleId);
    // Assignment requirements are role-specific; clear any stale selection
    // when the role changes.
    form.setValue("serviceId", undefined);
    form.setValue("stageId", undefined);
  };

  const handleServiceChange = (serviceId: unknown) => {
    if (typeof serviceId !== "string") return;
    form.setValue("serviceId", serviceId);
    form.setValue("stageId", undefined);
  };

  const handleCreate = async (values: CreateServantFormValues) => {
    const result = await createMutation.mutateAsync(values);
    if (result.success) {
      onOpenChange(false);
    }
  };

  const isPending = createMutation.isPending;
  const isLoadingOptions = optionsQuery.isLoading;
  const optionsError = optionsQuery.error?.message ?? null;
  const submitError = createMutation.data?.success === false
    ? (createMutation.data.message ?? null)
    : (createMutation.error?.message ?? null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dt("title")}</DialogTitle>
          <DialogDescription>{dt("description")}</DialogDescription>
        </DialogHeader>

        {isLoadingOptions ? (
          <div className="space-y-4 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        ) : optionsError ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {optionsError}
          </div>
        ) : (
          <form
            onSubmit={form.handleSubmit(handleCreate)}
            className="space-y-4"
          >
            <FormField
              label={t("fullNameAr")}
              error={form.formState.errors.full_name_ar?.message}
              required
            >
              <Input {...form.register("full_name_ar")} />
            </FormField>

            <FormField label={t("fullNameEn")}>
              <Input {...form.register("full_name_en")} />
            </FormField>

            <FormField
              label={t("email")}
              error={form.formState.errors.email?.message}
              required
            >
              <Input type="email" {...form.register("email")} />
            </FormField>

            <FormField
              label={t("password")}
              error={form.formState.errors.password?.message}
              required
            >
              <Input
                type="password"
                autoComplete="new-password"
                {...form.register("password")}
              />
            </FormField>

            <FormField label={t("phone")}>
              <Input {...form.register("phone")} />
            </FormField>

            <FormField
              label={t("locale")}
              error={form.formState.errors.preferred_locale?.message}
            >
              <Select
                value={preferredLocale ?? "ar"}
                onValueChange={(value) =>
                  form.setValue("preferred_locale", value as "ar" | "en")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label={t("role")}
              error={form.formState.errors.roleId?.message}
              required
            >
              <Select value={selectedRoleId} onValueChange={handleRoleChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t("rolePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {roles.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      {t("noRoles")}
                    </div>
                  ) : (
                    roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name_ar}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </FormField>

            {requiresService ? (
              <FormField
                label={t("service")}
                error={form.formState.errors.serviceId?.message}
                required
              >
                <Select
                  value={selectedServiceId ?? ""}
                  onValueChange={handleServiceChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("servicePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {services.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        {t("noServices")}
                      </div>
                    ) : (
                      services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name_ar}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </FormField>
            ) : null}

            {isServant ? (
              <FormField
                label={t("stage")}
                error={form.formState.errors.stageId?.message}
                required
              >
                <Select
                  value={selectedStageId ?? ""}
                  onValueChange={(value) => {
                    if (typeof value === "string") form.setValue("stageId", value);
                  }}
                  disabled={!selectedServiceId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("stagePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {!selectedServiceId || serviceStages.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        {t("noStages")}
                      </div>
                    ) : (
                      serviceStages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name_ar}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </FormField>
            ) : null}

            {submitError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {submitError}
              </div>
            ) : null}

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                {t("cancel")}
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t("processing")}
                  </>
                ) : (
                  t("create")
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogPopup>
    </Dialog>
  );
}
