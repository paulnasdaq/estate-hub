// Public API of the people feature (mirrors a feature's __init__.py).
// Other parts of the app import from here — never from deep internal paths.
export { peopleRoute, newPersonRoute } from "./routes";
export { PeoplePage } from "./components/people-page";
export { NewPersonPage } from "./components/new-person-page";
export { PersonForm } from "./components/person-form";
export {
  peopleQueries,
  usePeople,
  useCreatePerson,
} from "./api/people.queries";
export { personFormSchema, type PersonFormValues } from "./schemas";
export type { Person, PersonCreate } from "./types";
