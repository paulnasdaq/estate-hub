import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { BillForm } from "./bill-form";

export function NewBillPage() {
  const navigate = useNavigate();
  const goToList = () => navigate({ to: "/bills" });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <Link
          to="/bills"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to bills
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New bill</h1>
      </div>

      <BillForm onCreated={goToList} onCancel={goToList} />
    </div>
  );
}
