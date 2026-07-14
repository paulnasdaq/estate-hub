import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { getErrorMessage } from "@/core/errors";
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
import { useLeases } from "@/features/leases";
import { useCreateBill } from "../api/bills.queries";
import { billFormSchema, type BillFormValues } from "../schemas";
import { BillItemsField } from "./bill-items-field";

const formatDate = (value: string) => new Date(value).toLocaleDateString();
const shortId = (id: string) => id.split("-")[0];

// Presentational + mutation logic only. The parent decides what happens after a
// successful create (e.g. navigate back to the list) via `onCreated`, which
// keeps this component testable without a router.
export function BillForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel?: () => void;
}) {
  // Leases have no human-friendly label yet, so the picker lists them by their
  // effective date and a short id. First page is enough until lease search
  // exists.
  const leases = useLeases({ page: 0 });
  const createBill = useCreateBill();

  const leaseOptions = (leases.data?.items ?? []).map((lease) => ({
    id: lease.id,
    label: `${formatDate(lease.effective_from)} · ${shortId(lease.id)}`,
  }));

  const form = useForm<BillFormValues>({
    resolver: zodResolver(billFormSchema),
    defaultValues: {
      lease_id: "",
      date: "",
      items: [],
    },
  });

  // Items can link to a recurring term on the selected lease. The lease list
  // already includes each lease's terms, so no extra fetch is needed.
  const selectedLeaseId = form.watch("lease_id");
  const termOptions =
    leases.data?.items.find((lease) => lease.id === selectedLeaseId)?.terms ??
    [];

  async function onSubmit(values: BillFormValues) {
    try {
      await createBill.mutateAsync({
        lease_id: values.lease_id,
        // The date input already yields "YYYY-MM-DD", which the API accepts.
        date: values.date,
        // Amount is held as a string in the form; the API wants a number.
        items: values.items.map((item) => ({
          name: item.name.trim(),
          amount: Number(item.amount),
          start_date: item.start_date,
          end_date: item.end_date,
          // Empty selection means no link; omit rather than send "".
          lease_term_id: item.lease_term_id || undefined,
        })),
      });
      toast.success("Bill created");
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
          name="lease_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Lease</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a lease" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {leaseOptions.map((lease) => (
                    <SelectItem key={lease.id} value={lease.id}>
                      {lease.label}
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
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <BillItemsField control={form.control} terms={termOptions} />

        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={createBill.isPending}>
            {createBill.isPending ? "Creating…" : "Create bill"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
