export type ImportEntityType = "beneficiaries";

export type ImportFileFormat = "xlsx" | "csv";

export type BeneficiaryImportRow = {
  rowNumber: number;
  name: string;
  phone: string | null;
  birthDate: string | null;
  gender: string | null;
  stage: string | null;
  className: string | null;
  address: string | null;
  notes: string | null;
};

export type ImportValidationError = {
  rowNumber: number;
  field: string;
  message: string;
};

export type InvalidImportRow = {
  row: BeneficiaryImportRow;
  errors: ImportValidationError[];
};

export type ImportErrorSummary = {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateNames: number;
  duplicatePhones: number;
  missingRequired: number;
  invalidDates: number;
  invalidGenders: number;
  unknownStages: number;
  unknownClasses: number;
};

export type ImportValidationResult = {
  validRows: BeneficiaryImportRow[];
  invalidRows: InvalidImportRow[];
  errorSummary: ImportErrorSummary;
};

export type ImportPreviewResult = {
  fileName: string;
  format: ImportFileFormat;
  validation: ImportValidationResult;
};

export type ImportRowFailureReason =
  | "duplicate"
  | "servant_not_found"
  | "stage_not_found"
  | "invalid_church_scope"
  | "rpc_failure"
  | "insert_failure";

export type ImportRowFailure = {
  rowNumber: number;
  name: string;
  reason: ImportRowFailureReason;
  message: string;
};

export type ImportSummary = {
  importedCount: number;
  skippedCount: number;
  failures: ImportRowFailure[];
};

export type ExportEntityType = "beneficiaries" | "attendance" | "followups" | "servants";

export type ExportFileFormat = "csv" | "xlsx";

export type ExportColumn = {
  key: string;
  label: string;
};

export type ExportOptions = {
  entity: ExportEntityType;
  format: ExportFileFormat;
};

export type ExportActionResult = {
  success: boolean;
  message?: string;
  data?: {
    fileName: string;
    content: string;
    mimeType: string;
  };
};

export type ImportActionErrorCode =
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE"
  | "UNAUTHORIZED"
  | "NO_PERMISSION"
  | "IMPORT_FAILED";

export type ImportActionResult<T = unknown> = {
  success: boolean;
  code?: ImportActionErrorCode;
  message?: string;
  data?: T;
};