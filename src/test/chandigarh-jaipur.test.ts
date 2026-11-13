import { describe, it, expect } from "vitest";
import { resolveCoordinates, calculateDrivingRoute } from "../lib/maps.functions";
import { fetchPlacesAlongCorridor } from "../lib/overpass.server";

describe("Live Route & Discovery Verification: Chandigarh to Jaipur", () => {
  it("resolves coordinates for Chandigarh and Jaipur using Nominatim", async () => {
    try {
      const start = await resolveCoordinates({ name: "Chandigarh", placeId: null });
      const end = await resolveCoordinates({ name: "Jaipur", placeId: null });

      expect(start.lat).toBeCloseTo(30.73, 1);
      expect(start.lng).toBeCloseTo(76.78, 1);
      expect(end.lat).toBeCloseTo(26.91, 1);
      expect(end.lng).toBeCloseTo(75.82, 1);
    } catch (err: any) {
      if (err?.code === "ENOTFOUND" || err?.message?.includes("fetch failed")) {
        console.warn("Skipping live network test: offline or sandboxed environment");
        return;
      }
      throw err;
    }
  }, 15000);

  it("calculates driving route from Chandigarh to Jaipur using free routing", async () => {
    const start = { lat: 30.7333, lng: 76.7794 };
    const end = { lat: 26.9124, lng: 75.7873 };

    try {
      const routes = await calculateDrivingRoute(start, end);

      expect(routes.length).toBeGreaterThan(0);
      const primaryRoute = routes[0]!;
      expect(primaryRoute.distanceMeters).toBeGreaterThan(400_000); // ~480 km
      expect(primaryRoute.encodedPolyline.length).toBeGreaterThan(100);
      expect(primaryRoute.durationSeconds).toBeGreaterThan(15_000); // ~6 hours
      console.log(`[ROUTE RESULT] ${(primaryRoute.distanceMeters / 1000).toFixed(1)} km, ${(primaryRoute.durationSeconds / 3600).toFixed(1)} hrs`);
    } catch (err: any) {
      if (err?.code === "ENOTFOUND" || err?.message?.includes("fetch failed")) {
        console.warn("Skipping live network test: offline or sandboxed environment");
        return;
      }
      throw err;
    }
  }, 20000);

  it("finds real places (food, fuel, stays) along the highway corridor with Overpass API", async () => {
    const start = { lat: 30.7333, lng: 76.7794 };
    const end = { lat: 26.9124, lng: 75.7873 };

    try {
      const routes = await calculateDrivingRoute(start, end);
      const route = routes[0]!;

      const places = await fetchPlacesAlongCorridor(route.encodedPolyline, 5000);
      console.log(`[OVERPASS RESULT] Total places found: ${places.length}`);

      const restaurants = places.filter((p) => p.category === "restaurant");
      const fuel = places.filter((p) => p.category === "fuel");
      const hotels = places.filter((p) => p.category === "hotel");

      console.log(`[BREAKDOWN] Food: ${restaurants.length}, Fuel: ${fuel.length}, Stays: ${hotels.length}`);

      expect(places.length).toBeGreaterThan(0);
      expect(restaurants.length).toBeGreaterThan(0);
      expect(fuel.length).toBeGreaterThan(0);

      // Verify honesty rule: no fake rating or fake photos
      places.forEach((p) => {
        expect((p as any).rating).toBeUndefined();
        expect((p as any).photos).toBeUndefined();
      });
    } catch (err: any) {
      if (err?.code === "ENOTFOUND" || err?.message?.includes("fetch failed")) {
        console.warn("Skipping live network test: offline or sandboxed environment");
        return;
      }
      throw err;
    }
  }, 45000);
});

