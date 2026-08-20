"use client";

import { useQuery } from "@tanstack/react-query";
import { getBillingSummaryAction } from "../actions/billing.actions";

export const BILLING_QUERY_KEYS = {
  billingSummary: ["billing", "summary"] as const,
  paymentRequests: ["billing", "payment-requests"] as const,
  invoices: ["billing", "invoices"] as const,
  refunds: ["billing", "refunds"] as const,
};

export function useBillingSummary() {
  return useQuery({
    queryKey: BILLING_QUERY_KEYS.billingSummary,
    queryFn: () => getBillingSummaryAction(),
    staleTime: 30_000,
  });
}
