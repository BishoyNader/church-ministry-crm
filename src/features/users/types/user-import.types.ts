export type UserImportFileFormat = "xlsx" | "csv";

export type UserImportRow = {
  rowNumber: number;
  email: string;
  password: string;
  fullNameAr: string;
  fullNameEn: string | null;
  phone: string | null;
  roleName: string | null;
  stageName: string | null;
};

export type UserImportValidationError = {
  rowNumber: number;
  field: string;
  message: string;
};

export type InvalidUserImportRow = {
  row: UserImportRow;
  errors: UserImportValidationError[];
};

export type UserImportErrorSummary = {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateEmails: number;
  invalidEmails: number;
  shortPasswords: number;
  missingRequired: number;
  unknownRoles: number;
  unknownStages: number;
};

export type UserImportValidationResult = {
  validRows: UserImportRow[];
  invalidRows: InvalidUserImportRow[];
  errorSummary: UserImportErrorSummary;
};

export type UserImportPreviewResult = {
  fileName: string;
  format: UserImportFileFormat;
  validation: UserImportValidationResult;
};

export type UserImportRowFailureReason =
  | "missing_role"
  | "duplicate"
  | "invalid_role"
  | "invalid_stage"
  | "auth_failed"
  | "rpc_failure";

export type UserImportRowFailure = {
  rowNumber: number;
  email: string;
  reason: UserImportRowFailureReason;
  message: string;
};

export type UserImportSummary = {
  importedCount: number;
  failedCount: number;
  failures: UserImportRowFailure[];
};
