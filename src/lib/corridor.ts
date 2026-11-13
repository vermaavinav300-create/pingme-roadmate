// Route corridor geometry (turf.js): simplifies the saved route, splits it into
// stretches for small Overpass queries, and measures how far a place is from the route.
import { simplify } from "@turf/simplify";
import { nearestPointOnLine } from "@turf/nearest-point-on-line";
import { lineString, point } from "@turf/helpers";
import { decodePolyline, haversineMeters, type LatLng } from "./route-utils";

/** Length of one search stretch. Keeps each Overpass query small. */
export const SEGMENT_LENGTH_M = 40_000;

export type Corridor = {
  points: LatLng[];
  cumulative: number[]; // metres from route start at each point
  segments: Array<{ start: number; end: number }>; // point index range (inclusive)
};

function simplifyPath(path: LatLng[], tolerance: number): LatLng[] {
  if (path.length <= 2) return path;
  const line = simplify(lineString(path.map((p) => [p.lng, p.lat])), { tolerance, highQuality: false });
  return line.geometry.coordinates.map(([lng, lat]) => ({ lat: lat!, lng: lng! }));
}

export function buildCorridor(encodedPolyline: string): Corridor {
  // ~50 m tolerance: accurate enough for "distance from route", far fewer points.
  const points = simplifyPath(decodePolyline(encodedPolyline), 0.0005);
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1]! + haversineMeters(points[i - 1]!, points[i]!));
  }
  const segments: Corridor["segments"] = [];
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    const isLast = i === points.length - 1;
    if (cumulative[i]! - cumulative[start]! >= SEGMENT_LENGTH_M || isLast) {
      segments.push({ start, end: i });
      start = i;
    }
  }
  if (segments.length === 0 && points.length > 0) segments.push({ start: 0, end: points.length - 1 });
  return { points, cumulative, segments };
}

/** Coarser line (~300 m tolerance) for one stretch — what we send to Overpass. */
export function segmentQueryLine(corridor: Corridor, segment: number): LatLng[] {
  const seg = corridor.segments[segment];
  if (!seg) throw new Error("Segment out of range");
  const pts = corridor.points.slice(seg.start, seg.end + 1);
  if (pts.length === 1) return [pts[0]!, pts[0]!];
  return simplifyPath(pts, 0.003);
}

/**
 * Distance from a place to the route and how far along the route it is.
 * Measured against this stretch and its neighbours (a place within 5 km of a
 * stretch is always nearest to it or an adjacent one).
 */
export function measureAgainstRoute(
  corridor: Corridor,
  segment: number,
  place: LatLng,
): { distanceM: number; alongM: number } {
  const first = corridor.segments[Math.max(0, segment - 1)]!;
  const last = corridor.segments[Math.min(corridor.segments.length - 1, segment + 1)]!;
  const pts = corridor.points.slice(first.start, last.end + 1);
  if (pts.length < 2) {
    return { distanceM: haversineMeters(pts[0]!, place), alongM: corridor.cumulative[first.start]! };
  }
  const snapped = nearestPointOnLine(
    lineString(pts.map((p) => [p.lng, p.lat])),
    point([place.lng, place.lat]),
    { units: "meters" },
  );
  return {
    distanceM: snapped.properties.dist,
    alongM: corridor.cumulative[first.start]! + snapped.properties.location,
  };
}
