import { z } from "zod";

// Form validation for an organization (the client-side analog of the backend's
// Pydantic OrganizationCreate/Update). Email, phone, and website are optional;
// empty strings are sent as null on submit. Email format is validated when
// present, matching the backend's EmailStr; website stays a free string to match
// the backend, which accepts any value.
export const organizationFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  // Optional: blank is allowed, but a non-empty value must be a valid email.
  // A refine (rather than `.email().or("")`) keeps the custom message when the
  // value is present but malformed, instead of a generic union error.
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || z.string().email().safeParse(v).success, {
      message: "Enter a valid email",
    }),
  phone: z.string().trim(),
  website: z.string().trim(),
});

export type OrganizationFormValues = z.infer<typeof organizationFormSchema>;
