import { z } from "zod";

// Options mirror the backend's BillingInterval / RateType / PaymentType enums.
// Kept as const tuples so both the zod validators and the form's dropdowns share
// one source.
export const BILLING_INTERVALS = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "biannually",
  "annually",
] as const;

export const RATE_TYPES = ["variable", "fixed"] as const;

export const PAYMENT_TYPES = ["prepaid", "postpaid"] as const;

// Human-friendly labels for the enums above, shared by the lease form's
// dropdowns and the read-only lease detail view.
export const INTERVAL_LABELS: Record<(typeof BILLING_INTERVALS)[number], string> =
  {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    biannually: "Biannually",
    annually: "Annually",
  };

export const RATE_LABELS: Record<(typeof RATE_TYPES)[number], string> = {
  variable: "Variable",
  fixed: "Fixed",
};

export const PAYMENT_LABELS: Record<(typeof PAYMENT_TYPES)[number], string> = {
  prepaid: "Prepaid",
  postpaid: "Postpaid",
};

// A recurring charge on the lease (e.g. rent). Amount is kept as a string in the
// form (a native number input still emits "", which must read as "required"
// rather than coercing to 0); parse with Number() on submit.
const leaseTermSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => Number.isInteger(Number(v)), "Amount must be a whole number")
    .refine((v) => Number(v) >= 0, "Amount can't be negative"),
  interval: z.enum(BILLING_INTERVALS),
  rate: z.enum(RATE_TYPES),
  type: z.enum(PAYMENT_TYPES),
});

// Form validation for creating a lease (the client-side analog of the backend's
// Pydantic LeaseCreate). `effective_from` is kept as a "YYYY-MM-DD" string from
// a native date input and converted to an ISO datetime on submit. New leases
// are created active, so `terminated_on` is not part of this form.
export const leaseFormSchema = z.object({
  unit_id: z.string().min(1, "Unit is required"),
  account_id: z.string().min(1, "Tenant is required"),
  effective_from: z.string().min(1, "Start date is required"),
  // Optional recurring charges created alongside the lease.
  terms: z.array(leaseTermSchema),
});

export type LeaseFormValues = z.infer<typeof leaseFormSchema>;
export type LeaseTermFormValues = z.infer<typeof leaseTermSchema>;
