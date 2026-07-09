import { lazy, Suspense, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateProperty,
  useUpdateProperty,
} from "../api/properties.queries";
import { uploadPropertyMedia } from "../api/media.queries";
import { propertyFormSchema, type PropertyFormValues } from "../schemas";
import type { Property } from "../types";
import { MediaPicker } from "./media-picker";

// Lazy-loaded so the sizeable mapbox-gl bundle stays out of the main app chunk
// (mirrors PropertyMap on the details page).
const LocationPicker = lazy(() =>
  import("./location-picker").then((m) => ({ default: m.LocationPicker })),
);

// The form keeps coordinates as strings (see propertyFormSchema); parse to a
// number for the map, treating blanks and partial input ("-", "1.") as "no
// point yet" so the marker only appears once a real value is present.
function toCoordinate(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Presentational + mutation logic only, shared by the create and edit pages.
// Pass `property` to edit an existing one (the form prefills and PATCHes);
// omit it to create. The parent decides what happens after a successful save
// (e.g. navigate to the property's details) via `onSaved`, which receives the
// saved property and keeps this component testable without a router.
export function PropertyForm({
  property,
  onSaved,
  onCancel,
}: {
  property?: Property;
  onSaved: (property: Property) => void;
  onCancel?: () => void;
}) {
  const isEdit = property != null;
  const organizations = useOrganizations();
  const createProperty = useCreateProperty();
  // Hooks must run unconditionally; the id is unused in create mode.
  const updateProperty = useUpdateProperty(property?.id ?? "");
  const mutation = isEdit ? updateProperty : createProperty;

  // Files staged in the media section (create mode only). They can't be
  // uploaded until the property exists, so we hold them and upload after create.
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const busy = mutation.isPending || isUploadingMedia;

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: property
      ? {
          name: property.name,
          organization_id: property.organization_id,
          lat: String(property.lat),
          lng: String(property.lng),
        }
      : { name: "", organization_id: "", lat: "", lng: "" },
  });

  // The lat/lng form fields have no inputs; the map is the only way to set
  // them. Watch their values to drive the marker and the coordinate readout,
  // and surface either field's validation error under the map.
  const latValue = toCoordinate(useWatch({ control: form.control, name: "lat" }));
  const lngValue = toCoordinate(useWatch({ control: form.control, name: "lng" }));
  const locationError =
    form.formState.errors.lat?.message ?? form.formState.errors.lng?.message;
  const handlePick = (coords: { lat: number; lng: number }) => {
    form.setValue("lat", String(coords.lat), {
      shouldValidate: true,
      shouldDirty: true,
    });
    form.setValue("lng", String(coords.lng), {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  async function onSubmit(values: PropertyFormValues) {
    const payload = {
      name: values.name,
      organization_id: values.organization_id,
      lat: Number(values.lat),
      lng: Number(values.lng),
    };
    try {
      if (isEdit) {
        const saved = await updateProperty.mutateAsync(payload);
        toast.success("Property updated");
        onSaved(saved);
        return;
      }

      const saved = await createProperty.mutateAsync(payload);

      // Upload staged media now that the property (and its id) exists. If a
      // file fails, the property still exists, so surface the error but hand
      // control back to the caller rather than trapping the user on the form.
      if (stagedFiles.length > 0) {
        setIsUploadingMedia(true);
        try {
          // Upload in order; the first file becomes the property's primary
          // (cover) media.
          for (const [index, file] of stagedFiles.entries()) {
            await uploadPropertyMedia(saved.id, file, {
              isPrimary: index === 0,
              displayOrder: index,
            });
          }
        } catch (error) {
          toast.error(
            `Property created, but a file failed to upload: ${getErrorMessage(error)}`,
          );
          onSaved(saved);
          return;
        } finally {
          setIsUploadingMedia(false);
        }
      }

      toast.success("Property created");
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

        {/* Coordinates are set by clicking the map rather than typed. The
            lat/lng fields stay in form state (and are submitted) but have no
            inputs of their own, so surface their validation message here. */}
        <div className="space-y-2">
          <FormLabel>Location</FormLabel>
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
            <LocationPicker
              lat={latValue}
              lng={lngValue}
              onChange={handlePick}
            />
          </Suspense>
          <p className="text-xs text-muted-foreground">
            {latValue != null && lngValue != null
              ? `Selected: ${latValue}, ${lngValue}`
              : "Click the map to drop a pin at the property's location."}
          </p>
          {locationError && (
            <p className="text-sm font-medium text-destructive">
              {locationError}
            </p>
          )}
        </div>

        {/* Media is uploaded after the property is created (it needs the new
            property's id), so it's only offered in create mode. */}
        {!isEdit && (
          <div className="space-y-2">
            <FormLabel>Media</FormLabel>
            <MediaPicker
              files={stagedFiles}
              onChange={setStagedFiles}
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">
              Photos and documents are uploaded when you create the property.
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
            {isUploadingMedia
              ? "Uploading media…"
              : mutation.isPending
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save changes"
                  : "Create property"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
