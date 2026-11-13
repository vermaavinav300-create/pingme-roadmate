import { describe, it, expect } from "vitest";
import { placeFromOsm, filterPlaces, estimateDetour, type RoutePlace } from "../lib/places-utils";

describe("Stage 2: Route-based Discovery & Detour Calculations", () => {
  it("extracts authentic places from OSM data without fabricating missing info", () => {
    const rawFuelNode = {
      type: "node",
      id: 101,
      lat: 28.35,
      lon: 76.61,
      tags: {
        amenity: "fuel",
        name: "Indian Oil Highway Pump",
        opening_hours: "24/7",
      },
    };

    const parsed = placeFromOsm(rawFuelNode);
    expect(parsed).not.toBeNull();
    expect(parsed?.category).toBe("fuel");
    expect(parsed?.name).toBe("Indian Oil Highway Pump");
    expect(parsed?.openingHours).toBe("24/7");
    // Missing phone and address must be null, never invented
    expect(parsed?.phone).toBeNull();
    expect(parsed?.address).toBeNull();
  });

  it("calculates estimated detour distance (2x) and duration at 40 km/h", () => {
    // A place 1000m (1km) off the highway: round trip = 2000m (2km)
    // 2km / 40 km/h * 3600 = 180 seconds = 3 minutes
    const detour = estimateDetour(1000);
    expect(detour.meters).toBe(2000);
    expect(detour.seconds).toBe(180);
  });

  it("filters places according to maximum detour slider limit", () => {
    const mockPlaces: RoutePlace[] = [
      {
        id: "p1",
        name: "Quick Highway Dhaba",
        category: "restaurant",
        kind: "dhaba",
        lat: 28.5,
        lng: 76.8,
        address: null,
        phone: null,
        website: null,
        openingHours: "24/7",
        distanceFromRouteM: 500, // detour = 1km
        alongRouteM: 40000,
      },
      {
        id: "p2",
        name: "Deep Country Restaurant",
        category: "restaurant",
        kind: "restaurant",
        lat: 28.6,
        lng: 76.9,
        address: null,
        phone: null,
        website: null,
        openingHours: null,
        distanceFromRouteM: 3500, // detour = 7km
        alongRouteM: 80000,
      },
      {
        id: "p3",
        name: "Highway Fuel Station",
        category: "fuel",
        kind: "fuel",
        lat: 28.52,
        lng: 76.82,
        address: null,
        phone: null,
        website: null,
        openingHours: "24/7",
        distanceFromRouteM: 200, // detour = 0.4km
        alongRouteM: 42000,
      },
    ];

    // With 3km max detour: only Quick Highway Dhaba (1km detour) should appear
    const under3km = filterPlaces(mockPlaces, {
      category: "restaurant",
      maxDetourKm: 3,
      sort: "nearest",
    });
    expect(under3km.length).toBe(1);
    expect(under3km[0]?.name).toBe("Quick Highway Dhaba");

    // With 8km max detour: both restaurants should appear
    const under8km = filterPlaces(mockPlaces, {
      category: "restaurant",
      maxDetourKm: 8,
      sort: "nearest",
    });
    expect(under8km.length).toBe(2);

    // Fuel category filter
    const fuel = filterPlaces(mockPlaces, {
      category: "fuel",
      maxDetourKm: 5,
      sort: "nearest",
    });
    expect(fuel.length).toBe(1);
    expect(fuel[0]?.name).toBe("Highway Fuel Station");
  });
});
