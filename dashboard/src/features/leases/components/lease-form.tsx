import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { getErrorMessage } from "@/core/errors";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Button } from "@/components/ui/button";
import {
  Form,
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
import { usePeople } from "@/features/people";
import { useProperties, usePropertyUnits } from "@/features/properties";
import { useCreateLease } from "../api/leases.queries";
import { leaseFormSchema, type LeaseFormValues } from "../schemas";
import { LeaseTermsField } from "./lease-terms-field";

// Presentational + mutation logic only. The parent decides what happens after a
// successful create (e.g. navigate back to the list) via `onCreated`, which
// keeps this component testable without a router.
export function LeaseForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel?: () => void;
}) {
  // Property is a filter for finding a unit, not part of the lease payload, so
  // it lives in local state rather than the form.
  const [propertyId, setPropertyId] = useState("");
  const [propertyQuery, setPropertyQuery] = useState("");
  const debouncedPropertyQuery = useDebouncedValue(propertyQuery.trim());

  // The unit typeahead's text; the chosen unit id lives in the form field.
  const [unitQuery, setUnitQuery] = useState("");
  const debouncedUnitQuery = useDebouncedValue(unitQuery.trim());

  const properties = useProperties({
    search: debouncedPropertyQuery || undefined,
    page: 0,
  });
  const units = usePropertyUnits(propertyId, {
    search: debouncedUnitQuery || undefined,
    page: 0,
  });
  const people = usePeople();
  const createLease = useCreateLease();

  // A lease is tied to a user *account*, not a user directly. Flatten each
  // person's accounts into selectable options labelled by the person's name.
  const accountOptions = (people.data?.items ?? []).flatMap((person) =>
    person.accounts.map((account) => ({
      id: account.id,
      label: `${person.first_name} ${person.last_name}`,
    })),
  );

  const form = useForm<LeaseFormValues>({
    resolver: zodResolver(leaseFormSchema),
    defaultValues: {
      unit_id: "",
      account_id: "",
      effective_from: "",
      terms: [],
    },
  });

  async function onSubmit(values: LeaseFormValues) {
    try {
      await createLease.mutateAsync({
        unit_id: values.unit_id,
        account_id: values.account_id,
        // The backend expects a datetime; the date input yields "YYYY-MM-DD".
        effective_from: new Date(values.effective_from).toISOString(),
        // Amount is held as a string in the form; the API wants a number.
        terms: values.terms.map((term) => ({
          name: term.name.trim(),
          amount: Number(term.amount),
          interval: term.interval,
          rate: term.rate,
          type: term.type,
        })),
      });
      toast.success("Lease created");
      onCreated();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Property scopes the unit search; picking one (or retyping) clears any
            unit already chosen for a different property. */}
        <FormItem>
          <FormLabel>Property</FormLabel>
          <Autocomplete
            ariaLabel="Property"
            placeholder="Search properties by name…"
            query={propertyQuery}
            onQueryChange={(query) => {
              setPropertyQuery(query);
              setPropertyId("");
              setUnitQuery("");
              form.setValue("unit_id", "");
            }}
            loading={properties.isFetching}
            emptyText="No properties match"
            items={(properties.data?.items ?? []).map((property) => ({
              id: property.id,
              label: property.name,
            }))}
            onSelect={(item) => {
              setPropertyId(item.id);
              setPropertyQuery(item.label);
              setUnitQuery("");
              form.setValue("unit_id", "");
            }}
          />
        </FormItem>

        <FormField
          control={form.control}
          name="unit_id"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Unit</FormLabel>
              <Autocomplete
                ariaLabel="Unit"
                placeholder={
                  propertyId ? "Search units by name…" : "Select a property first"
                }
                disabled={!propertyId}
                query={unitQuery}
                onQueryChange={(query) => {
                  setUnitQuery(query);
                  // Retyping invalidates a previously chosen unit.
                  field.onChange("");
                }}
                loading={units.isFetching}
                emptyText="No units match"
                items={(units.data?.items ?? []).map((unit) => ({
                  id: unit.id,
                  label: unit.name,
                }))}
                onSelect={(item) => {
                  field.onChange(item.id);
                  setUnitQuery(item.label);
                }}
                ariaInvalid={Boolean(fieldState.error)}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="account_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tenant</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a tenant" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {accountOptions.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="effective_from"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <LeaseTermsField control={form.control} />

        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={createLease.isPending}>
            {createLease.isPending ? "Creating…" : "Create lease"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
