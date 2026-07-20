// Public API of the organizations feature (mirrors a feature's __init__.py).
// Other parts of the app import from here — never from deep internal paths.
export {
  organizationsRoute,
  newOrganizationRoute,
  organizationDetailRoute,
  organizationEditRoute,
} from "./routes";
export { OrganizationsPage } from "./components/organizations-page";
export { NewOrganizationPage } from "./components/new-organization-page";
export { OrganizationDetailsPage } from "./components/organization-details-page";
export { EditOrganizationPage } from "./components/edit-organization-page";
export { OrganizationForm } from "./components/organization-form";
export {
  organizationQueries,
  useOrganizations,
  useOrganization,
  useCreateOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
  useUploadOrganizationLogo,
  useRemoveOrganizationLogo,
} from "./api/organizations.queries";
export {
  uploadOrganizationLogo,
  removeOrganizationLogo,
} from "./api/logo";
export {
  organizationFormSchema,
  type OrganizationFormValues,
} from "./schemas";
export type { Organization, OrganizationCreate } from "./types";
