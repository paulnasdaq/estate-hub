import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { AuthCard } from "./auth-card";
import { ResetPasswordForm } from "./reset-password-form";

// Read the `?token=` search param the reset email links to (typed via the
// route's validateSearch in routes.tsx).
const route = getRouteApi("/reset-password");

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token } = route.useSearch();

  if (!token) {
    return (
      <AuthCard
        title="Invalid reset link"
        description="This link is missing its token. Request a new password-reset email and try again."
      >
        <Button asChild variant="outline" className="w-full">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      description="Set a new password to sign in."
    >
      <ResetPasswordForm token={token} onSuccess={() => navigate({ to: "/" })} />
    </AuthCard>
  );
}
