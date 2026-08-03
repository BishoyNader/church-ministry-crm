import type { Database } from "@/types/database.types";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ChurchRow = Database["public"]["Tables"]["churches"]["Row"];
export type RoleRow = Database["public"]["Tables"]["roles"]["Row"];

export type ProfileSettings = {
  id: string;
  email: string | null;
  fullNameAr: string;
  fullNameEn: string | null;
  phone: string | null;
  preferredLocale: string;
  roles: Pick<RoleRow, "id" | "name_ar" | "name_en" | "role_type">[];
  church: Pick<ChurchRow, "id" | "name_ar" | "name_en"> | null;
};

export type ChurchSettings = Pick<
  ChurchRow,
  "id" | "name_ar" | "name_en" | "contact_email" | "contact_phone" | "address_ar" | "address_en" | "logo_url"
>;

export type UpdateProfileInput = {
  fullNameAr: string;
  fullNameEn?: string;
  phone?: string;
  preferredLocale: string;
};

export type UpdateChurchInput = {
  nameAr: string;
  nameEn?: string;
  contactEmail?: string;
  contactPhone?: string;
  addressAr?: string;
  addressEn?: string;
  logoUrl?: string;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};