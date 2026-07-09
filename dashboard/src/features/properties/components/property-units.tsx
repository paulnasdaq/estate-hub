import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/core/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePropertyUnits, useCreateUnit } from "../api/units.queries";

// Format an integer price as currency for display in the units list.
const priceFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// The units section shown on the property details page: a list of the
// property's units plus an inline form to add one. Kept prop-driven (takes the
// property id) so it can be tested without a router.
export function PropertyUnits({ propertyId }: { propertyId: string }) {
  const { data, isPending, isError, error } = usePropertyUnits(propertyId);
  const createUnit = useCreateUnit(propertyId);
  const [name, setName] = useState("");
  // Price is kept as a string so the input can be empty (reads as "required"
  // rather than coercing to 0); parsed to an int on submit.
  const [price, setPrice] = useState("");

  const trimmedName = name.trim();
  const priceValue = Number(price);
  const priceIsValid =
    price !== "" && Number.isInteger(priceValue) && priceValue >= 0;
  const canSubmit = trimmedName !== "" && priceIsValid;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    try {
      await createUnit.mutateAsync({ name: trimmedName, price: priceValue });
      toast.success("Unit added");
      setName("");
      setPrice("");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">Units</h2>

      <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
        <Input
          aria-label="Unit name"
          placeholder="Unit name"
          className="min-w-40 flex-1"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          aria-label="Price"
          type="number"
          min={0}
          step={1}
          placeholder="Price"
          className="w-32"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
        <Button type="submit" disabled={createUnit.isPending || !canSubmit}>
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
            <li
              key={unit.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <span>{unit.name}</span>
              <span className="font-medium tabular-nums">
                {priceFormatter.format(unit.price)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
