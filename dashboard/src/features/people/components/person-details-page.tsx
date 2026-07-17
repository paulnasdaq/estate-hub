import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { getErrorMessage } from "@/core/errors";
import { Skeleton } from "@/components/ui/skeleton";
import { usePerson } from "../api/people.queries";

const formatDate = (value: string) => new Date(value).toLocaleDateString();

// Truncate a uuid to its first segment, matching the lease/bill detail pages,
// until organizations expose a human-friendly label to join against.
const shortId = (id: string) => id.split("-")[0];

// Detail page for a single person at /people/$personId: their contact details
// and the accounts (organization memberships) attached to them. Kept
// prop-driven (takes the user id) so it can be tested without a router.
export function PersonDetailsPage({ personId }: { personId: string }) {
  const { data: person, isPending, isError, error } = usePerson(personId);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link
          to="/people"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to people
        </Link>
        {isPending && <Skeleton className="h-8 w-48" />}
        {isError && (
          <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
        )}
        {person && (
          <h1 className="text-2xl font-semibold tracking-tight">
            {person.first_name} {person.last_name}
          </h1>
        )}
      </div>

      {person && (
        <>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 rounded-lg border p-6 sm:grid-cols-2">
            <Detail label="Email">
              <a
                href={`mailto:${person.email}`}
                className="text-primary hover:underline"
              >
                {person.email}
              </a>
            </Detail>
            <Detail label="Phone">
              {person.phone ? (
                <a
                  href={`tel:${person.phone}`}
                  className="text-primary hover:underline"
                >
                  {person.phone}
                </a>
              ) : (
                "—"
              )}
            </Detail>
            <Detail label="Created">{formatDate(person.created_at)}</Detail>
          </dl>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">Accounts</h2>
            {person.accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This person has no accounts.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">
                        Account
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        Organization
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {person.accounts.map((account) => (
                      <tr key={account.id} className="border-b last:border-0">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs">
                            {shortId(account.id)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {account.organization_id ? (
                            <span className="font-mono text-xs">
                              {shortId(account.organization_id)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {formatDate(account.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
