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
  // Category is optional; "" is the "unset" sentinel the Select starts on and
  // is mapped back to null on submit.
  category: z.union([z.enum(["commercial", "residential"]), z.literal("")]),
  lat: coordinateField("Latitude", -90, 90),
  lng: coordinateField("Longitude", -180, 180),
});

export type PropertyFormValues = z.infer<typeof propertyFormSchema>;

// Form validation for creating a unit (mirrors the backend's UnitCreateNested).
// Price is kept as a string so the input can be empty ("" reads as "required"
// rather than coercing to 0); parse with Number() on submit. It must be a
// whole, non-negative amount.
export const unitFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  price: z
    .string()
    .min(1, "Price is required")
    .refine((v) => Number.isInteger(Number(v)), "Price must be a whole number")
    .refine((v) => Number(v) >= 0, "Price can't be negative"),
});

export type UnitFormValues = z.infer<typeof unitFormSchema>;
