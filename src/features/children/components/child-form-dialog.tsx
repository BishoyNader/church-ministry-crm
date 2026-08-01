"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  createChildSchema,
  updateChildSchema,
} from "../schemas/child.schema";
import type {
  CreateChildFormValues,
  UpdateChildFormValues,
} from "../schemas/child.schema";
import {
  useCreateChild,
  useUpdateChild,
  useChildServices,
  useChildStages,
} from "../hooks/use-children";
import type { ChildListItem } from "../types/child.types";
import { FormField } from "@/components/ui/form-field";

const STATUS_OPTIONS = ["active", "inactive", "transferred", "graduated"] as const;

type ChildFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  child?: ChildListItem | null;
};

function CollapsibleSection({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex cursor-pointer items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5 text-sm font-semibold select-none">
        {title}
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 px-1 pt-4 pb-2">{children}</div>
    </details>
  );
}

export function ChildFormDialog({
  open,
  onOpenChange,
  child,
}: ChildFormDialogProps) {
  const t = useTranslations("children.form");
  const tStatus = useTranslations("children.status");
  const isEdit = !!child;

  const createMutation = useCreateChild();
  const updateMutation = useUpdateChild();
  const servicesQuery = useChildServices();
  const services = servicesQuery.data?.data ?? [];

  const createForm = useForm<CreateChildFormValues>({
    resolver: zodResolver(createChildSchema),
    defaultValues: {
      full_name_ar: "",
      full_name_en: "",
      date_of_birth: "",
      gender: undefined,
      service_id: "",
      stage_id: "",
      father_mobile: "",
      mother_mobile: "",
      mobile: "",
      whatsapp: "",
      address: "",
      school: "",
      confession_father: "",
      notes: "",
      photo_url: "",
    },
  });

  const createWatchServiceId = createForm.watch("service_id");
  const createStagesQuery = useChildStages(createWatchServiceId || undefined);
  const createStages = createStagesQuery.data?.data ?? [];

  const updateForm = useForm<UpdateChildFormValues>({
    resolver: zodResolver(updateChildSchema),
    defaultValues: {
      full_name_ar: "",
      full_name_en: "",
      date_of_birth: "",
      gender: undefined,
      service_id: "",
      stage_id: "",
      status: "active",
      father_mobile: "",
      mother_mobile: "",
      mobile: "",
      whatsapp: "",
      address: "",
      school: "",
      confession_father: "",
      notes: "",
      photo_url: "",
    },
  });

  const updateWatchServiceId = updateForm.watch("service_id");
  const updateStagesQuery = useChildStages(updateWatchServiceId || undefined);
  const updateStages = updateStagesQuery.data?.data ?? [];

  useEffect(() => {
    if (isEdit && child) {
      const c = child as Record<string, unknown>;
      updateForm.reset({
        full_name_ar: child.full_name_ar,
        full_name_en: child.full_name_en ?? "",
        date_of_birth: child.date_of_birth ?? "",
        gender: child.gender ?? undefined,
        service_id: (c.service_id as string) ?? "",
        stage_id: (c.stage_id as string) ?? "",
        status: child.status,
        father_mobile: child.father_mobile ?? "",
        mother_mobile: child.mother_mobile ?? "",
        mobile: child.mobile ?? "",
        whatsapp: child.whatsapp ?? "",
        address: child.address ?? "",
        school: child.school ?? "",
        confession_father: child.confession_father ?? "",
        notes: child.notes ?? "",
        photo_url: child.photo_url ?? "",
      });
    }
  }, [isEdit, child, updateForm]);

  const handleCreate = async (values: CreateChildFormValues) => {
    const result = await createMutation.mutateAsync(values);
    if (result.success) onOpenChange(false);
  };

  const handleUpdate = async (values: UpdateChildFormValues) => {
    if (!child) return;
    const result = await updateMutation.mutateAsync({
      childId: child.id,
      values,
    });
    if (result.success) onOpenChange(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const formError =
    createMutation.data?.success === false
      ? createMutation.data.message
      : updateMutation.data?.success === false
        ? updateMutation.data.message
        : null;

  const sectionClasses = "grid grid-cols-1 gap-4 sm:grid-cols-2";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("editTitle") : t("createTitle")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {isEdit ? (
          <form
            onSubmit={updateForm.handleSubmit(handleUpdate)}
            className="flex-1 overflow-y-auto space-y-4 pr-1"
          >
            <CollapsibleSection title={t("sections.personal")} defaultOpen>
              <div className={sectionClasses}>
                <FormField
                  label={t("fullNameAr")}
                  error={updateForm.formState.errors.full_name_ar?.message}
                  required
                >
                  <Input {...updateForm.register("full_name_ar")} />
                </FormField>
                <FormField label={t("fullNameEn")}>
                  <Input {...updateForm.register("full_name_en")} />
                </FormField>
                <FormField label={t("dateOfBirth")}>
                  <Input type="date" {...updateForm.register("date_of_birth")} />
                </FormField>
                <FormField label={t("gender")}>
                  <Select
                    value={updateForm.watch("gender") ?? ""}
                    onValueChange={(value) => updateForm.setValue("gender", value as "male" | "female")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("gender")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t("genderMale")}</SelectItem>
                      <SelectItem value="female">{t("genderFemale")}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField
                  label={t("service")}
                  error={updateForm.formState.errors.service_id?.message}
                  required
                >
                  <Select
                    value={updateForm.watch("service_id")}
                    onValueChange={(value) => {
                      updateForm.setValue("service_id", value as string);
                      updateForm.setValue("stage_id", "");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("selectService")} />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name_ar}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField
                  label={t("stage")}
                  error={updateForm.formState.errors.stage_id?.message}
                  required
                >
                  <Select
                    value={updateForm.watch("stage_id")}
                    onValueChange={(value) => updateForm.setValue("stage_id", value as string)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("selectStage")} />
                    </SelectTrigger>
                    <SelectContent>
                      {updateStages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name_ar}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Status">
                  <Select
                    value={updateForm.watch("status")}
                    onValueChange={(value) =>
                      updateForm.setValue("status", value as string)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {tStatus(opt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title={t("sections.contact")}>
              <div className={sectionClasses}>
                <FormField label={t("fatherMobile")}>
                  <Input {...updateForm.register("father_mobile")} />
                </FormField>
                <FormField label={t("motherMobile")}>
                  <Input {...updateForm.register("mother_mobile")} />
                </FormField>
                <FormField label={t("mobile")}>
                  <Input {...updateForm.register("mobile")} />
                </FormField>
                <FormField label={t("whatsapp")}>
                  <Input {...updateForm.register("whatsapp")} />
                </FormField>
                <FormField label={t("address")}>
                  <Input {...updateForm.register("address")} />
                </FormField>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title={t("sections.other")}>
              <div className={sectionClasses}>
                <FormField label={t("school")}>
                  <Input {...updateForm.register("school")} />
                </FormField>
                <FormField label={t("confessionFather")}>
                  <Input {...updateForm.register("confession_father")} />
                </FormField>
                <FormField label={t("photoUrl")}>
                  <Input {...updateForm.register("photo_url")} />
                </FormField>
              </div>
              <FormField label={t("notes")}>
                <Textarea {...updateForm.register("notes")} />
              </FormField>
            </CollapsibleSection>

            {formError && (
              <p className="text-xs text-destructive">{formError}</p>
            )}

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
          <form
            onSubmit={createForm.handleSubmit(handleCreate)}
            className="flex-1 overflow-y-auto space-y-4 pr-1"
          >
            <CollapsibleSection title={t("sections.personal")} defaultOpen>
              <div className={sectionClasses}>
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
                <FormField label={t("dateOfBirth")}>
                  <Input type="date" {...createForm.register("date_of_birth")} />
                </FormField>
                <FormField label={t("gender")}>
                  <Select
                    value={createForm.watch("gender") ?? ""}
                    onValueChange={(value) => createForm.setValue("gender", value as "male" | "female")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("gender")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t("genderMale")}</SelectItem>
                      <SelectItem value="female">{t("genderFemale")}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField
                  label={t("service")}
                  error={createForm.formState.errors.service_id?.message}
                  required
                >
                  <Select
                    value={createForm.watch("service_id")}
                    onValueChange={(value) => {
                      createForm.setValue("service_id", value as string);
                      createForm.setValue("stage_id", "");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("selectService")} />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name_ar}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField
                  label={t("stage")}
                  error={createForm.formState.errors.stage_id?.message}
                  required
                >
                  <Select
                    value={createForm.watch("stage_id")}
                    onValueChange={(value) => createForm.setValue("stage_id", value as string)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("selectStage")} />
                    </SelectTrigger>
                    <SelectContent>
                      {createStages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name_ar}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title={t("sections.contact")}>
              <div className={sectionClasses}>
                <FormField label={t("fatherMobile")}>
                  <Input {...createForm.register("father_mobile")} />
                </FormField>
                <FormField label={t("motherMobile")}>
                  <Input {...createForm.register("mother_mobile")} />
                </FormField>
                <FormField label={t("mobile")}>
                  <Input {...createForm.register("mobile")} />
                </FormField>
                <FormField label={t("whatsapp")}>
                  <Input {...createForm.register("whatsapp")} />
                </FormField>
                <FormField label={t("address")}>
                  <Input {...createForm.register("address")} />
                </FormField>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title={t("sections.other")}>
              <div className={sectionClasses}>
                <FormField label={t("school")}>
                  <Input {...createForm.register("school")} />
                </FormField>
                <FormField label={t("confessionFather")}>
                  <Input {...createForm.register("confession_father")} />
                </FormField>
                <FormField label={t("photoUrl")}>
                  <Input {...createForm.register("photo_url")} />
                </FormField>
              </div>
              <FormField label={t("notes")}>
                <Textarea {...createForm.register("notes")} />
              </FormField>
            </CollapsibleSection>

            {formError && (
              <p className="text-xs text-destructive">{formError}</p>
            )}

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                {t("cancel")}
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? t("processing") : t("save")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogPopup>
    </Dialog>
  );
}
