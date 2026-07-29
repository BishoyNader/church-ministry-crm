"use client";

import { useEffect, useState } from "react";
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
import { createChildSchema } from "../schemas/child.schema";
import type { CreateChildFormValues, UpdateChildFormValues } from "../schemas/child.schema";
import {
  useCreateChild,
  useUpdateChild,
  useChildMinistries,
  useChildStages,
} from "../hooks/use-children";
import type { ChildDetail } from "../types/child.types";
import { FormField } from "./form-field";

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
  child?: ChildDetail | null;
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
  const isEdit = !!child;

  const createMutation = useCreateChild();
  const updateMutation = useUpdateChild();
  const ministriesQuery = useChildMinistries();

  const form = useForm<CreateChildFormValues>({
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

  const [editStatus, setEditStatus] = useState<string>(
    child?.status ?? "active",
  );

  const [selectedMinistryId, setSelectedMinistryId] = useState<string>(
    child?.ministry_id ?? "",
  );
  const stagesQuery = useChildStages(
    selectedMinistryId || undefined,
  );

  useEffect(() => {
    if (isEdit && child) {
      form.reset({
        first_name_ar: child.first_name_ar,
        first_name_en: child.first_name_en ?? "",
        last_name_ar: child.last_name_ar,
        last_name_en: child.last_name_en ?? "",
        date_of_birth: child.date_of_birth ?? "",
        gender: child.gender ?? undefined,
        ministry_id: child.ministry_id,
        stage_id: child.stage_id,
        pipeline_stage: child.pipeline_stage,
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
      setEditStatus(child.status);
      setSelectedMinistryId(child.ministry_id);
    }
  }, [isEdit, child, form]);

  const handleCreate = async (values: CreateChildFormValues) => {
    const result = await createMutation.mutateAsync(values);
    if (result.success) onOpenChange(false);
  };

  const handleUpdate = async (values: CreateChildFormValues) => {
    if (!child) return;
    const updateValues: UpdateChildFormValues = {
      ...values,
      status: editStatus as UpdateChildFormValues["status"],
      pipeline_stage: values.pipeline_stage ?? child.pipeline_stage,
    };
    const result = await updateMutation.mutateAsync({
      childId: child.id,
      values: updateValues,
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

  const ministries = ministriesQuery.data?.data ?? [];
  const stages = stagesQuery.data?.data ?? [];

  const handleMinistryChange = (value: unknown) => {
    const val = value as string;
    form.setValue("ministry_id", val);
    setSelectedMinistryId(val);
    form.setValue("stage_id", "");
  };

  const handleGenderChange = (value: unknown) => {
    form.setValue("gender", value as "male" | "female");
  };

  const handleStageChange = (value: unknown) => {
    form.setValue("stage_id", value as string);
  };

  const handlePipelineChange = (value: unknown) => {
    form.setValue(
      "pipeline_stage",
      value as CreateChildFormValues["pipeline_stage"],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("editTitle") : t("createTitle")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(isEdit ? handleUpdate : handleCreate)}
          className="flex-1 overflow-y-auto space-y-4 pr-1"
        >
          <CollapsibleSection title={t("sections.personal")} defaultOpen>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label={t("firstNameAr")}
                error={form.formState.errors.first_name_ar?.message}
                required
              >
                <Input {...form.register("first_name_ar")} />
              </FormField>
              <FormField label={t("firstNameEn")}>
                <Input {...form.register("first_name_en")} />
              </FormField>
              <FormField
                label={t("lastNameAr")}
                error={form.formState.errors.last_name_ar?.message}
                required
              >
                <Input {...form.register("last_name_ar")} />
              </FormField>
              <FormField label={t("lastNameEn")}>
                <Input {...form.register("last_name_en")} />
              </FormField>
              <FormField label={t("dateOfBirth")}>
                <Input type="date" {...form.register("date_of_birth")} />
              </FormField>
              <FormField label={t("gender")}>
                <Select
                  value={form.watch("gender") ?? ""}
                  onValueChange={handleGenderChange}
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
                error={form.formState.errors.ministry_id?.message}
                required
              >
                <Select
                  value={form.watch("ministry_id")}
                  onValueChange={handleMinistryChange}
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
                error={form.formState.errors.stage_id?.message}
                required
              >
                <Select
                  value={form.watch("stage_id")}
                  onValueChange={handleStageChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("selectStage")} />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name_ar}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={t("pipelineStage")}>
                <Select
                  value={form.watch("pipeline_stage") ?? ""}
                  onValueChange={handlePipelineChange}
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
            {isEdit && (
              <FormField label="Status">
                <Select
                  value={editStatus}
                  onValueChange={(value) => setEditStatus(value as string)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {t(`../status.${opt}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
          </CollapsibleSection>

          <CollapsibleSection title={t("sections.parent")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label={t("fatherName")}>
                <Input {...form.register("father_name_ar")} />
              </FormField>
              <FormField label={t("motherName")}>
                <Input {...form.register("mother_name_ar")} />
              </FormField>
              <FormField label={t("parentPhone")}>
                <Input {...form.register("parent_phone")} />
              </FormField>
              <FormField label={t("parentEmail")}>
                <Input type="email" {...form.register("parent_email")} />
              </FormField>
              <FormField label={t("parentAddress")}>
                <Input {...form.register("parent_address_ar")} />
              </FormField>
              <FormField label={t("mobile")}>
                <Input {...form.register("mobile")} />
              </FormField>
              <FormField label={t("emergencyName")}>
                <Input {...form.register("emergency_contact_name")} />
              </FormField>
              <FormField label={t("emergencyPhone")}>
                <Input {...form.register("emergency_contact_phone")} />
              </FormField>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title={t("sections.medical")}>
            <FormField label={t("allergies")}>
              <Textarea {...form.register("allergies")} />
            </FormField>
            <FormField label={t("medicalConditions")}>
              <Textarea {...form.register("medical_conditions")} />
            </FormField>
            <FormField label={t("medications")}>
              <Textarea {...form.register("medications")} />
            </FormField>
          </CollapsibleSection>

          <CollapsibleSection title={t("sections.spiritual")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label={t("baptismDate")}>
                <Input type="date" {...form.register("baptism_date")} />
              </FormField>
              <FormField label={t("confessionFrequency")}>
                <Input {...form.register("confession_frequency")} />
              </FormField>
            </div>
            <FormField label={t("spiritualNotes")}>
              <Textarea {...form.register("spiritual_notes")} />
            </FormField>
          </CollapsibleSection>

          <CollapsibleSection title={t("sections.education")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label={t("schoolName")}>
                <Input {...form.register("school_name_ar")} />
              </FormField>
              <FormField label={t("gradeLevel")}>
                <Input {...form.register("grade_level")} />
              </FormField>
              <FormField label={t("photoUrl")}>
                <Input {...form.register("photo_url")} />
              </FormField>
            </div>
            <FormField label={t("notes")}>
              <Textarea {...form.register("notes")} />
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
      </DialogPopup>
    </Dialog>
  );
}
