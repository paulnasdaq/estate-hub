import Map, { Marker } from "react-map-gl/mapbox";
import { MapPin } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

import { config } from "@/core/config";
import { useMapStyle } from "./use-map-style";

/**
 * Interactive Mapbox map centered on a property's coordinates with a marker.
 *
 * Falls back to a plain coordinates panel when no access token is configured
 * (see VITE_MAPBOX_TOKEN), so the page still renders in unconfigured
 * environments and tests without pulling in WebGL.
 */
export function PropertyMap({
  lat,
  lng,
  name,
}: {
  lat: number;
  lng: number;
  name?: string;
}) {
  const mapStyle = useMapStyle();

  if (!config.mapboxToken) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-1 rounded-lg border bg-muted/30 text-center">
        <MapPin className="size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Map unavailable</p>
        <p className="text-xs text-muted-foreground">
          {lat}, {lng}
        </p>
      </div>
    );
  }

  return (
    <div className="h-64 overflow-hidden rounded-lg border">
      <Map
        mapboxAccessToken={config.mapboxToken}
        // Remount when the center changes so a different property recenters the
        // map; initialViewState is otherwise only read on first render.
        key={`${lat},${lng}`}
        initialViewState={{ latitude: lat, longitude: lng, zoom: 14 }}
        mapStyle={mapStyle}
        style={{ width: "100%", height: "100%" }}
      >
        <Marker latitude={lat} longitude={lng} anchor="bottom">
          <MapPin
            className="size-6 fill-primary text-primary-foreground"
            aria-label={name ? `${name} location` : "Property location"}
          />
        </Marker>
      </Map>
    </div>
  );
}
