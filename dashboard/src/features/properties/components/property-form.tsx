import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { getErrorMessage } from "@/core/errors";
import { useOrganizations } from "@/features/organizations";
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
import { useCreateProperty } from "../api/properties.queries";
import { propertyFormSchema, type PropertyFormValues } from "../schemas";

// Presentational + mutation logic only. The parent decides what happens after a
// successful create (e.g. navigate back to the list) via `onCreated`, which
// keeps this component testable without a router.
export function PropertyForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel?: () => void;
}) {
  const organizations = useOrganizations();
  const createProperty = useCreateProperty();

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: { name: "", organization_id: "", lat: "", lng: "" },
  });

  async function onSubmit(values: PropertyFormValues) {
    try {
      await createProperty.mutateAsync({
        name: values.name,
        organization_id: values.organization_id,
        lat: Number(values.lat),
        lng: Number(values.lng),
      });
      toast.success("Property created");
      onCreated();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Maple Court" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="organization_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an organization" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {organizations.data?.items.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="lat"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Latitude</FormLabel>
                <FormControl>
                  <Input type="number" step="any" placeholder="45.52" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lng"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Longitude</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="any"
                    placeholder="-122.68"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={createProperty.isPending}>
            {createProperty.isPending ? "Creating…" : "Create property"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
