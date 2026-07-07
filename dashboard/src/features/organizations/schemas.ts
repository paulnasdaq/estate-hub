import { z } from "zod";

// Form validation for creating an organization (the client-side analog of the
// backend's Pydantic OrganizationCreate).
export const organizationFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export type OrganizationFormValues = z.infer<typeof organizationFormSchema>;
