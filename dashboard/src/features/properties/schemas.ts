import { z } from "zod";

// Form validation for creating a property (the client-side analog of the
// backend's Pydantic PropertyCreate). Coordinates are kept as strings in the
// form (native number inputs still emit strings, and "" must read as "required"
// rather than coercing to 0); convert with Number() on submit.
const coordinateField = (label: string, min: number, max: number) =>
  z
    .string()
    .min(1, `${label} is required`)
    .refine((v) => !Number.isNaN(Number(v)), `${label} must be a number`)
    .refine(
      (v) => Number(v) >= min && Number(v) <= max,
      `${label} must be between ${min} and ${max}`,
    );

export const propertyFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  organization_id: z.string().min(1, "Organization is required"),
  lat: coordinateField("Latitude", -90, 90),
  lng: coordinateField("Longitude", -180, 180),
});

export type PropertyFormValues = z.infer<typeof propertyFormSchema>;
