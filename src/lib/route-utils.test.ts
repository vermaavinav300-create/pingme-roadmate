import { describe, expect, it } from "vitest";
import {
  buildJourneyRow,
  decodePolyline,
  parseDurationSeconds,
  getPointAlongPolyline,
  getPolylineDistanceMeters,
  type RouteOption,
} from "./route-utils";

describe("route utils", () => {
  it("parses Routes API durations without rounding", () => {
    expect(parseDurationSeconds("17557s")).toBe(17557);
    expect(parseDurationSeconds("12.5s")).toBe(12.5);
  });

  it("rejects a missing duration instead of inventing zero", () => {
    expect(() => parseDurationSeconds(undefined)).toThrow();
  });

  it("decodes Google's reference polyline", () => {
    const pts = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(pts).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });

  it("interpolates car position accurately along polyline points", () => {
    const points = [
      { lat: 28.0, lng: 77.0 },
      { lat: 29.0, lng: 77.0 },
    ];
    const totalDist = getPolylineDistanceMeters(points);
    expect(totalDist).toBeGreaterThan(100000); // ~111 km

    // Start point
    const atStart = getPointAlongPolyline(points, 0);
    expect(atStart.lat).toBeCloseTo(28.0, 4);

    // Midpoint
    const atMid = getPointAlongPolyline(points, totalDist / 2);
    expect(atMid.lat).toBeCloseTo(28.5, 2);
    expect(atMid.lng).toBeCloseTo(77.0, 4);

    // End point
    const atEnd = getPointAlongPolyline(points, totalDist);
    expect(atEnd.lat).toBeCloseTo(29.0, 4);
  });

  it("saves exactly the route the traveller selected", () => {
    const chosen: RouteOption = {
      index: 1,
      description: "NH 48",
      labels: ["DEFAULT_ROUTE_ALTERNATE"],
      distanceMeters: 294403,
      durationSeconds: 20813,
      encodedPolyline: "abc123",
      warnings: [],
      start: { lat: 28.7, lng: 77.1 },
      end: { lat: 26.9, lng: 75.8 },
    };
    const row = buildJourneyRow(
      { origin: { name: "Delhi" }, destination: { name: "Jaipur" }, route: chosen },
      "user-1",
    );
    expect(row.route_index).toBe(1);
    expect(row.encoded_polyline).toBe("abc123");
    expect(row.distance_meters).toBe(294403);
    expect(row.duration_seconds).toBe(20813);
    expect(row.user_id).toBe("user-1");
  });
});
