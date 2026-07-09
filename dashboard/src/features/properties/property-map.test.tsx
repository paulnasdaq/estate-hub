import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { config } from "@/core/config";
import { PropertyMap } from "./components/property-map";

// react-map-gl renders via WebGL, which jsdom lacks. Stub it with plain DOM so
// we can assert the map is wired up without a real GL context.
vi.mock("react-map-gl/mapbox", () => ({
  default: ({
    children,
    mapStyle,
    mapboxAccessToken,
  }: {
    children: React.ReactNode;
    mapStyle: string;
    mapboxAccessToken: string;
  }) => (
    <div data-testid="map" data-style={mapStyle} data-token={mapboxAccessToken}>
      {children}
    </div>
  ),
  Marker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
}));

// The token is read from config at render time; toggle it per test. config is
// typed `as const` (readonly), so cast to a mutable view for the mock.
vi.mock("@/core/config", () => ({ config: { mapboxToken: "" } }));
const mockConfig = config as { mapboxToken: string };

afterEach(() => {
  mockConfig.mapboxToken = "";
  document.documentElement.classList.remove("dark");
});

describe("PropertyMap", () => {
  test("shows a fallback with coordinates when no token is configured", () => {
    render(<PropertyMap lat={45.52} lng={-122.68} name="Maple Court" />);

    expect(screen.getByText("Map unavailable")).toBeInTheDocument();
    expect(screen.getByText("45.52, -122.68")).toBeInTheDocument();
    expect(screen.queryByTestId("map")).not.toBeInTheDocument();
  });

  test("renders the map with a marker when a token is configured", () => {
    mockConfig.mapboxToken = "pk.test-token";
    render(<PropertyMap lat={45.52} lng={-122.68} name="Maple Court" />);

    expect(screen.getByTestId("map")).toHaveAttribute(
      "data-token",
      "pk.test-token",
    );
    expect(screen.getByTestId("marker")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Maple Court location"),
    ).toBeInTheDocument();
  });

  test("uses the dark map style when the dark theme is active", () => {
    mockConfig.mapboxToken = "pk.test-token";
    document.documentElement.classList.add("dark");
    render(<PropertyMap lat={45.52} lng={-122.68} />);

    expect(screen.getByTestId("map")).toHaveAttribute(
      "data-style",
      "mapbox://styles/mapbox/dark-v11",
    );
  });
});
