import { z } from "zod";

// A line item on a bill (e.g. rent, utilities), covering its own service
// period. Amount is kept as a string in the form (a native number input still
// emits "", which must read as "required" rather than coercing to 0); parse
// with Number() on submit. Dates are kept as "YYYY-MM-DD" strings from native
// date inputs; the API accepts that format directly. The end-before-start rule
// mirrors the backend's validation.
const billItemSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    amount: z
      .string()
      .min(1, "Amount is required")
      .refine((v) => Number.isInteger(Number(v)), "Amount must be a whole number")
      .refine((v) => Number(v) >= 0, "Amount can't be negative"),
    start_date: z.string().min(1, "Start date is required"),
    end_date: z.string().min(1, "End date is required"),
    // Optional link to a recurring lease term on the bill's lease. Empty string
    // means "no link"; converted to undefined (omitted) on submit.
    lease_term_id: z.string().optional(),
  })
  .refine((v) => v.start_date <= v.end_date, {
    message: "End date can't be before the start date",
    path: ["end_date"],
  });

// Form validation for creating a bill (the client-side analog of the backend's
// Pydantic BillCreate). The bill's date is kept as a "YYYY-MM-DD" string from a
// native date input; the API accepts that format directly.
export const billFormSchema = z.object({
  lease_id: z.string().min(1, "Lease is required"),
  date: z.string().min(1, "Date is required"),
  // Optional line items created alongside the bill.
  items: z.array(billItemSchema),
});

export type BillFormValues = z.infer<typeof billFormSchema>;
export type BillItemFormValues = z.infer<typeof billItemSchema>;
