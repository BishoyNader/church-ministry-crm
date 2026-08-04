"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Combobox } from "@base-ui/react/combobox";
import { signupSchema } from "../schemas/auth.schema";
import type { AuthActionResult } from "../actions/auth.actions";
import type { SignupFormValues } from "../types/auth.types";
import { useChurchesForSignup } from "@/features/churches/hooks/use-churches";

type ChurchOption = { id: string; name_ar: string };

export function SignupForm({
  action,
  locale,
}: {
  action: (values: SignupFormValues, locale: string) => Promise<AuthActionResult>;
  locale: string;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const churchesQuery = useChurchesForSignup();
  const churches = (churchesQuery.data?.data ?? []) as ChurchOption[];

  const [comboboxOpen, setComboboxOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { churchId: "" },
  });

  const onSubmit = async (values: SignupFormValues) => {
    setFormError(null);
    setIsLoading(true);

    const result = await action(values, locale);

    if (!result.success) {
      setFormError(result.message ?? t("generalError"));
      setIsLoading(false);
      return;
    }

    if (result.redirectTo) {
      router.push(result.redirectTo);
    }

    setIsLoading(false);
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      {formError ? (
        <div role="alert" className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {formError}
        </div>
      ) : null}

      <div className="space-y-4">
        <FormField label={t("signup.church")} required error={errors.churchId?.message} hint={t("signup.churchHint")} htmlFor="signup-church">
          <Controller
            control={control}
            name="churchId"
            render={({ field }) => (
              <Combobox.Root<ChurchOption>
                items={churches}
                open={comboboxOpen}
                onOpenChange={setComboboxOpen}
                itemToStringLabel={(value) => value.name_ar}
                itemToStringValue={(value) => value.id}
                filter={(church, query) =>
                  church.name_ar
                    .toLocaleLowerCase()
                    .includes(query.toLocaleLowerCase())
                }
                onValueChange={(value) => {
                  if (value) {
                    field.onChange(value.id);
                  }
                }}
                onOpenChangeComplete={(open) => {
                  if (!open) field.onBlur();
                }}
                autoHighlight
              >
                <div className="relative">
                  <Combobox.Input
                    id="signup-church"
                    placeholder={t("signup.selectChurch")}
                    onClick={() => setComboboxOpen(true)}
                    className="h-11 w-full rounded-xl border border-input bg-transparent pe-9 ps-4 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 opacity-50" />
                </div>
                <Combobox.Portal>
                  <Combobox.Positioner sideOffset={6} className="z-50">
                    <Combobox.Popup
                      className="w-[var(--anchor-width)] min-w-[16rem] rounded-xl border border-border-whisper bg-popover p-1 text-popover-foreground shadow-diffused-md"
                    >
                      {churchesQuery.isLoading ? (
                        <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" />
                          {t("signup.loadingChurches")}
                        </div>
                      ) : (
                        <>
                          <Combobox.List className="max-h-64 overflow-y-auto p-0.5">
                            {(church) => (
                              <Combobox.Item
                                key={church.id}
                                value={church}
                                className="flex cursor-default select-none items-baseline gap-2 rounded-lg px-3 py-2 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                              >
                                <span className="truncate">{church.name_ar}</span>
                              </Combobox.Item>
                            )}
                          </Combobox.List>
                          <Combobox.Empty>
                            <div className="px-3 py-2.5 text-sm text-muted-foreground">
                              {t("signup.noChurches")}
                            </div>
                          </Combobox.Empty>
                          <div
                            className="my-1 h-px bg-border"
                            role="separator"
                            aria-orientation="horizontal"
                          />
                          <button
                            type="button"
                            onClick={() => router.push(`/${locale}/church-request`)}
                            className="flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
                          >
                            <Plus className="size-4" />
                            {t("signup.requestNewChurch")}
                          </button>
                        </>
                      )}
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
            )}
          />
        </FormField>

        <FormField label={t("signup.fullNameAr")} required error={errors.fullNameAr?.message}>
          <Input type="text" autoComplete="name" {...register("fullNameAr")} className="h-11 rounded-xl px-4" />
        </FormField>

        <FormField label={t("signup.fullNameEn")} error={errors.fullNameEn?.message}>
          <Input type="text" autoComplete="name" {...register("fullNameEn")} className="h-11 rounded-xl px-4" />
        </FormField>

        <FormField label={t("signup.email")} required error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register("email")} className="h-11 rounded-xl px-4" />
        </FormField>

        <FormField label={t("signup.phone")} required error={errors.phone?.message}>
          <Input type="tel" autoComplete="tel" dir="ltr" {...register("phone")} className="h-11 rounded-xl px-4" />
        </FormField>

        <FormField label={t("signup.password")} required error={errors.password?.message}>
          <Input type="password" autoComplete="new-password" {...register("password")} className="h-11 rounded-xl px-4" />
        </FormField>

        <FormField label={t("signup.confirmPassword")} required error={errors.confirmPassword?.message}>
          <Input type="password" autoComplete="new-password" {...register("confirmPassword")} className="h-11 rounded-xl px-4" />
        </FormField>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading || churchesQuery.isLoading}>
        {isLoading ? t("loading") : t("signup.submit")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t("signup.haveAccount")} <Link href={`/${locale}/login`} className="font-semibold text-primary hover:underline">{t("signup.signIn")}</Link>
      </p>
    </form>
  );
}
