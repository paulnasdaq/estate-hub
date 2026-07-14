import { z } from "zod";

// Form validation for creating a person (the client-side analog of the
// backend's Pydantic UserCreate). Phone is optional; an empty string is sent as
// null on submit rather than an empty value.
export const personFormSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required"),
  last_name: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  phone: z.string().trim(),
  organization_id: z.string().min(1, "Organization is required"),
});

export type PersonFormValues = z.infer<typeof personFormSchema>;
