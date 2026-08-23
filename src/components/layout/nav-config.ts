import {
  Users,
  UserRound,
  CalendarDays,
  BarChart3,
  Settings,
  ClipboardCheck,
  ClipboardList,
  Phone,
  HandHeart,
  BadgeCheck,
  Bell,
  BookOpen,
  ArrowLeftRight,
  ScrollText,
  Building2,
  School,
  LayoutDashboard,
  ArrowUpRight,
  Layers,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
// Imported directly from the constants module (not the feature barrel) so
// this config stays importable from lightweight contexts.
import { PERMISSION_CODES, type PermissionCode } from "@/features/rbac/constants/permissions";

export type NavSection =
  | "overview"
  | "ministry"
  | "people"
  | "operations"
  | "spiritual"
  | "administration";

export type NavItem = {
  labelKey: string;
  href: string;
  icon: LucideIcon;
  section: NavSection;
  permission?: PermissionCode;
  /** Optional role whitelist (role_type values). When present, the item is
   * hidden from every other role even if the permission is held — e.g.
   * servant attendance is restricted to Church Manager / sector admin / stage
   * manager, so plain servants never see a dead link. */
  roles?: string[];
  /** Role blacklist (role_type values). When present, the item is hidden from
   * these roles even if the permission is held — e.g. customer billing is a
   * church-customer experience; the Platform Owner administers billing from
   * the platform area instead of subscribing themselves. */
  hiddenRoles?: string[];
};

export const NAV_SECTIONS: NavSection[] = [
  "overview",
  "ministry",
  "people",
  "operations",
  "spiritual",
  "administration",
];

// Static label keys per section so the i18n checker can resolve them and
// the section headers stay type-safe.
export const SECTION_TITLE_KEYS: Record<NavSection, string> = {
  overview: "sectionOverview",
  ministry: "sectionMinistry",
  people: "sectionPeople",
  operations: "sectionOperations",
  spiritual: "sectionSpiritual",
  administration: "sectionAdministration",
};

export const navItems: NavItem[] = [
  { labelKey: "dashboard", href: "/dashboard", icon: BarChart3, section: "overview", permission: PERMISSION_CODES.REPORTS_READ },
  { labelKey: "reports", href: "/reports", icon: BarChart3, section: "overview", permission: PERMISSION_CODES.REPORTS_READ },
  { labelKey: "adminDashboard", href: "/admin/dashboard", icon: LayoutDashboard, section: "overview", permission: PERMISSION_CODES.TENANTS_READ },
  { labelKey: "services", href: "/services", icon: Building2, section: "ministry", permission: PERMISSION_CODES.SERVICES_READ },
  { labelKey: "stages", href: "/stages", icon: Layers, section: "ministry", permission: PERMISSION_CODES.SERVICES_READ },
  { labelKey: "classes", href: "/classes", icon: School, section: "ministry", permission: PERMISSION_CODES.CLASSES_READ },
  { labelKey: "events", href: "/events", icon: CalendarDays, section: "ministry", permission: PERMISSION_CODES.EVENTS_READ },
  { labelKey: "children", href: "/children", icon: UserRound, section: "people", permission: PERMISSION_CODES.BENEFICIARIES_READ },
  { labelKey: "followups", href: "/followups", icon: Phone, section: "people", permission: PERMISSION_CODES.FOLLOWUPS_READ },
  { labelKey: "servantRecords", href: "/servants", icon: HandHeart, section: "people", permission: PERMISSION_CODES.SERVANTS_READ },
  { labelKey: "users", href: "/users", icon: Users, section: "people", permission: PERMISSION_CODES.USERS_READ },
  { labelKey: "attendance", href: "/attendance", icon: ClipboardCheck, section: "operations", permission: PERMISSION_CODES.ATTENDANCE_READ },
  { labelKey: "servantAttendance", href: "/servant-attendance", icon: ClipboardList, section: "operations", permission: PERMISSION_CODES.ATTENDANCE_READ, roles: ["super_admin", "admin", "stage_manager"] },
  { labelKey: "approvals", href: "/approvals", icon: BadgeCheck, section: "operations", permission: PERMISSION_CODES.SERVANTS_APPROVE },
  { labelKey: "promotions", href: "/promotions", icon: ArrowUpRight, section: "operations", permission: PERMISSION_CODES.SETTINGS_UPDATE },
  { labelKey: "spiritualJournal", href: "/spiritual-journal", icon: BookOpen, section: "spiritual", permission: PERMISSION_CODES.SPIRITUAL_READ },
  { labelKey: "churches", href: "/admin/churches", icon: Building2, section: "administration", permission: PERMISSION_CODES.TENANTS_READ },
  { labelKey: "churchRequests", href: "/admin/church-requests", icon: ClipboardList, section: "administration", permission: PERMISSION_CODES.TENANTS_READ },
  { labelKey: "importExport", href: "/import-export", icon: ArrowLeftRight, section: "administration", permission: PERMISSION_CODES.IMPORT_EXECUTE },
  { labelKey: "audit", href: "/audit", icon: ScrollText, section: "administration", permission: PERMISSION_CODES.AUDIT_READ },
  { labelKey: "notifications", href: "/notifications", icon: Bell, section: "administration", permission: PERMISSION_CODES.NOTIFICATIONS_READ },
  { labelKey: "settings", href: "/settings", icon: Settings, section: "administration", permission: PERMISSION_CODES.SETTINGS_READ },
  // Customer billing is a Church Manager (customer) experience only — the
  // Platform Owner manages billing via /admin/billing below.
  { labelKey: "billing", href: "/billing", icon: CreditCard, section: "administration", permission: PERMISSION_CODES.BILLING_READ, hiddenRoles: ["platform_owner"] },
  { labelKey: "platformBilling", href: "/admin/billing", icon: CreditCard, section: "administration", permission: PERMISSION_CODES.SUBSCRIPTIONS_MANAGE },
];

/**
 * Filters navigation items by the user's permissions and roles.
 * Pure function so role/permission visibility rules are unit-testable.
 */
export function visibleNavItems(
  items: NavItem[],
  permissionSet: ReadonlySet<string>,
  roleTypes: ReadonlySet<string>,
): NavItem[] {
  return items.filter((item) => {
    if (item.permission && !permissionSet.has(item.permission)) {
      return false;
    }
    if (item.roles && !item.roles.some((role) => roleTypes.has(role))) {
      return false;
    }
    if (item.hiddenRoles && item.hiddenRoles.some((role) => roleTypes.has(role))) {
      return false;
    }
    return true;
  });
}
