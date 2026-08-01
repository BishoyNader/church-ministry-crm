"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
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
  createFollowupSchema,
  updateFollowupSchema,
} from "../schemas/child.schema";
import type {
  CreateFollowupFormValues,
  UpdateFollowupFormValues,
} from "../schemas/child.schema";
import { useCreateFollowup, useUpdateFollowup } from "../hooks/use-followups";
import { useChildList } from "../hooks/use-children";
import { listUsersAction } from "../actions/child.actions";
import type { FollowupListItem } from "../types/child.types";
import { FormField } from "@/components/ui/form-field";

const FOLLOWUP_TYPES = [
  "phone_call",
  "home_visit",
  "whatsapp",
  "church_meeting",
  "other",
] as const;

const FOLLOWUP_STATUSES = [
  "open",
  "in_progress",
  "completed",
  "cancelled",
] as const;

type FollowupFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  followup?: FollowupListItem | null;
};

export function FollowupFormDialog({
  open,
  onOpenChange,
  followup,
}: FollowupFormDialogProps) {
  const t = useTranslations("children");
  const tDetail = useTranslations("children.detail");
  const isEdit = !!followup;

  const createMutation = useCreateFollowup();
  const updateMutation = useUpdateFollowup();

  const { data: childrenResult } = useChildList({}, { pageSize: 500 });
  const children = childrenResult?.data?.data ?? [];



  const { data: usersResult } = useQuery({
    queryKey: ["users", "list"],
    queryFn: () => listUsersAction(),
    staleTime: 60_000,
  });
  const users = usersResult?.data ?? [];

  const createForm = useForm<CreateFollowupFormValues>({
    resolver: zodResolver(createFollowupSchema),
    defaultValues: {
      beneficiary_id: "",
      type: undefined,
      scheduled_at: "",
      assigned_to: "",
      notes: "",
    },
  });

  const updateForm = useForm<UpdateFollowupFormValues>({
    resolver: zodResolver(updateFollowupSchema),
    defaultValues: {
      status: undefined,
      scheduled_at: "",
      assigned_to: "",
      notes: "",
      outcome: "",
    },
  });

  useEffect(() => {
    if (isEdit && followup) {
      updateForm.reset({
        status: followup.status,
        scheduled_at: followup.scheduled_at ?? "",
        assigned_to: followup.assigned_to ?? "",
        notes: followup.notes ?? "",
        outcome: followup.outcome ?? "",
      });
    }
  }, [isEdit, followup, updateForm]);

  useEffect(() => {
    if (!open) {
      createForm.reset();
      updateForm.reset();
    }
  }, [open, createForm, updateForm]);

  const handleCreate = async (values: CreateFollowupFormValues) => {
    const result = await createMutation.mutateAsync(values);
    if (result.success) onOpenChange(false);
  };

  const handleUpdate = async (values: UpdateFollowupFormValues) => {
    if (!followup) return;
    const result = await updateMutation.mutateAsync({
      followupId: followup.id,
      values,
    });
    if (result.success) onOpenChange(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const formError =
    createMutation.data?.message || updateMutation.data?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("followups.editTitle") : t("followups.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("followups.formDescription")}
          </DialogDescription>
        </DialogHeader>

        {isEdit ? (
          <form
            onSubmit={updateForm.handleSubmit(handleUpdate)}
            className="space-y-4"
          >
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {followup?.childFullNameAr}
              </span>
              {" / "}
              {followup?.type ? tDetail(`followupType.${followup.type}`) : "\u2014"}
            </div>

            <FormField
              label={t("followups.status")}
              error={updateForm.formState.errors.status?.message}
              required
            >
              <Select
                value={updateForm.watch("status") ?? ""}
                onValueChange={(value) =>
                  updateForm.setValue(
                    "status",
                    value as UpdateFollowupFormValues["status"],
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("followups.selectStatus")} />
                </SelectTrigger>
                <SelectContent>
                  {FOLLOWUP_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {tDetail(`followupStatus.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label={t("followups.scheduledAt")}>
              <Input type="date" {...updateForm.register("scheduled_at")} />
            </FormField>

            <FormField label={t("followups.assignedTo")}>
              <Select
                value={updateForm.watch("assigned_to") ?? ""}
                onValueChange={(value) =>
                  updateForm.setValue("assigned_to", value as string)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("followups.selectAssignedTo")} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label={t("followups.notes")}>
              <Textarea {...updateForm.register("notes")} />
            </FormField>

            <FormField label={t("followups.outcome")}>
              <Textarea {...updateForm.register("outcome")} />
            </FormField>

            {formError ? (
              <p className="text-xs text-destructive">{formError}</p>
            ) : null}

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                {t("followups.cancel")}
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? t("followups.processing") : t("followups.save")}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form
            onSubmit={createForm.handleSubmit(handleCreate)}
            className="space-y-4"
          >
            <FormField
              label={t("followups.child")}
              error={createForm.formState.errors.beneficiary_id?.message}
              required
            >
              <Select
                value={createForm.watch("beneficiary_id")}
                onValueChange={(value) =>
                  createForm.setValue("beneficiary_id", value as string)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("followups.selectChild")} />
                </SelectTrigger>
                <SelectContent>
                  {children.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label={t("followups.type")}
              error={createForm.formState.errors.type?.message}
              required
            >
              <Select
                value={createForm.watch("type") ?? ""}
                onValueChange={(value) =>
                  createForm.setValue(
                    "type",
                    value as CreateFollowupFormValues["type"],
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("followups.selectType")} />
                </SelectTrigger>
                <SelectContent>
                  {FOLLOWUP_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {tDetail(`followupType.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label={t("followups.scheduledAt")}>
              <Input type="date" {...createForm.register("scheduled_at")} />
            </FormField>

            <FormField label={t("followups.assignedTo")}>
              <Select
                value={createForm.watch("assigned_to") ?? ""}
                onValueChange={(value) =>
                  createForm.setValue("assigned_to", value as string)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("followups.selectAssignedTo")} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label={t("followups.notes")}>
              <Textarea {...createForm.register("notes")} />
            </FormField>

            {formError ? (
              <p className="text-xs text-destructive">{formError}</p>
            ) : null}

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                {t("followups.cancel")}
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? t("followups.processing") : t("followups.save")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogPopup>
    </Dialog>
  );
}
