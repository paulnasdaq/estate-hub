import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { renderWithRouter, screen, waitFor } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { PeoplePage } from "./components/people-page";

const now = "2026-01-01T00:00:00Z";

function makePerson(id: string, firstName: string, email: string) {
  return {
    id,
    created_at: now,
    first_name: firstName,
    last_name: "Doe",
    email,
    phone: null,
    accounts: [],
  };
}

// PeoplePage links to /people/new, so it needs a router in tests.
const renderPage = () =>
  renderWithRouter(<PeoplePage />, {
    initialPath: "/people",
    linkPaths: ["/people/new"],
  });

describe("PeoplePage", () => {
  test("renders the people returned by the API", async () => {
    server.use(
      http.get("*/api/v1/users", () =>
        HttpResponse.json({
          items: [makePerson("u1", "Ada", "ada@example.com")],
          total: 1,
          limit: 10,
          offset: 0,
        }),
      ),
    );

    renderPage();

    expect(await screen.findByText("Ada Doe")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
  });

  test("shows an empty state when there are no people", async () => {
    // Uses the default handler (empty list) in test/msw/handlers.ts.
    renderPage();

    expect(await screen.findByText("No people yet")).toBeInTheDocument();
  });

  test("shows an error message when the request fails", async () => {
    server.use(
      http.get("*/api/v1/users", () =>
        HttpResponse.json({ detail: "Could not load people" }, { status: 500 }),
      ),
    );

    renderPage();

    expect(await screen.findByText("Could not load people")).toBeInTheDocument();
  });

  test("filters the list via the search box", async () => {
    const user = userEvent.setup();
    const all = [
      makePerson("1", "Ada", "ada@example.com"),
      makePerson("2", "Grace", "grace@example.com"),
    ];
    // Server-side search: the handler filters by the ?search query param, so
    // this asserts the box actually sends it (not just client-side filtering).
    server.use(
      http.get("*/api/v1/users", ({ request }) => {
        const term = new URL(request.url).searchParams
          .get("search")
          ?.toLowerCase();
        const items = term
          ? all.filter(
              (p) =>
                p.first_name.toLowerCase().includes(term) ||
                p.email.toLowerCase().includes(term),
            )
          : all;
        return HttpResponse.json({
          items,
          total: items.length,
          limit: 10,
          offset: 0,
        });
      }),
    );

    renderPage();
    expect(await screen.findByText("Ada Doe")).toBeInTheDocument();
    expect(screen.getByText("Grace Doe")).toBeInTheDocument();

    await user.type(
      screen.getByLabelText("Search people by name or email"),
      "grace",
    );

    expect(await screen.findByText("Grace Doe")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("Ada Doe")).not.toBeInTheDocument(),
    );
  });

  test("pages through the list by offset", async () => {
    const user = userEvent.setup();
    // 10 rows per page; page 2 holds a single extra row.
    server.use(
      http.get("*/api/v1/users", ({ request }) => {
        const offset = Number(
          new URL(request.url).searchParams.get("offset") ?? "0",
        );
        const items =
          offset === 0
            ? [makePerson("1", "PageOne", "one@example.com")]
            : [makePerson("2", "PageTwo", "two@example.com")];
        return HttpResponse.json({ items, total: 11, limit: 10, offset });
      }),
    );

    renderPage();

    expect(await screen.findByText("PageOne Doe")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(await screen.findByText("PageTwo Doe")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled(),
    );
  });

  test("shows an empty state when a search matches nothing", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("*/api/v1/users", () =>
        HttpResponse.json({ items: [], total: 0, limit: 10, offset: 0 }),
      ),
    );

    renderPage();

    // findBy waits for the router to mount the page before querying.
    await user.type(
      await screen.findByLabelText("Search people by name or email"),
      "zzz",
    );

    expect(await screen.findByText(/No people match/)).toBeInTheDocument();
  });
});
