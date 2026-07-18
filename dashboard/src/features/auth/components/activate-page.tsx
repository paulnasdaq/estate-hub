import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { AuthCard } from "./auth-card";
import { ActivateForm } from "./activate-form";

// Read the `?token=` search param the activation email links to (typed via the
// route's validateSearch in routes.tsx).
const route = getRouteApi("/activate");

export function ActivatePage() {
  const navigate = useNavigate();
  const { token } = route.useSearch();

  if (!token) {
    return (
      <AuthCard
        title="Invalid activation link"
        description="This link is missing its token. Please open the most recent activation link from your email."
      >
        <Button asChild variant="outline" className="w-full">
          <Link to="/login">Go to sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set your password"
      description="Choose a password to activate your account and sign in."
    >
      <ActivateForm token={token} onSuccess={() => navigate({ to: "/" })} />
    </AuthCard>
  );
}
