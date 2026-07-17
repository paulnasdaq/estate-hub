import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PersonForm, usePeopleOptions } from "@/features/people";
import { useProperties, usePropertyUnits } from "@/features/properties";
import { useCreateLease } from "../api/leases.queries";
import { leaseFormSchema, type LeaseFormValues } from "../schemas";
import { LeaseTermsField } from "./lease-terms-field";

// Format an integer price as currency, matching the units list elsewhere.
const priceFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

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

  // Whether the inline "create a new tenant" panel is open.
  const [newTenantOpen, setNewTenantOpen] = useState(false);
  // Tenants created inline this session. Kept locally so a freshly created
  // account is immediately present as a select option — the people list refetch
  // is async, and Radix Select clears its value if the selected option is
  // momentarily absent.
  const [createdAccounts, setCreatedAccounts] = useState<
    { id: string; label: string }[]
  >([]);

  const properties = useProperties({
    search: debouncedPropertyQuery || undefined,
    page: 0,
  });
  const units = usePropertyUnits(propertyId, {
    search: debouncedUnitQuery || undefined,
    page: 0,
  });
  const people = usePeopleOptions();
  const createLease = useCreateLease();

  // A lease is tied to a user *account*, not a user directly. Flatten each
  // person's accounts into selectable options labelled by the person's name,
  // and fold in any tenants created inline (deduped in case the refetch has
  // already surfaced them).
  const fetchedAccounts = (people.data?.items ?? []).flatMap((person) =>
    person.accounts.map((account) => ({
      id: account.id,
      label: `${person.first_name} ${person.last_name}`,
    })),
  );
  const fetchedIds = new Set(fetchedAccounts.map((account) => account.id));
  const accountOptions = [
    ...createdAccounts.filter((account) => !fetchedIds.has(account.id)),
    ...fetchedAccounts,
  ];

  const form = useForm<LeaseFormValues>({
    resolver: zodResolver(leaseFormSchema),
    defaultValues: {
      unit_id: "",
      account_id: "",
      effective_from: "",
      // Start with a rent term prefilled since nearly every lease has one; it can
      // be edited or removed like any other term.
      terms: [
        {
          name: "Rent",
          amount: "",
          interval: "monthly",
          rate: "fixed",
          type: "prepaid",
        },
      ],
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
                  description: priceFormatter.format(unit.price),
                }))}
                onSelect={(item) => {
                  field.onChange(item.id);
                  setUnitQuery(item.label);
                  // Prefill the rent term's amount with the unit's price so the
                  // common case (rent == listed price) needs no extra typing.
                  const unit = (units.data?.items ?? []).find(
                    (candidate) => candidate.id === item.id,
                  );
                  const terms = form.getValues("terms");
                  const rentIndex = terms.findIndex(
                    (term) => term.name.trim().toLowerCase() === "rent",
                  );
                  if (unit && rentIndex !== -1) {
                    form.setValue(
                      `terms.${rentIndex}.amount`,
                      String(unit.price),
                      { shouldValidate: true },
                    );
                  }
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
              <div className="flex items-center justify-between">
                <FormLabel>Tenant</FormLabel>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 py-1 text-sm"
                  onClick={() => setNewTenantOpen(true)}
                >
                  <UserPlus />
                  New tenant
                </Button>
              </div>
              <Select
                value={field.value}
                // The tenant select has no "none" option, so a user can only
                // ever pick a real account. Radix Select, however, emits an
                // empty change when a programmatically-set value (from inline
                // tenant creation) isn't yet in its item collection — ignore
                // that spurious reset so the new tenant stays selected.
                onValueChange={(value) => {
                  if (value) field.onChange(value);
                }}
              >
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

      {/* Inline tenant creation. On success the people list is refetched (so the
          new account appears in the dropdown) and we select the newly created
          person's account straight away. */}
      <Dialog open={newTenantOpen} onOpenChange={setNewTenantOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New tenant</DialogTitle>
            <DialogDescription>
              Create a person to add them as this lease's tenant.
            </DialogDescription>
          </DialogHeader>
          <div>
            <PersonForm
              onCreated={(person) => {
                // Every user is created with exactly one account; use it as the
                // lease's tenant. Register the option locally first so it exists
                // the moment we set the field value.
                const account = person.accounts[0];
                if (account) {
                  setCreatedAccounts((prev) => [
                    { id: account.id, label: `${person.first_name} ${person.last_name}` },
                    ...prev,
                  ]);
                  form.setValue("account_id", account.id, {
                    shouldValidate: true,
                  });
                }
                setNewTenantOpen(false);
              }}
              onCancel={() => setNewTenantOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </Form>
  );
}
