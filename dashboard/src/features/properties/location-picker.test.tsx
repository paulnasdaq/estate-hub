import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { config } from "@/core/config";
import { LocationPicker } from "./components/location-picker";

// react-map-gl renders via WebGL, which jsdom lacks. Stub it with plain DOM: the
// Map exposes a button that fires its onClick with a fake lngLat so we can assert
// clicks are reported, and Marker just renders its children.
vi.mock("react-map-gl/mapbox", () => ({
  default: ({
    children,
    onClick,
    mapStyle,
  }: {
    children: React.ReactNode;
    onClick: (e: { lngLat: { lat: number; lng: number } }) => void;
    mapStyle: string;
  }) => (
    <div data-testid="map" data-style={mapStyle}>
      <button
        type="button"
        data-testid="map-surface"
        onClick={() => onClick({ lngLat: { lat: 40.123456789, lng: -73.987654321 } })}
      />
      {children}
    </div>
  ),
  Marker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
}));

// The token is read from config at render time; toggle it per test.
vi.mock("@/core/config", () => ({ config: { mapboxToken: "" } }));
const mockConfig = config as { mapboxToken: string };

afterEach(() => {
  mockConfig.mapboxToken = "";
  document.documentElement.classList.remove("dark");
});

describe("LocationPicker", () => {
  test("renders nothing when no token is configured", () => {
    const { container } = render(
      <LocationPicker lat={null} lng={null} onChange={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  test("shows a hint and no marker until a point is chosen", () => {
    mockConfig.mapboxToken = "pk.test-token";
    render(<LocationPicker lat={null} lng={null} onChange={vi.fn()} />);

    expect(
      screen.getByText(/click the map to set the property location/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("marker")).not.toBeInTheDocument();
  });

  test("renders a marker when coordinates are provided", () => {
    mockConfig.mapboxToken = "pk.test-token";
    render(<LocationPicker lat={45.52} lng={-122.68} onChange={vi.fn()} />);

    expect(screen.getByTestId("marker")).toBeInTheDocument();
    expect(
      screen.queryByText(/click the map to set the property location/i),
    ).not.toBeInTheDocument();
  });

  test("reports rounded coordinates when the map is clicked", async () => {
    mockConfig.mapboxToken = "pk.test-token";
    const onChange = vi.fn();
    render(<LocationPicker lat={null} lng={null} onChange={onChange} />);

    await userEvent.click(screen.getByTestId("map-surface"));

    // 6-decimal rounding keeps the stored value readable.
    expect(onChange).toHaveBeenCalledWith({ lat: 40.123457, lng: -73.987654 });
  });

  test("uses the dark map style when the dark theme is active", () => {
    mockConfig.mapboxToken = "pk.test-token";
    document.documentElement.classList.add("dark");
    render(<LocationPicker lat={null} lng={null} onChange={vi.fn()} />);

    expect(screen.getByTestId("map")).toHaveAttribute(
      "data-style",
      "mapbox://styles/mapbox/dark-v11",
    );
  });
});
