import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { AuthCard } from "./auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <AuthCard
        title="Check your email"
        description="If an account exists for that address, we've sent a link to reset your password."
      >
        <Button asChild variant="outline" className="w-full">
          <Link to="/login">Back to sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we'll send you a link to reset it."
    >
      <ForgotPasswordForm onSubmitted={() => setSent(true)} />
      <div className="mt-4 text-center">
        <Link
          to="/login"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back to sign in
        </Link>
      </div>
    </AuthCard>
  );
}
