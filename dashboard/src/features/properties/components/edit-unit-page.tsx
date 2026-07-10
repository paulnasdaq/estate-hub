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
import { useDeleteUnit, useUnit } from "../api/units.queries";
import { UnitForm } from "./unit-form";
import type { Unit } from "../types";

// Edit page for a unit at /properties/$propertyId/units/$unitId/edit. Kept
// prop-driven (takes the property + unit ids) so it can be tested without a
// router, mirroring EditPropertyPage.
export function EditUnitPage({
  propertyId,
  unitId,
}: {
  propertyId: string;
  unitId: string;
}) {
  const navigate = useNavigate();
  const { data: unit, isPending, isError, error } = useUnit(unitId);

  const goToDetail = () =>
    navigate({
      to: "/properties/$propertyId/units/$unitId",
      params: { propertyId, unitId },
    });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <Link
          to="/properties/$propertyId/units/$unitId"
          params={{ propertyId, unitId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to unit
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit unit</h1>
      </div>

      {isPending && (
        <p className="text-sm text-muted-foreground">Loading unit…</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
      )}

      {unit && (
        <>
          <UnitForm
            propertyId={propertyId}
            unit={unit}
            onSaved={goToDetail}
            onCancel={goToDetail}
          />

          <DangerZone propertyId={propertyId} unit={unit} />
        </>
      )}
    </div>
  );
}

// Destructive actions, visually separated from the form and guarded by a
// confirmation dialog so a delete is never a single mis-click.
function DangerZone({ propertyId, unit }: { propertyId: string; unit: Unit }) {
  const navigate = useNavigate();
  const deleteUnit = useDeleteUnit();

  async function handleDelete() {
    try {
      await deleteUnit.mutateAsync(unit.id);
      toast.success("Unit deleted");
      void navigate({
        to: "/properties/$propertyId/units",
        params: { propertyId },
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-destructive/40 p-6">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">Danger zone</h2>
        <p className="text-sm text-muted-foreground">
          Deleting a unit removes it and its media permanently. This cannot be
          undone.
        </p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={deleteUnit.isPending}>
            <Trash2 />
            Delete unit
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{unit.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the unit and its media. This action
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
