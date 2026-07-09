import { useState } from "react";
import Map, {
  Marker,
  type MapMouseEvent,
  type MarkerDragEvent,
} from "react-map-gl/mapbox";
import { MapPin } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

import { config } from "@/core/config";
import { useMapStyle } from "./use-map-style";

// Where the map opens before a location is chosen: a continental-US view so the
// user can pan to their property. Only used as the *initial* camera — picking a
// point does not recenter (that would fight the user's own panning).
const DEFAULT_VIEW = { latitude: 39.5, longitude: -98.35, zoom: 3 };

// Mapbox coordinates carry ~15 significant digits; trim to ~0.1m precision so
// the stored value (and the synced text inputs) stay readable.
function round(value: number) {
  return Number(value.toFixed(6));
}

export type LatLng = { lat: number; lng: number };

/**
 * Interactive map for choosing a property's coordinates: click the map or drag
 * the marker to set the location, reported to the parent via `onChange`.
 *
 * Returns `null` when no access token is configured (see VITE_MAPBOX_TOKEN) so
 * the caller can fall back to manual coordinate inputs instead of pulling in
 * WebGL in unconfigured environments and tests.
 */
export function LocationPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (coords: LatLng) => void;
}) {
  const mapStyle = useMapStyle();
  // The map view is uncontrolled after mount so panning/zooming sticks; seed it
  // from the initial coordinates when editing an already-placed property.
  const [initialView] = useState(() =>
    lat != null && lng != null
      ? { latitude: lat, longitude: lng, zoom: 14 }
      : DEFAULT_VIEW,
  );

  if (!config.mapboxToken) return null;

  const hasPoint = lat != null && lng != null;

  const handleClick = (event: MapMouseEvent) =>
    onChange({ lat: round(event.lngLat.lat), lng: round(event.lngLat.lng) });

  const handleDragEnd = (event: MarkerDragEvent) =>
    onChange({ lat: round(event.lngLat.lat), lng: round(event.lngLat.lng) });

  return (
    <div className="relative h-64 overflow-hidden rounded-lg border">
      <Map
        mapboxAccessToken={config.mapboxToken}
        initialViewState={initialView}
        mapStyle={mapStyle}
        style={{ width: "100%", height: "100%" }}
        cursor="crosshair"
        onClick={handleClick}
      >
        {hasPoint && (
          <Marker
            latitude={lat}
            longitude={lng}
            anchor="bottom"
            draggable
            onDragEnd={handleDragEnd}
          >
            <MapPin
              className="size-6 fill-primary text-primary-foreground"
              aria-label="Selected location"
            />
          </Marker>
        )}
      </Map>

      {!hasPoint && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-background/80 px-3 py-2 text-center text-xs text-muted-foreground">
          Click the map to set the property location
        </div>
      )}
    </div>
  );
}
