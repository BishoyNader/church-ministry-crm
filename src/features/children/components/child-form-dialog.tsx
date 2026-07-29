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
  useChildMinistries,
  useChildStages,
} from "../hooks/use-children";
import type { ChildListItem } from "../types/child.types";
import { FormField } from "@/features/stages/components/form-field";

const PIPELINE_OPTIONS = [
  "new_visitor",
  "first_followup",
  "regular_attendee",
  "active_member",
  "leader_candidate",
] as const;

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
  const tPipeline = useTranslations("children.pipeline");
  const tStatus = useTranslations("children.status");
  const isEdit = !!child;

  const createMutation = useCreateChild();
  const updateMutation = useUpdateChild();
  const ministriesQuery = useChildMinistries();
  const ministries = ministriesQuery.data?.data ?? [];

  const createForm = useForm<CreateChildFormValues>({
    resolver: zodResolver(createChildSchema),
    defaultValues: {
      first_name_ar: "",
      first_name_en: "",
      last_name_ar: "",
      last_name_en: "",
      date_of_birth: "",
      gender: undefined,
      ministry_id: "",
      stage_id: "",
      pipeline_stage: undefined,
      parent_phone: "",
      parent_email: "",
      parent_address_ar: "",
      father_name_ar: "",
      mother_name_ar: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      mobile: "",
      allergies: "",
      medical_conditions: "",
      medications: "",
      baptism_date: "",
      confession_frequency: "",
      spiritual_notes: "",
      school_name_ar: "",
      grade_level: "",
      notes: "",
      photo_url: "",
    },
  });

  const createWatchMinistryId = createForm.watch("ministry_id");
  const createStagesQuery = useChildStages(createWatchMinistryId || undefined);
  const createStages = createStagesQuery.data?.data ?? [];

  const updateForm = useForm<UpdateChildFormValues>({
    resolver: zodResolver(updateChildSchema),
    defaultValues: {
      first_name_ar: "",
      first_name_en: "",
      last_name_ar: "",
      last_name_en: "",
      date_of_birth: "",
      gender: undefined,
      ministry_id: "",
      stage_id: "",
      pipeline_stage: "new_visitor",
      status: "active",
      parent_phone: "",
      parent_email: "",
      parent_address_ar: "",
      father_name_ar: "",
      mother_name_ar: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      mobile: "",
      allergies: "",
      medical_conditions: "",
      medications: "",
      baptism_date: "",
      confession_frequency: "",
      spiritual_notes: "",
      school_name_ar: "",
      grade_level: "",
      notes: "",
      photo_url: "",
    },
  });

  const updateWatchMinistryId = updateForm.watch("ministry_id");
  const updateStagesQuery = useChildStages(updateWatchMinistryId || undefined);
  const updateStages = updateStagesQuery.data?.data ?? [];

  useEffect(() => {
    if (isEdit && child) {
      updateForm.reset({
        first_name_ar: child.first_name_ar,
        first_name_en: child.first_name_en ?? "",
        last_name_ar: child.last_name_ar,
        last_name_en: child.last_name_en ?? "",
        date_of_birth: child.date_of_birth ?? "",
        gender: child.gender ?? undefined,
        ministry_id: child.ministry_id,
        stage_id: child.stage_id,
        pipeline_stage: child.pipeline_stage,
        status: child.status,
        parent_phone: child.parent_phone ?? "",
        parent_email: child.parent_email ?? "",
        parent_address_ar: child.parent_address_ar ?? "",
        father_name_ar: child.father_name_ar ?? "",
        mother_name_ar: child.mother_name_ar ?? "",
        emergency_contact_name: child.emergency_contact_name ?? "",
        emergency_contact_phone: child.emergency_contact_phone ?? "",
        mobile: child.mobile ?? "",
        allergies: child.allergies ?? "",
        medical_conditions: child.medical_conditions ?? "",
        medications: child.medications ?? "",
        baptism_date: child.baptism_date ?? "",
        confession_frequency: child.confession_frequency ?? "",
        spiritual_notes: child.spiritual_notes ?? "",
        school_name_ar: child.school_name_ar ?? "",
        grade_level: child.grade_level ?? "",
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
                  label={t("firstNameAr")}
                  error={updateForm.formState.errors.first_name_ar?.message}
                  required
                >
                  <Input {...updateForm.register("first_name_ar")} />
                </FormField>
                <FormField label={t("firstNameEn")}>
                  <Input {...updateForm.register("first_name_en")} />
                </FormField>
                <FormField
                  label={t("lastNameAr")}
                  error={updateForm.formState.errors.last_name_ar?.message}
                  required
                >
                  <Input {...updateForm.register("last_name_ar")} />
                </FormField>
                <FormField label={t("lastNameEn")}>
                  <Input {...updateForm.register("last_name_en")} />
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
                  label={t("ministry")}
                  error={updateForm.formState.errors.ministry_id?.message}
                  required
                >
                  <Select
                    value={updateForm.watch("ministry_id")}
                    onValueChange={(value) => {
                      updateForm.setValue("ministry_id", value as string);
                      updateForm.setValue("stage_id", "");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("selectMinistry")} />
                    </SelectTrigger>
                    <SelectContent>
                      {ministries.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name_ar}
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
                <FormField label={t("pipelineStage")}>
                  <Select
                    value={updateForm.watch("pipeline_stage") ?? ""}
                    onValueChange={(value) =>
                      updateForm.setValue(
                        "pipeline_stage",
                        value as UpdateChildFormValues["pipeline_stage"],
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("selectPipeline")} />
                    </SelectTrigger>
                    <SelectContent>
                      {PIPELINE_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {tPipeline(opt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Status">
                  <Select
                    value={updateForm.watch("status")}
                    onValueChange={(value) =>
                      updateForm.setValue("status", value as UpdateChildFormValues["status"])
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

            <CollapsibleSection title={t("sections.parent")}>
              <div className={sectionClasses}>
                <FormField label={t("fatherName")}>
                  <Input {...updateForm.register("father_name_ar")} />
                </FormField>
                <FormField label={t("motherName")}>
                  <Input {...updateForm.register("mother_name_ar")} />
                </FormField>
                <FormField label={t("parentPhone")}>
                  <Input {...updateForm.register("parent_phone")} />
                </FormField>
                <FormField label={t("parentEmail")}>
                  <Input type="email" {...updateForm.register("parent_email")} />
                </FormField>
                <FormField label={t("parentAddress")}>
                  <Input {...updateForm.register("parent_address_ar")} />
                </FormField>
                <FormField label={t("mobile")}>
                  <Input {...updateForm.register("mobile")} />
                </FormField>
                <FormField label={t("emergencyName")}>
                  <Input {...updateForm.register("emergency_contact_name")} />
                </FormField>
                <FormField label={t("emergencyPhone")}>
                  <Input {...updateForm.register("emergency_contact_phone")} />
                </FormField>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title={t("sections.medical")}>
              <FormField label={t("allergies")}>
                <Textarea {...updateForm.register("allergies")} />
              </FormField>
              <FormField label={t("medicalConditions")}>
                <Textarea {...updateForm.register("medical_conditions")} />
              </FormField>
              <FormField label={t("medications")}>
                <Textarea {...updateForm.register("medications")} />
              </FormField>
            </CollapsibleSection>

            <CollapsibleSection title={t("sections.spiritual")}>
              <div className={sectionClasses}>
                <FormField label={t("baptismDate")}>
                  <Input type="date" {...updateForm.register("baptism_date")} />
                </FormField>
                <FormField label={t("confessionFrequency")}>
                  <Input {...updateForm.register("confession_frequency")} />
                </FormField>
              </div>
              <FormField label={t("spiritualNotes")}>
                <Textarea {...updateForm.register("spiritual_notes")} />
              </FormField>
            </CollapsibleSection>

            <CollapsibleSection title={t("sections.education")}>
              <div className={sectionClasses}>
                <FormField label={t("schoolName")}>
                  <Input {...updateForm.register("school_name_ar")} />
                </FormField>
                <FormField label={t("gradeLevel")}>
                  <Input {...updateForm.register("grade_level")} />
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
                  label={t("firstNameAr")}
                  error={createForm.formState.errors.first_name_ar?.message}
                  required
                >
                  <Input {...createForm.register("first_name_ar")} />
                </FormField>
                <FormField label={t("firstNameEn")}>
                  <Input {...createForm.register("first_name_en")} />
                </FormField>
                <FormField
                  label={t("lastNameAr")}
                  error={createForm.formState.errors.last_name_ar?.message}
                  required
                >
                  <Input {...createForm.register("last_name_ar")} />
                </FormField>
                <FormField label={t("lastNameEn")}>
                  <Input {...createForm.register("last_name_en")} />
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
                  label={t("ministry")}
                  error={createForm.formState.errors.ministry_id?.message}
                  required
                >
                  <Select
                    value={createForm.watch("ministry_id")}
                    onValueChange={(value) => {
                      createForm.setValue("ministry_id", value as string);
                      createForm.setValue("stage_id", "");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("selectMinistry")} />
                    </SelectTrigger>
                    <SelectContent>
                      {ministries.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name_ar}
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
                <FormField label={t("pipelineStage")}>
                  <Select
                    value={createForm.watch("pipeline_stage") ?? ""}
                    onValueChange={(value) =>
                      createForm.setValue(
                        "pipeline_stage",
                        value as CreateChildFormValues["pipeline_stage"],
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("selectPipeline")} />
                    </SelectTrigger>
                    <SelectContent>
                      {PIPELINE_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {tPipeline(opt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title={t("sections.parent")}>
              <div className={sectionClasses}>
                <FormField label={t("fatherName")}>
                  <Input {...createForm.register("father_name_ar")} />
                </FormField>
                <FormField label={t("motherName")}>
                  <Input {...createForm.register("mother_name_ar")} />
                </FormField>
                <FormField label={t("parentPhone")}>
                  <Input {...createForm.register("parent_phone")} />
                </FormField>
                <FormField label={t("parentEmail")}>
                  <Input type="email" {...createForm.register("parent_email")} />
                </FormField>
                <FormField label={t("parentAddress")}>
                  <Input {...createForm.register("parent_address_ar")} />
                </FormField>
                <FormField label={t("mobile")}>
                  <Input {...createForm.register("mobile")} />
                </FormField>
                <FormField label={t("emergencyName")}>
                  <Input {...createForm.register("emergency_contact_name")} />
                </FormField>
                <FormField label={t("emergencyPhone")}>
                  <Input {...createForm.register("emergency_contact_phone")} />
                </FormField>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title={t("sections.medical")}>
              <FormField label={t("allergies")}>
                <Textarea {...createForm.register("allergies")} />
              </FormField>
              <FormField label={t("medicalConditions")}>
                <Textarea {...createForm.register("medical_conditions")} />
              </FormField>
              <FormField label={t("medications")}>
                <Textarea {...createForm.register("medications")} />
              </FormField>
            </CollapsibleSection>

            <CollapsibleSection title={t("sections.spiritual")}>
              <div className={sectionClasses}>
                <FormField label={t("baptismDate")}>
                  <Input type="date" {...createForm.register("baptism_date")} />
                </FormField>
                <FormField label={t("confessionFrequency")}>
                  <Input {...createForm.register("confession_frequency")} />
                </FormField>
              </div>
              <FormField label={t("spiritualNotes")}>
                <Textarea {...createForm.register("spiritual_notes")} />
              </FormField>
            </CollapsibleSection>

            <CollapsibleSection title={t("sections.education")}>
              <div className={sectionClasses}>
                <FormField label={t("schoolName")}>
                  <Input {...createForm.register("school_name_ar")} />
                </FormField>
                <FormField label={t("gradeLevel")}>
                  <Input {...createForm.register("grade_level")} />
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
