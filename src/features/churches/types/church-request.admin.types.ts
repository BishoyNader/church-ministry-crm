export type ChurchRequestRow = {
  id: string;
  church_name_ar: string;
  catechist_name: string;
  applicant_name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  decision_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ChurchRequestStatus = "pending" | "approved" | "rejected";
