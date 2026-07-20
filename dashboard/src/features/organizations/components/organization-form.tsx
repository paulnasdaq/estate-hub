import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ImageIcon, Upload } from "lucide-react";

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
  useCreateOrganization,
  useRemoveOrganizationLogo,
  useUpdateOrganization,
  useUploadOrganizationLogo,
} from "../api/organizations.queries";
import {
  organizationFormSchema,
  type OrganizationFormValues,
} from "../schemas";
import type { Organization } from "../types";

// Presentational + mutation logic only, shared by the create and edit pages.
// Pass `organization` to edit an existing one (the form prefills and PATCHes);
// omit it to create. The parent decides what happens after a successful save
// (e.g. navigate back to the list) via `onSaved`, which receives the saved
// organization and keeps this component testable without a router.
export function OrganizationForm({
  organization,
  onSaved,
  onCancel,
}: {
  organization?: Organization;
  onSaved: (organization: Organization) => void;
  onCancel?: () => void;
}) {
  const isEdit = organization != null;
  const createOrganization = useCreateOrganization();
  // Hooks must run unconditionally; the id is unused in create mode.
  const updateOrganization = useUpdateOrganization(organization?.id ?? "");
  const mutation = isEdit ? updateOrganization : createOrganization;
  const uploadLogo = useUploadOrganizationLogo();
  const removeLogo = useRemoveOrganizationLogo();

  // Logo staging: the picked file (if any) is uploaded after the organization
  // is saved (it needs the org's id), and `logoRemoved` records an explicit
  // "remove the existing logo" intent. Both are applied in onSubmit.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoRemoved, setLogoRemoved] = useState(false);

  // A blob: preview URL for the picked file, derived (not stored via setState)
  // so it can't trigger cascading effect renders; the effect below only revokes
  // it when it changes or the form unmounts.
  const logoPreview = useMemo(
    () => (logoFile ? URL.createObjectURL(logoFile) : null),
    [logoFile],
  );
  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const busy =
    mutation.isPending || uploadLogo.isPending || removeLogo.isPending;

  // What to show in the logo preview: the freshly picked file, else the saved
  // logo (unless the user cleared it), else nothing.
  const currentLogoUrl = logoRemoved ? null : (organization?.logo_url ?? null);
  const logoSrc = logoPreview ?? currentLogoUrl;

  function handleLogoPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (file) {
      setLogoFile(file);
      setLogoRemoved(false);
    }
  }

  function handleLogoRemove() {
    setLogoFile(null);
    setLogoRemoved(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: organization?.name ?? "",
      email: organization?.email ?? "",
      phone: organization?.phone ?? "",
      website: organization?.website ?? "",
    },
  });

  async function onSubmit(values: OrganizationFormValues) {
    // The contact columns are nullable; send null rather than an empty string.
    const payload = {
      name: values.name,
      email: values.email ? values.email : null,
      phone: values.phone ? values.phone : null,
      website: values.website ? values.website : null,
    };
    let saved: Organization;
    try {
      saved = await mutation.mutateAsync(payload);
    } catch (error) {
      toast.error(getErrorMessage(error));
      return;
    }

    // The logo is applied after the org exists (it needs the id). If it fails,
    // the org is already saved, so surface the error but still hand control back
    // to the caller rather than trapping the user on the form.
    try {
      let result = saved;
      if (logoFile) {
        result = await uploadLogo.mutateAsync({ orgId: saved.id, file: logoFile });
      } else if (logoRemoved && organization?.logo_url) {
        result = await removeLogo.mutateAsync(saved.id);
      }
      toast.success(isEdit ? "Organization updated" : "Organization created");
      onSaved(result);
    } catch (error) {
      toast.error(
        `Organization saved, but the logo failed: ${getErrorMessage(error)}`,
      );
      onSaved(saved);
    }
  }

  return (
    <Form {...form}>
      {/* noValidate: defer to zod for validation (with custom messages) rather
          than the browser's native type="email"/type="url" constraint checks,
          which otherwise block submit before react-hook-form runs. */}
      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Acme Properties" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="hello@acme.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  placeholder="+254 700 000 000"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="website"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Website</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  placeholder="https://acme.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <FormLabel>Logo</FormLabel>
          <div className="flex items-center gap-4">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt="Organization logo"
                className="size-16 rounded-md border object-cover"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                <ImageIcon className="size-6" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                aria-label="Logo"
                className="hidden"
                onChange={handleLogoPick}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload />
                {logoSrc ? "Change" : "Upload"}
              </Button>
              {logoSrc && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={handleLogoRemove}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            An image (PNG, JPG, or SVG). Uploaded when you save.
          </p>
        </div>

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
            {busy
              ? isEdit
                ? "Saving…"
                : "Creating…"
              : isEdit
                ? "Save changes"
                : "Create organization"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
