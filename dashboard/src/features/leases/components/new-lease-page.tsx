import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { LeaseForm } from "./lease-form";

export function NewLeasePage() {
  const navigate = useNavigate();
  const goToList = () => navigate({ to: "/leases" });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <Link
          to="/leases"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to leases
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New lease</h1>
      </div>

      <LeaseForm onCreated={goToList} onCancel={goToList} />
    </div>
  );
}
