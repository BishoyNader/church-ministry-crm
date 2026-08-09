"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { Checkbox } from "@/components/ui/checkbox";
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
import { createUserSchema, updateUserSchema } from "../schemas/user.schema";
import type { CreateUserFormValues, UpdateUserFormValues } from "../schemas/user.schema";
import {
  useCreateUser,
  useUpdateUser,
  useUserDetail,
  useRoles,
  useStages,
  useActorChurch,
} from "../hooks/use-users";
import { useChurchList, useChurchDetail } from "@/features/churches/hooks/use-churches";

type UserFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  churchId?: string;
  /**
   * Roles preselected when the form opens in create mode (e.g. the Church
   * Manager flow presets the super_admin role for the selected church).
   */
  presetRoleIds?: string[];
  /** Called after a successful create/update (the dialog has already closed). */
  onSuccess?: () => void;
};

export function UserForm({
  open,
  onOpenChange,
  userId,
  churchId,
  presetRoleIds,
  onSuccess,
}: UserFormProps) {
  const t = useTranslations("users.form");
  const ct = useTranslations("churches");
  const isEdit = !!userId;

  const [submitError, setSubmitError] = useState<string | null>(null);

  const detailQuery = useUserDetail(userId ?? null, churchId);
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();

  const user = detailQuery.data?.data;
  const actorChurchQuery = useActorChurch();
  const isPlatformOwner = actorChurchQuery.data?.isPlatformOwner ?? false;

  const createForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      password: "",
      full_name_ar: "",
      full_name_en: "",
      phone: "",
      preferred_locale: "ar",
      churchId: churchId ?? undefined,
      roleIds: presetRoleIds ?? [],
      stageIds: [],
      confirmReplaceManager: false,
    },
  });

  const updateForm = useForm<UpdateUserFormValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      full_name_ar: "",
      full_name_en: "",
      phone: "",
      preferred_locale: "ar",
      is_active: true,
    },
  });

  useEffect(() => {
    if (isEdit && user) {
      updateForm.reset({
        full_name_ar: user.full_name_ar,
        full_name_en: user.full_name_en ?? "",
        phone: user.phone ?? "",
        preferred_locale: user.preferred_locale as "ar" | "en",
        is_active: user.is_active,
      });
    }
  }, [isEdit, user, updateForm]);

  // The Platform Owner (church_id NULL) can create users for any church. When no
  // church is preselected (e.g. the global /users page), the form shows a church
  // selector so the target tenant is explicit before choosing roles/stages.
  const watchedChurchId = createForm.watch("churchId");
  const scopeChurchId = isEdit
    ? (user?.church_id ?? null)
    : (churchId ?? watchedChurchId ?? actorChurchQuery.data?.churchId ?? null);

  // The PO is global: list ALL churches they are authorized to manage — the
  // same source as Church Management (all statuses, no status filter; the
  // service caps page size at 100, far beyond any real church count). A church
  // must never disappear from the selector because of its status or because it
  // currently has zero users.
  const churchesQuery = useChurchList(
    { pageSize: 100 },
    { enabled: isPlatformOwner && !isEdit && !churchId },
  );
  const churches = churchesQuery.data?.data?.rows ?? [];

  const churchStatusLabel = (status: string): string => {
    switch (status) {
      case "active":
        return ct("statusActive");
      case "inactive":
        return ct("statusInactive");
      case "suspended":
        return ct("statusSuspended");
      case "disabled":
        return ct("statusDisabled");
      default:
        return status;
    }
  };

  const rolesQuery = useRoles(scopeChurchId);
  const stagesQuery = useStages(scopeChurchId);

  const roles = rolesQuery.data?.data ?? [];
  const stages = stagesQuery.data?.data ?? [];

  // Manager replacement warning: shown whenever this creation would replace an
  // existing Church Manager — for the PO (any selected church) and for church
  // actors (their own church). The server-side gate in createUserAction applies
  // to every authorized creation path, so this mirrors it exactly.
  const managerChurchId = !isEdit ? (scopeChurchId ?? "") : "";
  const churchDetailQuery = useChurchDetail(managerChurchId);
  const manager = churchDetailQuery.data?.data?.manager ?? null;
  const superAdminRole = roles.find((role) => role.role_type === "super_admin");
  const selectedRoleIds = createForm.watch("roleIds");
  const showManagerWarning =
    !isEdit &&
    !!scopeChurchId &&
    !!superAdminRole &&
    selectedRoleIds.includes(superAdminRole.id) &&
    !!manager;

  const handleCreate = async (values: CreateUserFormValues) => {
    setSubmitError(null);
    const result = await createMutation.mutateAsync(values);
    if (result.success) {
      onOpenChange(false);
      onSuccess?.();
    } else {
      setSubmitError(result.message ?? null);
    }
  };

  const handleUpdate = async (values: UpdateUserFormValues) => {
    if (!userId) return;
    setSubmitError(null);
    const result = await updateMutation.mutateAsync({ userId, values, churchId });
    if (result.success) {
      onOpenChange(false);
      onSuccess?.();
    } else {
      setSubmitError(result.message ?? null);
    }
  };

  const isLoading = isEdit && detailQuery.isLoading;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const errorBanner = submitError ? (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      {submitError}
    </div>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        ) : isEdit ? (
          <form onSubmit={updateForm.handleSubmit(handleUpdate)} className="space-y-4">
            <FormField
              label={t("fullNameAr")}
              error={updateForm.formState.errors.full_name_ar?.message}
            >
              <Input {...updateForm.register("full_name_ar")} />
            </FormField>

            <FormField label={t("fullNameEn")}>
              <Input {...updateForm.register("full_name_en")} />
            </FormField>

            <FormField label={t("phone")}>
              <Input {...updateForm.register("phone")} />
            </FormField>

            <FormField label={t("locale")}>
              <Select
                value={updateForm.watch("preferred_locale")}
                onValueChange={(val) => updateForm.setValue("preferred_locale", val as "ar" | "en")}
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

            <div className="flex items-center gap-2">
              <Checkbox
                id="is_active"
                checked={updateForm.watch("is_active")}
                onCheckedChange={(checked) => updateForm.setValue("is_active", !!checked)}
              />
              <Label htmlFor="is_active">{t("active")}</Label>
            </div>

            {errorBanner}

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
                  t("save")
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
            {isPlatformOwner && !churchId ? (
              <FormField
                label={t("church")}
                error={createForm.formState.errors.churchId?.message}
                required
              >
                <Select
                  value={watchedChurchId ?? ""}
                  onValueChange={(val) => {
                    createForm.setValue("churchId", val as string);
                    // Roles/stages are church-scoped; clear stale selections from
                    // a previously selected church.
                    createForm.setValue("roleIds", []);
                    createForm.setValue("stageIds", []);
                    createForm.setValue("confirmReplaceManager", false);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("churchPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {churchesQuery.isLoading ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        {t("loadingChurches")}
                      </div>
                    ) : churches.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        {t("noChurches")}
                      </div>
                    ) : (
                      churches.map((church) => (
                        <SelectItem key={church.id} value={church.id}>
                          <span className="flex items-center gap-2">
                            <span className="truncate">{church.name_ar}</span>
                            <span className="text-xs text-muted-foreground">
                              {churchStatusLabel(church.status)}
                              {church.manager ? ` · ${church.manager.fullNameAr}` : ""}
                            </span>
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </FormField>
            ) : null}

            {!scopeChurchId ? (
              <div className="flex items-start gap-2 rounded-lg border border-muted bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" />
                {t("selectChurchFirst")}
              </div>
            ) : null}

            <FormField
              label={t("email")}
              error={createForm.formState.errors.email?.message}
              required
            >
              <Input type="email" {...createForm.register("email")} />
            </FormField>

            <FormField
              label={t("password")}
              error={createForm.formState.errors.password?.message}
              required
            >
              <Input type="password" autoComplete="new-password" {...createForm.register("password")} />
            </FormField>

            <FormField
              label={t("fullNameAr")}
              error={createForm.formState.errors.full_name_ar?.message}
              required
            >
              <Input {...createForm.register("full_name_ar")} />
            </FormField>

            <FormField label={t("fullNameEn")}>
              <Input {...createForm.register("full_name_en")} />
            </FormField>

            <FormField label={t("phone")}>
              <Input {...createForm.register("phone")} />
            </FormField>

            <FormField label={t("locale")}>
              <Select
                value={createForm.watch("preferred_locale")}
                onValueChange={(val) => createForm.setValue("preferred_locale", val as "ar" | "en")}
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

            <div className="space-y-2">
              <Label>{t("roles")} *</Label>
              {rolesQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              ) : roles.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noRoles")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {roles.map((role) => (
                    <label
                      key={role.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <Checkbox
                        checked={createForm.watch("roleIds").includes(role.id)}
                        onCheckedChange={(checked) => {
                          const current = createForm.getValues("roleIds");
                          createForm.setValue(
                            "roleIds",
                            checked
                              ? [...current, role.id]
                              : current.filter((id) => id !== role.id),
                          );
                        }}
                      />
                      {role.name_ar}
                    </label>
                  ))}
                </div>
              )}
              {createForm.formState.errors.roleIds?.message && (
                <p className="text-xs text-destructive">{createForm.formState.errors.roleIds.message}</p>
              )}
            </div>

            {stages.length > 0 && (
              <div className="space-y-2">
                <Label>{t("stages")}</Label>
                <div className="flex flex-wrap gap-2">
                  {stages.map((stage) => (
                    <label
                      key={stage.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <Checkbox
                        checked={createForm.watch("stageIds")?.includes(stage.id) ?? false}
                        onCheckedChange={(checked) => {
                          const current = createForm.getValues("stageIds") ?? [];
                          createForm.setValue(
                            "stageIds",
                            checked
                              ? [...current, stage.id]
                              : current.filter((id) => id !== stage.id),
                          );
                        }}
                      />
                      {stage.name_ar}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {showManagerWarning ? (
              <div className="space-y-2 rounded-lg border border-amber-300/50 bg-amber-50 p-4 dark:bg-amber-950/20">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="size-4" />
                  {t("managerWarningTitle")}
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {t("managerWarning", { name: manager?.fullNameAr ?? manager?.email ?? "" })}
                </p>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
                  <Checkbox
                    checked={createForm.watch("confirmReplaceManager") ?? false}
                    onCheckedChange={(checked) =>
                      createForm.setValue("confirmReplaceManager", !!checked)
                    }
                  />
                  {t("confirmReplaceManager")}
                </label>
              </div>
            ) : null}

            {errorBanner}

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
