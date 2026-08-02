"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { churchRequestSchema, type ChurchRequestFormValues } from "../schemas/church-request.schema";
import { submitChurchRequestAction } from "../actions/church-request.actions";

export function ChurchRequestForm({ locale }: { locale: string }) {
  const t = useTranslations("churches.request");
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChurchRequestFormValues>({
    resolver: zodResolver(churchRequestSchema),
  });

  const onSubmit = async (values: ChurchRequestFormValues) => {
    setFormError(null);
    setIsLoading(true);

    const result = await submitChurchRequestAction(values);

    if (!result.success) {
      if (result.message === "email_already_registered") {
        setFormError(t("errors.emailAlreadyRegistered"));
      } else if (result.message === "request_already_pending") {
        setFormError(t("errors.requestAlreadyPending"));
      } else if (result.message === "church_name_exists") {
        setFormError(t("errors.churchNameExists"));
      } else {
        setFormError(result.message ?? t("errors.general"));
      }
      setIsLoading(false);
      return;
    }

    setSubmitted(true);
    setIsLoading(false);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="rounded-full bg-success/10 p-4">
          <CheckCircle2 className="size-10 text-success" />
        </div>
        <h2 className="mt-6 text-2xl font-semibold tracking-tight">
          {t("success.title")}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {t("success.description")}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button render={<Link href={`/${locale}/signup`} />} variant="outline">
            <ArrowLeft className="size-4" />
            {t("success.backToSignup")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      {formError ? (
        <div role="alert" className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {formError}
        </div>
      ) : null}

      <div className="space-y-4">
        <FormField label={t("churchNameAr")} required error={errors.churchNameAr?.message}>
          <Input type="text" autoComplete="organization" {...register("churchNameAr")} className="h-11 rounded-xl px-4" />
        </FormField>

        <FormField label={t("catechistName")} required error={errors.catechistName?.message}>
          <Input type="text" autoComplete="name" {...register("catechistName")} className="h-11 rounded-xl px-4" />
        </FormField>

        <FormField label={t("applicantName")} required error={errors.applicantName?.message}>
          <Input type="text" autoComplete="name" {...register("applicantName")} className="h-11 rounded-xl px-4" />
        </FormField>

        <FormField label={t("email")} required error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register("email")} className="h-11 rounded-xl px-4" />
        </FormField>

        <FormField label={t("phone")} error={errors.phone?.message}>
          <Input type="tel" autoComplete="tel" dir="ltr" {...register("phone")} className="h-11 rounded-xl px-4" />
        </FormField>

        <FormField label={t("notes")} error={errors.notes?.message}>
          <Textarea rows={4} {...register("notes")} className="rounded-xl px-4 py-3" />
        </FormField>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? t("submitting") : t("submit")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href={`/${locale}/signup`} className="font-semibold text-primary hover:underline">
          {t("backToSignup")}
        </Link>
      </p>
    </form>
  );
}
