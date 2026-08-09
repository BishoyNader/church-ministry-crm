// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { PermissionGuard } from "@/features/rbac/components/PermissionGuard";
import type { PermissionCode } from "@/features/rbac/constants/permissions";

vi.mock("@/features/rbac/hooks/usePermissions", () => ({
  usePermissions: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { usePermissions } from "@/features/rbac/hooks/usePermissions";

const mockedUsePermissions = vi.mocked(usePermissions);

const messages = {
  rbac: {
    accessDenied: {
      title: "Access required",
      description: "You do not have permission to view this page.",
      backToDashboard: "Back to dashboard",
    },
  },
};

function renderGuard(permission: PermissionCode, children: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PermissionGuard permission={permission}>{children}</PermissionGuard>
    </NextIntlClientProvider>,
  );
}

describe("PermissionGuard", () => {
  it("renders children when the permission is granted", () => {
    mockedUsePermissions.mockReturnValue({
      data: { permissions: [{ code: "services.read" }] },
      isLoading: false,
    } as never);

    renderGuard("services.read", <div>Secret content</div>);

    expect(screen.getByText("Secret content")).toBeInTheDocument();
    expect(screen.queryByText("Access required")).not.toBeInTheDocument();
  });

  it("renders the access-denied state when the permission is missing", () => {
    mockedUsePermissions.mockReturnValue({
      data: { permissions: [] },
      isLoading: false,
    } as never);

    renderGuard("services.read", <div>Secret content</div>);

    expect(screen.getByText("Access required")).toBeInTheDocument();
    expect(screen.queryByText("Secret content")).not.toBeInTheDocument();
  });

  it("renders a status region while permissions are loading", () => {
    mockedUsePermissions.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);

    renderGuard("services.read", <div>Secret content</div>);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Secret content")).not.toBeInTheDocument();
  });
});
