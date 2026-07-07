// Public API of the properties feature (mirrors a feature's __init__.py).
// Other parts of the app import from here — never from deep internal paths.
export {
  propertiesRoute,
  newPropertyRoute,
  propertyDetailsRoute,
  propertyUnitsRoute,
} from "./routes";
export { PropertiesPage } from "./components/properties-page";
export { NewPropertyPage } from "./components/new-property-page";
export { PropertyForm } from "./components/property-form";
export { PropertyDetailsPage } from "./components/property-details-page";
export { PropertyUnits } from "./components/property-units";
export { PropertyUnitsPage } from "./components/property-units-page";
export {
  propertyQueries,
  useProperties,
  useProperty,
  useCreateProperty,
} from "./api/properties.queries";
export {
  unitQueries,
  usePropertyUnits,
  useCreateUnit,
} from "./api/units.queries";
export { propertyFormSchema, type PropertyFormValues } from "./schemas";
export type {
  Property,
  PropertyCreate,
  Unit,
  UnitCreateNested,
} from "./types";
