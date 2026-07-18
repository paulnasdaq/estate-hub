import { Link, useNavigate } from "@tanstack/react-router";

import { AuthCard } from "./auth-card";
import { LoginForm } from "./login-form";

export function LoginPage() {
  const navigate = useNavigate();

  return (
    <AuthCard
      title="Sign in"
      description="Enter your credentials to access the dashboard."
    >
      <LoginForm onSuccess={() => navigate({ to: "/" })} />
      <div className="mt-4 text-center">
        <Link
          to="/forgot-password"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Forgot your password?
        </Link>
      </div>
    </AuthCard>
  );
}
