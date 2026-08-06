"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
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

type UserFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  churchId?: string;
};

export function UserForm({ open, onOpenChange, userId, churchId }: UserFormProps) {
  const t = useTranslations("users.form");
  const isEdit = !!userId;

  const detailQuery = useUserDetail(userId ?? null, churchId);
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();

  const user = detailQuery.data?.data;
  const actorChurchQuery = useActorChurch();
  const scopeChurchId = isEdit
    ? (user?.church_id ?? null)
    : (churchId ?? actorChurchQuery.data?.churchId ?? null);

  const rolesQuery = useRoles(scopeChurchId);
  const stagesQuery = useStages(scopeChurchId);

  const roles = rolesQuery.data?.data ?? [];
  const stages = stagesQuery.data?.data ?? [];

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
      roleIds: [],
      stageIds: [],
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

  const handleCreate = async (values: CreateUserFormValues) => {
    const result = await createMutation.mutateAsync(values);
    if (result.success) onOpenChange(false);
  };

  const handleUpdate = async (values: UpdateUserFormValues) => {
    if (!userId) return;
    const result = await updateMutation.mutateAsync({ userId, values });
    if (result.success) onOpenChange(false);
  };

  const isLoading = isEdit && detailQuery.isLoading;
  const isPending = createMutation.isPending || updateMutation.isPending;

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

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                {t("cancel")}
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? t("processing") : t("save")}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
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

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                {t("cancel")}
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? t("processing") : t("create")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogPopup>
    </Dialog>
  );
}

