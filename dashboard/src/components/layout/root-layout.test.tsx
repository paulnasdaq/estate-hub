import { describe, expect, test } from "vitest";

import { renderWithRouter, screen } from "@/test/test-utils";
import { RootLayout } from "./root-layout";

const NAV_PATHS = [
  "/",
  "/properties",
  "/organizations",
  "/people",
  "/leases",
  "/bills",
  "/payments",
  "/login",
];

describe("RootLayout", () => {
  test("shows the Sign out button in the authenticated shell", async () => {
    renderWithRouter(<RootLayout />, {
      initialPath: "/",
      linkPaths: NAV_PATHS,
    });

    // findBy* waits for the router to asynchronously mount the matched route,
    // then the sidebar (with its footer Sign out button) renders.
    expect(
      await screen.findByRole("button", { name: /sign out/i }),
    ).toBeInTheDocument();
  });
});
