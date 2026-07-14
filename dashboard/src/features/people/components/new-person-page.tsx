import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { PersonForm } from "./person-form";

export function NewPersonPage() {
  const navigate = useNavigate();
  const goToList = () => navigate({ to: "/people" });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <Link
          to="/people"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to people
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New person</h1>
      </div>

      <PersonForm onCreated={goToList} onCancel={goToList} />
    </div>
  );
}
