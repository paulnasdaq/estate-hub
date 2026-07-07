import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/core/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePropertyUnits, useCreateUnit } from "../api/units.queries";

// The units section shown on the property details page: a list of the
// property's units plus an inline form to add one. Kept prop-driven (takes the
// property id) so it can be tested without a router.
export function PropertyUnits({ propertyId }: { propertyId: string }) {
  const { data, isPending, isError, error } = usePropertyUnits(propertyId);
  const createUnit = useCreateUnit(propertyId);
  const [name, setName] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createUnit.mutateAsync({ name: trimmed });
      toast.success("Unit added");
      setName("");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">Units</h2>

      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          aria-label="Unit name"
          placeholder="Unit name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button
          type="submit"
          disabled={createUnit.isPending || name.trim() === ""}
        >
          <Plus />
          {createUnit.isPending ? "Adding…" : "Add unit"}
        </Button>
      </form>

      {isPending && (
        <p className="text-sm text-muted-foreground">Loading units…</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
      )}
      {data && data.items.length === 0 && (
        <p className="text-sm text-muted-foreground">No units yet.</p>
      )}
      {data && data.items.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {data.items.map((unit) => (
            <li key={unit.id} className="px-4 py-3 text-sm">
              {unit.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
