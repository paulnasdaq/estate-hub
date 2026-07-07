import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { PropertyForm } from "./property-form";

export function NewPropertyPage() {
  const navigate = useNavigate();
  const goToList = () => navigate({ to: "/properties" });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <Link
          to="/properties"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to properties
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New property</h1>
      </div>

      <PropertyForm onCreated={goToList} onCancel={goToList} />
    </div>
  );
}
