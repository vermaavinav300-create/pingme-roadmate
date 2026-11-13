// Pure, browser-safe helpers shared by the planner, map and server code.

export type LatLng = { lat: number; lng: number };

export type RouteOption = {
  index: number;
  description: string;
  labels: string[];
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
  warnings: string[];
  start: LatLng;
  end: LatLng;
};

/** Routes API durations are strings like "17557s" or "12.5s". */
export function parseDurationSeconds(value: string | undefined | null): number {
  if (!value) throw new Error("Missing route duration");
  const match = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
  if (!match) throw new Error(`Unrecognised duration: ${value}`);
  return Number(match[1]);
}

/** Decodes a Google encoded polyline into lat/lng points. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km >= 100 ? Math.round(km) : km.toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Friendly name for a route, e.g. "via NH 48". */
export function routeTitle(route: Pick<RouteOption, "description" | "index">): string {
  return route.description ? `via ${route.description}` : `Route ${route.index + 1}`;
}

export type JourneyInput = {
  origin: { name: string; placeId?: string | null | undefined };
  destination: { name: string; placeId?: string | null | undefined };
  route: RouteOption;
};

/**
 * Builds the row saved for a journey. The chosen route is copied exactly as the
 * traveller selected it — RoadMate never swaps in a different route.
 */
export function buildJourneyRow(input: JourneyInput, userId: string) {
  const { origin, destination, route } = input;
  return {
    user_id: userId,
    origin_name: origin.name,
    origin_place_id: origin.placeId ?? null,
    origin_lat: route.start.lat,
    origin_lng: route.start.lng,
    destination_name: destination.name,
    destination_place_id: destination.placeId ?? null,
    destination_lat: route.end.lat,
    destination_lng: route.end.lng,
    route_index: route.index,
    route_label: route.labels.join(",") || null,
    route_description: route.description || null,
    encoded_polyline: route.encodedPolyline,
    distance_meters: Math.round(route.distanceMeters),
    duration_seconds: Math.round(route.durationSeconds),
  };
}
