// Public API of the people feature (mirrors a feature's __init__.py).
// Other parts of the app import from here — never from deep internal paths.
export { peopleRoute, newPersonRoute, personDetailRoute } from "./routes";
export { PeoplePage } from "./components/people-page";
export { NewPersonPage } from "./components/new-person-page";
export { PersonDetailsPage } from "./components/person-details-page";
export { PersonForm } from "./components/person-form";
export {
  peopleQueries,
  usePeople,
  usePeopleOptions,
  usePerson,
  useCreatePerson,
  PEOPLE_PAGE_SIZE,
} from "./api/people.queries";
export { personFormSchema, type PersonFormValues } from "./schemas";
export type { Person, PersonCreate } from "./types";
