import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { OrganizationForm } from "./organization-form";

export function NewOrganizationPage() {
  const navigate = useNavigate();
  const goToList = () => navigate({ to: "/organizations" });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <Link
          to="/organizations"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to organizations
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          New organization
        </h1>
      </div>

      <OrganizationForm onCreated={goToList} onCancel={goToList} />
    </div>
  );
}
