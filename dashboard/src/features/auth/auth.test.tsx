import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { render, screen, waitFor } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { Toaster } from "@/components/ui/sonner";
import { clearAccessToken, getAccessToken } from "@/core/api/token";
import { LoginForm } from "./components/login-form";
import { ActivateForm } from "./components/activate-form";
import { ForgotPasswordForm } from "./components/forgot-password-form";
import { ResetPasswordForm } from "./components/reset-password-form";

beforeEach(() => clearAccessToken());

describe("LoginForm", () => {
  test("signs in, stores the token, and calls onSuccess", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    let posted: unknown;
    server.use(
      http.post("*/api/v1/auth/login", async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({
          access_token: "tok-123",
          token_type: "bearer",
        });
      }),
    );

    render(<LoginForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(posted).toEqual({
      email: "ada@example.com",
      password: "correct horse",
    });
    // The returned token is stashed for subsequent authenticated requests.
    expect(getAccessToken()).toBe("tok-123");
  });

  test("shows validation errors and does not submit when empty", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(<LoginForm onSuccess={onSuccess} />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(getAccessToken()).toBeNull();
  });

  test("surfaces the backend message and stores no token on 401", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    server.use(
      http.post("*/api/v1/auth/login", () =>
        HttpResponse.json(
          {
            error: {
              code: "invalid_credentials",
              message: "Incorrect email or password",
            },
          },
          { status: 401 },
        ),
      ),
    );

    render(
      <>
        <LoginForm onSuccess={onSuccess} />
        <Toaster />
      </>,
    );

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText("Incorrect email or password"),
    ).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(getAccessToken()).toBeNull();
  });
});

describe("ActivateForm", () => {
  test("sets the password with the token and calls onSuccess", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    let posted: unknown;
    server.use(
      http.post("*/api/v1/auth/activate", async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({
          access_token: "tok-activated",
          token_type: "bearer",
        });
      }),
    );

    render(<ActivateForm token="signed-token" onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("Password"), "a-good-password");
    await user.type(
      screen.getByLabelText("Confirm password"),
      "a-good-password",
    );
    await user.click(
      screen.getByRole("button", { name: /set password & continue/i }),
    );

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(posted).toEqual({
      token: "signed-token",
      password: "a-good-password",
    });
    expect(getAccessToken()).toBe("tok-activated");
  });

  test("requires the two passwords to match", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(<ActivateForm token="signed-token" onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("Password"), "a-good-password");
    await user.type(screen.getByLabelText("Confirm password"), "different");
    await user.click(
      screen.getByRole("button", { name: /set password & continue/i }),
    );

    expect(
      await screen.findByText("Passwords do not match"),
    ).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  test("requires a password of at least 8 characters", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(<ActivateForm token="signed-token" onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("Password"), "short");
    await user.type(screen.getByLabelText("Confirm password"), "short");
    await user.click(
      screen.getByRole("button", { name: /set password & continue/i }),
    );

    expect(
      await screen.findByText("Password must be at least 8 characters"),
    ).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe("ForgotPasswordForm", () => {
  test("submits the email and calls onSubmitted", async () => {
    const user = userEvent.setup();
    const onSubmitted = vi.fn();

    let posted: unknown;
    server.use(
      http.post("*/api/v1/auth/forgot-password", async ({ request }) => {
        posted = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    render(<ForgotPasswordForm onSubmitted={onSubmitted} />);

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(posted).toEqual({ email: "ada@example.com" });
  });

  test("validates the email field", async () => {
    const user = userEvent.setup();
    const onSubmitted = vi.fn();

    render(<ForgotPasswordForm onSubmitted={onSubmitted} />);

    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(onSubmitted).not.toHaveBeenCalled();
  });
});

describe("ResetPasswordForm", () => {
  test("resets with the token, stores the token, and calls onSuccess", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    let posted: unknown;
    server.use(
      http.post("*/api/v1/auth/reset-password", async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({
          access_token: "tok-reset",
          token_type: "bearer",
        });
      }),
    );

    render(<ResetPasswordForm token="reset-token" onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("New password"), "a-good-password");
    await user.type(
      screen.getByLabelText("Confirm password"),
      "a-good-password",
    );
    await user.click(
      screen.getByRole("button", { name: /reset password & continue/i }),
    );

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(posted).toEqual({ token: "reset-token", password: "a-good-password" });
    expect(getAccessToken()).toBe("tok-reset");
  });

  test("requires the two passwords to match", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(<ResetPasswordForm token="reset-token" onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("New password"), "a-good-password");
    await user.type(screen.getByLabelText("Confirm password"), "different");
    await user.click(
      screen.getByRole("button", { name: /reset password & continue/i }),
    );

    expect(
      await screen.findByText("Passwords do not match"),
    ).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
