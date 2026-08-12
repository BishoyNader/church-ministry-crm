"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  useUserDetail,
  useAssignServices,
  useAssignStages,
  useServices,
  useStages,
} from "../hooks/use-users";
import type { UserDetail } from "../types/user.types";

type UserAssignmentsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  churchId?: string;
};

/**
 * Unified servant assignment editor (الخدمات + المراحل).
 *
 * The controls are driven by the user's roles (050 rules):
 *   admin          -> multiple services, no stage
 *   stage_manager  -> exactly one service, no stage
 *   servant        -> exactly one service + exactly one stage in that service
 * super_admin / platform_owner show no assignment controls (church-wide).
 */
export function UserAssignmentsDialog({
  open,
  onOpenChange,
  userId,
  churchId,
}: UserAssignmentsDialogProps) {
  const t = useTranslations("users.assignments");
  const detailQuery = useUserDetail(userId, churchId);
  const user = detailQuery.data?.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { name: user?.full_name_ar ?? "" })}
          </DialogDescription>
        </DialogHeader>

        {detailQuery.isLoading ? (
          <div className="space-y-3 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : user ? (
          // Keyed by the user so the selection state initializes from the
          // latest assignments on every open.
          <UserAssignmentsForm
            key={userId}
            user={user}
            churchId={churchId}
            onSaved={() => onOpenChange(false)}
          />
        ) : null}
      </DialogPopup>
    </Dialog>
  );
}

type UserAssignmentsFormProps = {
  user: UserDetail;
  churchId?: string;
  onSaved: () => void;
};

function UserAssignmentsForm({
  user,
  churchId,
  onSaved,
}: UserAssignmentsFormProps) {
  const t = useTranslations("users.assignments");
  const assignServicesMutation = useAssignServices();
  const assignStagesMutation = useAssignStages();

  const scopeChurchId = churchId ?? user.church_id ?? null;
  const servicesQuery = useServices(scopeChurchId);
  const stagesQuery = useStages(scopeChurchId);
  const services = servicesQuery.data?.data ?? [];
  const stages = stagesQuery.data?.data ?? [];

  const roleTypes = user.roles.map((role) => role.role_type);
  const hasServant = roleTypes.includes("servant");
  const hasStageManager = roleTypes.includes("stage_manager");
  const hasAdmin = roleTypes.includes("admin");
  const requiresService = hasServant || hasStageManager || hasAdmin;
  const singleServiceMode = hasServant || hasStageManager;

  // Initial selection from the user's current active assignments. State is
  // initialized once at mount (the form is remounted on every open via the
  // parent's keyed render) — never synced in an effect.
  const [serviceIds, setServiceIds] = useState<string[]>(() => {
    const currentServices = user.serviceAssignments
      .filter((assignment) => assignment.is_active)
      .map((assignment) => assignment.service_id)
      .filter((id): id is string => id !== null);
    return singleServiceMode ? currentServices.slice(0, 1) : currentServices;
  });
  const [stageIds, setStageIds] = useState<string[]>(() =>
    user.stageAssignments
      .filter((assignment) => assignment.is_active)
      .map((assignment) => assignment.stage_id)
      .filter((id): id is string => id !== null)
      .slice(0, 1),
  );
  const [error, setError] = useState<string | null>(null);

  const selectedServiceId = singleServiceMode && serviceIds.length > 0 ? serviceIds[0] : null;
  const serviceStages = useMemo(
    () =>
      selectedServiceId
        ? stages.filter((stage) => stage.service_id === selectedServiceId)
        : [],
    [stages, selectedServiceId],
  );

  const toggleService = (serviceId: string) => {
    setServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId],
    );
  };

  const handleSave = async () => {
    setError(null);

    if (requiresService) {
      if (serviceIds.length === 0) {
        setError(t("serviceRequired"));
        return;
      }
      if (singleServiceMode && serviceIds.length !== 1) {
        setError(hasServant ? t("servantSingleService") : t("stageManagerSingleService"));
        return;
      }
      const serviceResult = await assignServicesMutation.mutateAsync({
        userId: user.id,
        serviceIds,
        churchId: scopeChurchId ?? undefined,
      });
      if (!serviceResult.success) {
        setError(serviceResult.message ?? t("saveError"));
        return;
      }
    }

    if (hasServant) {
      if (stageIds.length !== 1) {
        setError(t("stageRequired"));
        return;
      }
      const stageResult = await assignStagesMutation.mutateAsync({
        userId: user.id,
        stageIds,
        churchId: scopeChurchId ?? undefined,
      });
      if (!stageResult.success) {
        setError(stageResult.message ?? t("saveError"));
        return;
      }
    }

    onSaved();
  };

  const isPending =
    assignServicesMutation.isPending || assignStagesMutation.isPending;

  return (
    <div className="space-y-4 py-2">
      {roleTypes.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {user.roles.map((role) => (
            <span
              key={role.id}
              className="rounded-full border bg-muted px-2.5 py-0.5 text-xs"
            >
              {role.name_ar}
            </span>
          ))}
        </div>
      ) : null}

      {!requiresService ? (
        <div className="flex items-start gap-2 rounded-lg border border-muted bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {t("noAssignmentsNeeded")}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("services")} *</p>
            {servicesQuery.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : services.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noServices")}</p>
            ) : singleServiceMode ? (
              <Select
                value={selectedServiceId ?? ""}
                onValueChange={(value) => {
                  setServiceIds(value ? [value as string] : []);
                  setStageIds([]);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("selectService")} />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-1.5">
                {services.map((service) => (
                  <label
                    key={service.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 transition hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <Checkbox
                      checked={serviceIds.includes(service.id)}
                      onCheckedChange={() => toggleService(service.id)}
                    />
                    <span className="text-sm font-medium">{service.name_ar}</span>
                  </label>
                ))}
              </div>
            )}
            {singleServiceMode ? (
              <p className="text-xs text-muted-foreground">{t("singleServiceHint")}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{t("multiServiceHint")}</p>
            )}
          </div>

          {hasServant ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("stages")} *</p>
              <Select
                value={stageIds[0] ?? ""}
                onValueChange={(value) =>
                  setStageIds(value ? [value as string] : [])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("selectStage")} />
                </SelectTrigger>
                <SelectContent>
                  {serviceStages.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      {t("noStagesInService")}
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
              <p className="text-xs text-muted-foreground">{t("stageHint")}</p>
            </div>
          ) : null}
        </>
      )}

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>
          {t("cancel")}
        </DialogClose>
        <Button onClick={handleSave} disabled={isPending}>
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
    </div>
  );
}
