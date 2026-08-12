// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// Hoisted so the module factories below (which are hoisted above imports) can
// share the same spies as the assertions.
const mocks = vi.hoisted(() => ({
  attendanceList: vi.fn(),
  toggleMutate: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/features/children/hooks/use-attendance", () => ({
  useAttendanceList: (filters: unknown, enabled?: boolean) =>
    mocks.attendanceList(filters, enabled),
  useBatchAttendance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useToggleAttendance: () => ({ mutate: mocks.toggleMutate, isPending: false }),
}));

vi.mock("@/features/children/hooks/use-children", () => ({
  useChildServices: () => ({
    data: { data: [{ id: "service-1", name_ar: "Primary" }] },
  }),
  useChildStages: () => ({
    data: { data: [{ id: "stage-1", service_id: "service-1", name_ar: "Grade 6" }] },
  }),
  useChildList: () => ({
    data: {
      data: {
        data: [{ id: "child-1", full_name_ar: "Ahmed", full_name_en: null }],
      },
    },
    isLoading: false,
  }),
}));

vi.mock("@/features/rbac", () => ({
  PermissionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAccessState: () => ({
    data: { roles: [{ role_type: "super_admin" }], permissions: [] },
  }),
}));

import { AttendancePage } from "@/features/children/components/attendance-page";

describe("AttendancePage — date switching without a page refresh", () => {
  it("re-keys the attendance list for the newly selected date", async () => {
    mocks.attendanceList.mockReturnValue({ data: { data: [] }, error: null });

    const { container } = render(<AttendancePage />);
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput).not.toBeNull();

    // Pick a stage so the table + attendance list are enabled. The stage
    // placeholder text appears in both the field label and the trigger, so
    // target the last occurrence (the trigger).
    fireEvent.click(screen.getAllByText("selectStage").at(-1)!);
    fireEvent.click(await screen.findByText("Grade 6"));

    // The initial list request used today's default date (stage enabled).
    expect(mocks.attendanceList).toHaveBeenLastCalledWith(
      expect.objectContaining({ stage_id: "stage-1" }),
      true,
    );

    // Change the date to a different day.
    fireEvent.change(dateInput, {
      target: { value: "2026-09-11" },
    });

    // The list query must immediately target the NEW date (no refresh needed);
    // the query key is derived from these filters, so the refetch is automatic.
    expect(mocks.attendanceList).toHaveBeenLastCalledWith(
      { stage_id: "stage-1", from_date: "2026-09-11", to_date: "2026-09-11" },
      true,
    );
  });

  it("persists a one-tap status to the newly selected date's session", async () => {
    mocks.attendanceList.mockReturnValue({ data: { data: [] }, error: null });

    const { container } = render(<AttendancePage />);
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;

    fireEvent.click(screen.getAllByText("selectStage").at(-1)!);
    fireEvent.click(await screen.findByText("Grade 6"));

    fireEvent.change(dateInput, {
      target: { value: "2026-09-11" },
    });

    // One-tap (admin) mode: clicking a status must write the NEW date.
    fireEvent.click(screen.getByText("present"));
    expect(mocks.toggleMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        stage_id: "stage-1",
        service_id: "service-1",
        attendance_date: "2026-09-11",
        status: "present",
      }),
      expect.anything(),
    );
  });
});
