import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, type Control } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BillFormValues } from "../schemas";

// Sentinel for the "no linked term" option, since Radix Select items can't use
// an empty-string value.
const NO_TERM = "__none__";

// Repeatable list of bill line items (rent, utilities, etc.). Bound to the
// parent form's `items` array via react-hook-form's useFieldArray so the rows
// submit and validate as part of the bill. `terms` are the recurring terms on
// the currently-selected lease, offered as an optional link per item.
export function BillItemsField({
  control,
  terms,
}: {
  control: Control<BillFormValues>;
  terms: { id: string; name: string }[];
}) {
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <FormLabel>Line items</FormLabel>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            append({ name: "", amount: "", start_date: "", end_date: "" })
          }
        >
          <Plus />
          Add item
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No items yet. Add charges like rent or utilities (optional).
        </p>
      ) : (
        <ul className="space-y-3">
          {fields.map((item, index) => (
            <li key={item.id} className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Item {index + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove item ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  <Trash2 />
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={control}
                  name={`items.${index}.name`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Rent" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name={`items.${index}.amount`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          placeholder="1200"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name={`items.${index}.start_date`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period start</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name={`items.${index}.end_date`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period end</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name={`items.${index}.lease_term_id`}
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Lease term (optional)</FormLabel>
                      <Select
                        value={field.value || NO_TERM}
                        onValueChange={(value) =>
                          field.onChange(value === NO_TERM ? "" : value)
                        }
                        disabled={terms.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                terms.length === 0
                                  ? "Select a lease first"
                                  : "No linked term"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NO_TERM}>No linked term</SelectItem>
                          {terms.map((term) => (
                            <SelectItem key={term.id} value={term.id}>
                              {term.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
