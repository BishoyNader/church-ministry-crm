import { Select as SelectPrimitive } from "@base-ui/react/select"
import { Check, ChevronDown } from "lucide-react"
import * as React from "react"
import { Children, cloneElement, isValidElement } from "react"

import { cn } from "@/lib/utils"

function Select(props: SelectPrimitive.Root.Props<unknown>) {
  const {
    id,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedby,
    children,
    ...rest
  } = props as SelectPrimitive.Root.Props<unknown> & {
    id?: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  };

  const childrenWithLabel = Children.map(children, (child) => {
    if (isValidElement(child) && child.type === SelectTrigger) {
      return cloneElement(
        child as React.ReactElement<
          SelectPrimitive.Trigger.Props & {
            id?: string;
            "aria-invalid"?: boolean;
            "aria-describedby"?: string;
          }
        >,
        {
          id,
          "aria-invalid": ariaInvalid,
          "aria-describedby": ariaDescribedby,
        },
      );
    }
    return child;
  });
  return (
    <SelectPrimitive.Root
      data-slot="select"
      {...(rest as SelectPrimitive.Root.Props<unknown>)}
    >
      {childrenWithLabel}
    </SelectPrimitive.Root>
  );
}

function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-9 min-h-11 sm:min-h-9 w-full items-center justify-between whitespace-nowrap rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown className="size-4 opacity-50" />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  ...props
}: SelectPrimitive.Popup.Props) {
  return (
    <SelectPrimitive.Portal>
      {/*
        z-index lives on the POSITIONER, not just the popup. Base UI renders the
        positioner as `position: fixed` (alignItemWithTrigger mode), and a fixed
        element forms its own stacking context, so the popup's own `z-50` is
        trapped INSIDE that context and cannot escape it. When a Select opens
        inside a Dialog (e.g. the Add-User church picker), the dialog's z-50
        backdrop would otherwise paint ON TOP of the popup — the dropdown opens
        but the options are invisible and unclickable. Giving the positioner the
        same overlay tier as the dialog content lifts the whole subtree above the
        backdrop. (Verified in browser: popup z-index changes alone do nothing;
        positioner z-50 fixes the hit-test and pointer events.)
      */}
      <SelectPrimitive.Positioner
        data-slot="select-positioner"
        className="z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            className,
          )}
          {...props}
        >
          {children}
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-md py-2 min-h-11 sm:min-h-0 sm:py-1.5 ps-2 pe-8 text-sm outline-none focus-visible:bg-accent focus-visible:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute end-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.Label.Props) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("px-2 py-1.5 text-sm font-semibold", className)}
      {...props}
    />
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-separator"
      className={cn("-mx-1 my-1 h-px bg-muted", className)}
      {...props}
    />
  )
}

function SelectValue({
  className,
  ...props
}: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("truncate", className)}
      {...props}
    />
  )
}

export {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
