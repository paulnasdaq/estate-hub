import { Link } from "@tanstack/react-router";
import { Plus, Users } from "lucide-react";

import { getErrorMessage } from "@/core/errors";
import { Button } from "@/components/ui/button";
import { usePeople } from "../api/people.queries";
import { PeopleTable } from "./people-table";

export function PeoplePage() {
  const { data, isPending, isError, error } = usePeople();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">People</h1>
        <Button asChild size="sm">
          <Link to="/people/new">
            <Plus />
            Add person
          </Link>
        </Button>
      </div>

      {isPending && (
        <p className="text-sm text-muted-foreground">Loading people…</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
      )}
      {data &&
        (data.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-16 text-center">
            <Users className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No people yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add your first person to get started.
            </p>
          </div>
        ) : (
          <PeopleTable data={data.items} />
        ))}
    </div>
  );
}
