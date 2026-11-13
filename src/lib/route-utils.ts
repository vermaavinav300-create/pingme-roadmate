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

/** Route durations from the current route service are strings like "17557s" or "12.5s". */
export function parseDurationSeconds(value: string | undefined | null): number {
  if (!value) throw new Error("Missing route duration");
  const match = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
  if (!match) throw new Error(`Unrecognised duration: ${value}`);
  return Number(match[1]);
}

/** Decodes an encoded polyline (precision 5, used by OpenRouteService) into lat/lng points. */
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

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
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

/** Friendly name for a route, e.g. "via NH 44". */
export function routeTitle(route: Pick<RouteOption, "description" | "index">): string {
  return route.description ? `via ${route.description}` : `Route ${route.index + 1}`;
}

/** "NH44" → "NH 44", "nh-48" → "NH 48"; other road names are kept as they are. */
export function normaliseRoadName(name: string): string {
  const trimmed = name.trim();
  const ref = /^(NH|SH|AH|NE|MDR)\s*-?\s*(\d+[A-Z]?)$/i.exec(trimmed);
  return ref ? `${ref[1]!.toUpperCase()} ${ref[2]!.toUpperCase()}` : trimmed;
}

/**
 * Describes a route by the road it spends the most distance on, preferring
 * numbered highways (NH/SH/AH) over local street names.
 */
export function describeRouteFromSteps(steps: Array<{ name?: string | null; distance?: number | null }>): string {
  const totals = new Map<string, number>();
  for (const step of steps) {
    const raw = (step.name ?? "").trim();
    if (!raw || raw === "-") continue;
    // ORS joins multiple names with ", " — take the first highway ref if any.
    const parts = raw.split(/[,;]/).map((p) => normaliseRoadName(p)).filter(Boolean);
    const name = parts.find((p) => /^(NH|SH|AH|NE) /.test(p)) ?? parts[0];
    if (!name) continue;
    totals.set(name, (totals.get(name) ?? 0) + (step.distance ?? 0));
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const highway = ranked.find(([n]) => /^(NH|SH|AH|NE) /.test(n));
  return (highway ?? ranked[0])?.[0] ?? "";
}

/** Drops routes that are practically the same line (same length and time within 1%). */
export function dedupeRoutes<T extends Pick<RouteOption, "distanceMeters" | "durationSeconds">>(routes: T[]): T[] {
  const kept: T[] = [];
  for (const r of routes) {
    const dup = kept.some(
      (k) =>
        Math.abs(k.distanceMeters - r.distanceMeters) <= Math.max(200, k.distanceMeters * 0.01) &&
        Math.abs(k.durationSeconds - r.durationSeconds) <= Math.max(60, k.durationSeconds * 0.01),
    );
    if (!dup) kept.push(r);
  }
  return kept;
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

/**
 * Calculates total polyline length in meters.
 */
export function getPolylineDistanceMeters(points: LatLng[]): number {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineMeters(points[i], points[i + 1]);
  }
  return total;
}

/**
 * Computes the exact interpolated LatLng position along a polyline
 * at a given target distance in meters from the start.
 */
export function getPointAlongPolyline(points: LatLng[], targetDistanceMeters: number): LatLng {
  if (!points || points.length === 0) return { lat: 0, lng: 0 };
  if (points.length === 1 || targetDistanceMeters <= 0) return points[0];

  let accumulated = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const segDist = haversineMeters(a, b);
    if (accumulated + segDist >= targetDistanceMeters) {
      const remaining = targetDistanceMeters - accumulated;
      const ratio = segDist > 0 ? remaining / segDist : 0;
      return {
        lat: a.lat + (b.lat - a.lat) * ratio,
        lng: a.lng + (b.lng - a.lng) * ratio,
      };
    }
    accumulated += segDist;
  }
  return points[points.length - 1];
}
