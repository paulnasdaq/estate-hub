// Public API of the properties feature (mirrors a feature's __init__.py).
// Other parts of the app import from here — never from deep internal paths.
export {
  propertiesRoute,
  newPropertyRoute,
  propertyDetailsRoute,
} from "./routes";
export { PropertiesPage } from "./components/properties-page";
export { NewPropertyPage } from "./components/new-property-page";
export { PropertyForm } from "./components/property-form";
export { PropertyDetailsPage } from "./components/property-details-page";
export {
  propertyQueries,
  useProperties,
  useProperty,
  useCreateProperty,
} from "./api/properties.queries";
export { propertyFormSchema, type PropertyFormValues } from "./schemas";
export type { Property, PropertyCreate } from "./types";
