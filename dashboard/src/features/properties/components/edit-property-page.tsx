import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/core/errors";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useDeleteProperty,
  useProperty,
} from "../api/properties.queries";
import { PropertyForm } from "./property-form";
import type { Property } from "../types";

export function EditPropertyPage({ propertyId }: { propertyId: string }) {
  const navigate = useNavigate();
  const { data: property, isPending, isError, error } = useProperty(propertyId);

  const goToDetails = (property: Property) =>
    navigate({
      to: "/properties/$propertyId",
      params: { propertyId: property.id },
    });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <Link
          to="/properties/$propertyId"
          params={{ propertyId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to property
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit property</h1>
      </div>

      {isPending && (
        <p className="text-sm text-muted-foreground">Loading property…</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
      )}

      {property && (
        <>
          <PropertyForm
            property={property}
            onSaved={goToDetails}
            onCancel={() => goToDetails(property)}
          />

          <DangerZone property={property} />
        </>
      )}
    </div>
  );
}

// Destructive actions, visually separated from the form and guarded by a
// confirmation dialog so a delete is never a single mis-click.
function DangerZone({ property }: { property: Property }) {
  const navigate = useNavigate();
  const deleteProperty = useDeleteProperty();

  async function handleDelete() {
    try {
      await deleteProperty.mutateAsync(property.id);
      toast.success("Property deleted");
      void navigate({ to: "/properties" });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-destructive/40 p-6">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">Danger zone</h2>
        <p className="text-sm text-muted-foreground">
          Deleting a property removes it and its units permanently. This cannot
          be undone.
        </p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={deleteProperty.isPending}>
            <Trash2 />
            Delete property
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{property.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the property and its units. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
