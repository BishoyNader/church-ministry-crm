"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronLeft, ChevronRight, Copy, Rocket } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/layout/section-card";
import { SuccessState } from "@/components/feedback/success-state";
import { Link } from "@/i18n/navigation";
import { useDirection } from "@/lib/direction";
import { cn } from "@/lib/utils";
import { useProvisionChurchWizard } from "../hooks/use-churches";
import { provisionChurchWizardSchema } from "../schemas/provisioning.schema";
import type { ProvisionChurchWizardValues } from "../schemas/provisioning.schema";
import { ChurchConfigForm } from "./church-config-form";
import { ChurchAdminCreation } from "./church-admin-creation";
import { ChurchProvisioningSummary } from "./church-provisioning-summary";

const STORAGE_KEY = "cmc:church-provisioning-wizard";
const TOTAL_STEPS = 3;
const PROGRESS_STAGE_MS = 800;

type Phase = "form" | "provisioning" | "success" | "error";

const defaultValues: ProvisionChurchWizardValues = {
  churchNameAr: "",
  slug: "",
  contactEmail: "",
  contactPhone: "",
  addressAr: "",
  fullNameAr: "",
  fullNameEn: "",
  email: "",
  phone: "",
  password: "",
};

const STEP_FIELDS: Record<number, Array<keyof ProvisionChurchWizardValues>> = {
  1: ["churchNameAr", "slug", "contactEmail", "contactPhone", "addressAr"],
  2: ["fullNameAr", "fullNameEn", "email", "phone", "password"],
  3: [],
};

export function ChurchProvisioningWizard() {
  const t = useTranslations("churches");
  const dir = useDirection();
  const isRtl = dir === "rtl";

  const [step, setStep] = useState(1);
  const [phase, setPhase] = useState<Phase>("form");
  const [progressIndex, setProgressIndex] = useState(0);
  const [result, setResult] = useState<{ churchId: string; inviteLink: string | null } | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  const mutation = useProvisionChurchWizard();

  const form = useForm<ProvisionChurchWizardValues>({
    resolver: zodResolver(provisionChurchWizardSchema),
    mode: "onTouched",
    defaultValues,
  });

  const watchedJson = JSON.stringify(form.watch());

  // Restore persisted step + values on first mount so a refresh keeps progress.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          step?: number;
          values?: Partial<ProvisionChurchWizardValues>;
        };
        if (parsed.values && Object.keys(parsed.values).length > 0) {
          form.reset({ ...defaultValues, ...parsed.values });
        }
        if (parsed.step && parsed.step >= 1 && parsed.step <= TOTAL_STEPS) {
          setStep(parsed.step);
        }
      }
    } catch {
      // Malformed or unavailable persisted state — start fresh.
    }
  }, [form]);

  // Persist progress while editing.
  useEffect(() => {
    if (phase !== "form") return;
    try {
      const values = JSON.parse(watchedJson) as ProvisionChurchWizardValues;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ step, values }));
    } catch {
      // Session storage may be unavailable; the wizard still works.
    }
  }, [step, phase, watchedJson]);

  // Animate provisioning progress stages while the RPC runs.
  useEffect(() => {
    if (phase !== "provisioning") return;
    setProgressIndex(0);
    const interval = window.setInterval(() => {
      setProgressIndex((prev) => Math.min(TOTAL_STEPS, prev + 1));
    }, PROGRESS_STAGE_MS);
    return () => window.clearInterval(interval);
  }, [phase]);

  const clearStorage = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const goNext = async () => {
    const ok = await form.trigger(STEP_FIELDS[step]);
    if (!ok) return;
    setStep((prev) => Math.min(TOTAL_STEPS, prev + 1));
  };

  const goBack = () => {
    setStep((prev) => Math.max(1, prev - 1));
  };

  const confirmProvision = async () => {
    const ok = await form.trigger();
    if (!ok) return;
    setPhase("provisioning");
    setErrorCode(undefined);
    setErrorMessage(undefined);
    try {
      const res = await mutation.mutateAsync(form.getValues());
      if (res.success) {
        setResult(res.data ?? null);
        setPhase("success");
        clearStorage();
      } else {
        setErrorCode(res.code);
        setErrorMessage(res.message);
        setPhase("error");
      }
    } catch {
      setErrorCode("provision_failed");
      setErrorMessage(t("wizard.errors.provisionFailed"));
      setPhase("error");
    }
  };

  const resetWizard = () => {
    form.reset(defaultValues);
    setStep(1);
    setPhase("form");
    setResult(null);
    setErrorCode(undefined);
    setErrorMessage(undefined);
    setCopied(false);
    clearStorage();
  };

  const copyInviteLink = async () => {
    if (!result?.inviteLink) return;
    try {
      await navigator.clipboard.writeText(result.inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the link remains visible to copy manually.
    }
  };

  const stepLabels = [t("wizard.step1"), t("wizard.step2"), t("wizard.step3")];
  const progressLabels = [
    t("wizard.progress.creatingChurch"),
    t("wizard.progress.provisioningAdmin"),
    t("wizard.progress.finalizing"),
  ];

  let errorText: string;
  switch (errorCode) {
    case "not_platform_owner":
      errorText = t("wizard.errors.notPlatformOwner");
      break;
    case "not_authenticated":
      errorText = t("wizard.errors.notAuthenticated");
      break;
    case "auth_user_exists":
      errorText = t("wizard.errors.authUserExists");
      break;
    case "church_name_exists":
      errorText = t("wizard.errors.churchNameExists");
      break;
    case "auth_user_not_found":
    case "auth_user_email_mismatch":
      errorText = t("wizard.errors.authUserMismatch");
      break;
    case "invalid_slug":
      errorText = t("wizard.errors.invalidSlug");
      break;
    case "super_admin_role_not_found":
      errorText = t("wizard.errors.superAdminRoleNotFound");
      break;
    case "validation_error":
      errorText = t("wizard.errors.validation");
      break;
    case "missing_service_role":
      errorText = t("wizard.errors.missingServiceRole");
      break;
    default:
      errorText = errorMessage ?? t("wizard.errors.provisionFailed");
  }

  if (phase === "success" && result) {
    return (
      <section className="space-y-6">
        <PageHeader title={t("wizard.title")} description={t("wizard.description")} />

        <SectionCard>
          <SuccessState
            title={t("wizard.success.title")}
            description={t("wizard.success.description")}
            action={
              <div className="flex flex-col items-center gap-3">
                {result.inviteLink ? (
                  <div className="w-full max-w-md space-y-1.5 text-start">
                    <p className="text-sm text-muted-foreground">{t("wizard.success.inviteLinkLabel")}</p>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={result.inviteLink} dir="ltr" className="font-mono text-xs" />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={copyInviteLink}
                        aria-label={t("wizard.success.copyInviteLink")}
                      >
                        <Copy className="size-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{t("wizard.success.inviteLinkDescription")}</p>
                    <p className={cn("text-xs font-medium text-success transition-opacity", copied ? "opacity-100" : "opacity-0")}>
                      {t("wizard.success.copied")}
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Link href={`/admin/churches/${result.churchId}`}>
                    <Button type="button" variant="outline">
                      {t("wizard.success.viewChurch")}
                    </Button>
                  </Link>
                  <Link href="/admin/churches">
                    <Button type="button" variant="outline">
                      {t("wizard.success.backToChurches")}
                    </Button>
                  </Link>
                  <Button type="button" onClick={resetWizard}>
                    {t("wizard.success.provisionAnother")}
                  </Button>
                </div>
              </div>
            }
          />
        </SectionCard>
      </section>
    );
  }

  if (phase === "provisioning") {
    return (
      <section className="space-y-6">
        <PageHeader title={t("wizard.title")} description={t("wizard.description")} />

        <SectionCard>
          <div className="mx-auto max-w-md space-y-4 px-4 py-10">
            {progressLabels.map((label, index) => {
              const done = progressIndex > index;
              const active = progressIndex === index;
              return (
                <div key={index} className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full border",
                      done
                        ? "border-success/30 bg-success/10 text-success"
                        : active
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {done ? (
                      <Check className="size-4" />
                    ) : (
                      <span
                        className={cn(
                          "size-2 rounded-full bg-current",
                          active && "animate-pulse",
                        )}
                      />
                    )}
                  </div>
                  <p
                    className={cn(
                      "text-sm",
                      done || active ? "font-medium" : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </p>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </section>
    );
  }

  if (phase === "error") {
    return (
      <section className="space-y-6">
        <PageHeader title={t("wizard.title")} description={t("wizard.description")} />

        <SectionCard>
          <div className="mx-auto max-w-md space-y-4 px-4 py-10 text-center">
            <p role="alert" className="text-sm text-destructive">
              {errorText}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPhase("form");
                  setStep(TOTAL_STEPS);
                }}
              >
                {t("wizard.errors.backToReview")}
              </Button>
              <Button type="button" onClick={() => void confirmProvision()}>
                {t("wizard.errors.tryAgain")}
              </Button>
            </div>
          </div>
        </SectionCard>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader title={t("wizard.title")} description={t("wizard.description")} />

      <SectionCard>
        <ol className="flex flex-wrap items-center gap-2 px-4 py-4" aria-label={t("wizard.stepperLabel")}>
          {stepLabels.map((label, index) => {
            const stepNumber = index + 1;
            const isActive = step === stepNumber;
            const isDone = step > stepNumber;
            return (
              <li key={index} className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                      isActive
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : isDone
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-border text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {isDone ? <Check className="size-4" /> : stepNumber}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      !isActive && !isDone && "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                </div>
                {stepNumber < TOTAL_STEPS ? (
                  <span className="mx-1 h-px w-6 bg-border sm:w-10" aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ol>
      </SectionCard>

      <SectionCard className="p-4 sm:p-6">
        {step === 1 ? (
          <ChurchConfigForm form={form} />
        ) : step === 2 ? (
          <ChurchAdminCreation form={form} />
        ) : (
          <ChurchProvisioningSummary form={form} />
        )}
      </SectionCard>

      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" onClick={goBack} disabled={step === 1}>
          {isRtl ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          {t("wizard.back")}
        </Button>

        {step < TOTAL_STEPS ? (
          <Button type="button" onClick={() => void goNext()}>
            {t("wizard.next")}
            {isRtl ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
        ) : (
          <Button type="button" onClick={() => void confirmProvision()}>
            <Rocket className="size-4" />
            {t("wizard.summary.confirm")}
          </Button>
        )}
      </div>
    </section>
  );
}
