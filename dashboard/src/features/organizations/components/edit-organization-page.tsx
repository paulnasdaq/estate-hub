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
  useDeleteOrganization,
  useOrganization,
} from "../api/organizations.queries";
import { OrganizationForm } from "./organization-form";
import type { Organization } from "../types";

export function EditOrganizationPage({ orgId }: { orgId: string }) {
  const navigate = useNavigate();
  const { data: organization, isPending, isError, error } =
    useOrganization(orgId);

  const goToDetails = (organization: Organization) =>
    navigate({
      to: "/organizations/$orgId",
      params: { orgId: organization.id },
    });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <Link
          to="/organizations/$orgId"
          params={{ orgId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to organization
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit organization
        </h1>
      </div>

      {isPending && (
        <p className="text-sm text-muted-foreground">Loading organization…</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
      )}

      {organization && (
        <>
          <OrganizationForm
            organization={organization}
            onSaved={goToDetails}
            onCancel={() => goToDetails(organization)}
          />

          <DangerZone organization={organization} />
        </>
      )}
    </div>
  );
}

// Destructive actions, visually separated from the form and guarded by a
// confirmation dialog so a delete is never a single mis-click.
function DangerZone({ organization }: { organization: Organization }) {
  const navigate = useNavigate();
  const deleteOrganization = useDeleteOrganization();

  async function handleDelete() {
    try {
      await deleteOrganization.mutateAsync(organization.id);
      toast.success("Organization deleted");
      void navigate({ to: "/organizations" });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-destructive/40 p-6">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">Danger zone</h2>
        <p className="text-sm text-muted-foreground">
          Deleting an organization removes it permanently. This cannot be
          undone.
        </p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={deleteOrganization.isPending}>
            <Trash2 />
            Delete organization
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{organization.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the organization. This action cannot be
              undone.
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
