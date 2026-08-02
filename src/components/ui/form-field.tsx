"use client";

import { cloneElement, isValidElement, useId, type ReactNode } from "react";

import { Label } from "@/components/ui/label";

type FormFieldProps = {
  label: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
};

export function FormField({
  label,
  error,
  required,
  htmlFor,
  hint,
  children,
}: FormFieldProps) {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  const child = isValidElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>(children)
    ? cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? `${id}-error` : undefined,
      })
    : children;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {child}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
