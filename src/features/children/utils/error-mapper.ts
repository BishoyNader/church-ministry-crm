// Locale-aware error mapping for the child (beneficiary) server actions.
//
// Two layers of failures are surfaced to the UI:
//   1. Database RPC codes raised by the SECURITY DEFINER write RPCs (024/039):
//      create_beneficiary_with_assignment and transfer_beneficiary
//      (RAISE EXCEPTION 'source_stage_access_denied' etc). PostgREST returns
//      them verbatim in the error .message.
//   2. App-layer gate failures produced by the server actions themselves when
//      an actor is blocked before an RPC is even called (missing permission,
//      out-of-scope source/destination stage).
//
// Both are mapped to next-intl keys under `children.errors` so the server
// action can return a message in the requester's locale. Unknown messages pass
// through unchanged.

export const CHILD_RPC_ERROR_KEYS: Readonly<Record<string, string>> = {
  not_authenticated: "notAuthenticated",
  profile_not_found: "profileNotFound",
  full_name_required: "fullNameRequired",
  service_not_found: "serviceNotFound",
  stage_not_found: "stageNotFound",
  beneficiary_not_found: "beneficiaryNotFound",
  stage_service_mismatch: "stageServiceMismatch",
  not_authorized: "notAuthorized",
  stage_access_denied: "stageAccessDenied",
  source_stage_access_denied: "sourceStageAccessDenied",
  destination_stage_access_denied: "destinationStageAccessDenied",
  servant_not_found: "servantNotFound",
};

export const CHILD_ACTION_ERROR_KEYS: Readonly<Record<string, string>> = {
  createStageDenied: "createStageDenied",
  transferPermissionDenied: "transferPermissionDenied",
  transferFromStageDenied: "transferFromStageDenied",
  transferToStageDenied: "transferToStageDenied",
};

const CHILD_ERROR_KEYS: Readonly<Record<string, string>> = {
  ...CHILD_RPC_ERROR_KEYS,
  ...CHILD_ACTION_ERROR_KEYS,
};

export function mapChildErrorKey(message: string): string | null {
  return CHILD_ERROR_KEYS[message] ?? null;
}

export function isChildRpcError(message: string): boolean {
  return Object.prototype.hasOwnProperty.call(CHILD_RPC_ERROR_KEYS, message);
}
