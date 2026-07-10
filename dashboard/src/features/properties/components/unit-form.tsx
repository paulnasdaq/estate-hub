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
import { useCreateUnit, useUpdateUnit } from "../api/units.queries";
import { unitFormSchema, type UnitFormValues } from "../schemas";
import type { Unit } from "../types";
import { MediaPicker } from "./media-picker";
import { useStagedMedia } from "./use-staged-media";

// Presentational + mutation logic, shared by the add and edit unit pages. Pass
// `unit` to edit an existing one (the form prefills and PATCHes); omit it to
// create. Kept prop-driven (takes the property id and callbacks) so it can be
// tested without a router, mirroring PropertyForm. The parent decides what
// happens after a successful save via `onSaved`.
export function UnitForm({
  propertyId,
  unit,
  onSaved,
  onCancel,
}: {
  propertyId: string;
  unit?: Unit;
  onSaved: (unit: Unit) => void;
  onCancel?: () => void;
}) {
  const isEdit = unit != null;
  const createUnit = useCreateUnit(propertyId);
  // Hooks must run unconditionally; the id is unused in create mode.
  const updateUnit = useUpdateUnit(unit?.id ?? "");
  const mutation = isEdit ? updateUnit : createUnit;
  // Files staged in the media section (create mode only). They can't be
  // uploaded until the unit exists, so we hold them and upload after create.
  const media = useStagedMedia("unit");
  const busy = mutation.isPending || media.isUploading;

  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitFormSchema),
    defaultValues: unit
      ? { name: unit.name, price: String(unit.price) }
      : { name: "", price: "" },
  });

  async function onSubmit(values: UnitFormValues) {
    const payload = { name: values.name.trim(), price: Number(values.price) };
    try {
      if (isEdit) {
        const saved = await updateUnit.mutateAsync(payload);
        toast.success("Unit updated");
        onSaved(saved);
        return;
      }

      const saved = await createUnit.mutateAsync(payload);

      // Upload staged media now that the unit (and its id) exists. If a file
      // fails, the unit still exists, so surface the error but hand control
      // back to the caller rather than trapping the user on the form.
      try {
        await media.uploadAll(saved.id);
      } catch (error) {
        toast.error(
          `Unit added, but a file failed to upload: ${getErrorMessage(error)}`,
        );
        onSaved(saved);
        return;
      }

      toast.success("Unit added");
      onSaved(saved);
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
                <Input placeholder="Unit 2B" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price</FormLabel>
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

        {/* Media is uploaded after the unit is created (it needs the new unit's
            id), so it's only offered in create mode — edit media lives on the
            unit detail page. */}
        {!isEdit && (
          <div className="space-y-2">
            <FormLabel>Media</FormLabel>
            <MediaPicker
              files={media.files}
              onChange={media.setFiles}
              disabled={busy}
              uploads={media.uploads}
            />
            <p className="text-xs text-muted-foreground">
              Photos and documents are uploaded when you add the unit.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={busy}>
            {media.isUploading
              ? "Uploading media…"
              : mutation.isPending
                ? isEdit
                  ? "Saving…"
                  : "Adding…"
                : isEdit
                  ? "Save changes"
                  : "Add unit"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
