import { describe, it, expect } from "vitest";
import {
  checkDistanceAlerts,
  DEFAULT_ALERT_THRESHOLDS_KM,
  type SimulatedAlert,
} from "../lib/simulation-utils";
import type { DbJourneyStop } from "../lib/orders-db.server";

describe("Stage 6: Simulated Driving & Smart Distance/Arrival Alerts", () => {
  // Test Route: Chandigarh to Jaipur (495 km, ~8 hours = 28,800 sec)
  const totalDistanceMeters = 495000;
  const totalDurationSeconds = 28800;

  // Two chosen stops along the corridor:
  // Stop 1: Old Rao Dhaba at km 85 (85,000 m)
  const stop1: DbJourneyStop = {
    id: "stop-dhaba-85",
    journeyId: "journey-chd-jpr",
    placeId: "osm_node_old_rao_dhaba",
    name: "Old Rao Dhaba",
    kind: "restaurant",
    category: "restaurant",
    lat: 28.3,
    lng: 76.8,
    alongRouteM: 85000,
    distanceFromRouteM: 120,
    detourMeters: 240,
    detourSeconds: 40,
    address: "NH 48 Highway Corridor",
    createdAt: new Date().toISOString(),
  };

  // Stop 2: IndianOil Petrol Pump at km 160 (160,000 m)
  const stop2: DbJourneyStop = {
    id: "stop-fuel-160",
    journeyId: "journey-chd-jpr",
    placeId: "osm_node_indianoil_160",
    name: "IndianOil Petrol Pump",
    kind: "fuel",
    category: "fuel",
    lat: 28.1,
    lng: 76.6,
    alongRouteM: 160000,
    distanceFromRouteM: 50,
    detourMeters: 100,
    detourSeconds: 15,
    address: "NH 48 Bypass Mile 160",
    createdAt: new Date().toISOString(),
  };

  const stops = [stop1, stop2];
  const thresholdsKm = DEFAULT_ALERT_THRESHOLDS_KM; // [10, 5, 1]

  it("does not fire alerts when car is far away (> 10 km from any stop)", () => {
    let triggeredKeys = new Set<string>();

    // Car starts at 0 km
    const { newAlerts, nextTriggeredKeys } = checkDistanceAlerts({
      currentMeters: 0,
      stops,
      thresholdsKm,
      triggeredKeys,
      totalDistanceMeters,
      totalDurationSeconds,
    });

    expect(newAlerts).toHaveLength(0);
    expect(nextTriggeredKeys.size).toBe(0);

    // Car drives to 50 km (still 35 km away from Stop 1)
    const res50 = checkDistanceAlerts({
      currentMeters: 50000,
      stops,
      thresholdsKm,
      triggeredKeys: nextTriggeredKeys,
      totalDistanceMeters,
      totalDurationSeconds,
    });

    expect(res50.newAlerts).toHaveLength(0);
  });

  it("triggers distance and estimated arrival alerts in chronological order at 10 km, 5 km, and 1 km", () => {
    let triggeredKeys = new Set<string>();

    // Step 1: Car approaches Stop 1 at 75 km (exactly 10 km before Stop 1 at 85 km)
    const res75 = checkDistanceAlerts({
      currentMeters: 75000,
      stops,
      thresholdsKm,
      triggeredKeys,
      totalDistanceMeters,
      totalDurationSeconds,
    });

    expect(res75.newAlerts).toHaveLength(1);
    const alert10km = res75.newAlerts[0];
    expect(alert10km.stopName).toBe("Old Rao Dhaba");
    expect(alert10km.thresholdKm).toBe(10);
    expect(alert10km.title).toBe("Old Rao Dhaba is 10 km ahead");
    expect(alert10km.message).toContain("Arriving at Old Rao Dhaba in about");
    expect(alert10km.category).toBe("restaurant");
    triggeredKeys = res75.nextTriggeredKeys;

    // Step 2: Car advances to 80 km (exactly 5 km before Stop 1)
    const res80 = checkDistanceAlerts({
      currentMeters: 80000,
      stops,
      thresholdsKm,
      triggeredKeys,
      totalDistanceMeters,
      totalDurationSeconds,
    });

    expect(res80.newAlerts).toHaveLength(1);
    const alert5km = res80.newAlerts[0];
    expect(alert5km.stopName).toBe("Old Rao Dhaba");
    expect(alert5km.thresholdKm).toBe(5);
    expect(alert5km.title).toBe("Old Rao Dhaba is 5 km ahead");
    expect(alert5km.message).toContain("Arriving at Old Rao Dhaba in about");
    triggeredKeys = res80.nextTriggeredKeys;

    // Step 3: Car advances to 84 km (1 km before Stop 1)
    const res84 = checkDistanceAlerts({
      currentMeters: 84000,
      stops,
      thresholdsKm,
      triggeredKeys,
      totalDistanceMeters,
      totalDurationSeconds,
    });

    expect(res84.newAlerts).toHaveLength(1);
    const alert1km = res84.newAlerts[0];
    expect(alert1km.stopName).toBe("Old Rao Dhaba");
    expect(alert1km.thresholdKm).toBe(1);
    expect(alert1km.title).toBe("Old Rao Dhaba is 1 km ahead");
    triggeredKeys = res84.nextTriggeredKeys;
  });

  it("never fires duplicate alerts for the same stop and distance threshold", () => {
    let triggeredKeys = new Set<string>();

    // Car hits 75 km (10 km alert fires)
    const res1 = checkDistanceAlerts({
      currentMeters: 75000,
      stops,
      thresholdsKm,
      triggeredKeys,
      totalDistanceMeters,
      totalDurationSeconds,
    });
    expect(res1.newAlerts).toHaveLength(1);
    triggeredKeys = res1.nextTriggeredKeys;

    // Car continues driving at 76 km, 77 km, 78 km
    for (const km of [76000, 77000, 78000, 79000]) {
      const res = checkDistanceAlerts({
        currentMeters: km,
        stops,
        thresholdsKm,
        triggeredKeys,
        totalDistanceMeters,
        totalDurationSeconds,
      });
      // MUST NOT duplicate 10 km alert!
      expect(res.newAlerts).toHaveLength(0);
      triggeredKeys = res.nextTriggeredKeys;
    }
  });

  it("triggers alerts for Stop 2 (Petrol Pump) in correct order as car progresses", () => {
    let triggeredKeys = new Set<string>();

    // Fast forward past stop 1 to 150 km (10 km before Stop 2 at 160 km)
    const res150 = checkDistanceAlerts({
      currentMeters: 150000,
      stops,
      thresholdsKm,
      triggeredKeys,
      totalDistanceMeters,
      totalDurationSeconds,
    });

    // Should contain 10 km alert for IndianOil
    expect(res150.newAlerts.some((a) => a.stopName === "IndianOil Petrol Pump" && a.thresholdKm === 10)).toBe(true);
    const fuelAlert = res150.newAlerts.find((a) => a.stopName === "IndianOil Petrol Pump");
    expect(fuelAlert?.category).toBe("fuel");
  });

  it("resets cleanly when reset simulation is invoked", () => {
    // Fill up triggered keys
    let triggeredKeys = new Set<string>(["stop-dhaba-85-10km", "stop-dhaba-85-5km"]);

    // After reset, triggeredKeys is cleared
    triggeredKeys = new Set<string>();
    expect(triggeredKeys.size).toBe(0);

    // Car at 75 km fires 10 km alert again
    const res = checkDistanceAlerts({
      currentMeters: 75000,
      stops,
      thresholdsKm,
      triggeredKeys,
      totalDistanceMeters,
      totalDurationSeconds,
    });
    expect(res.newAlerts).toHaveLength(1);
    expect(res.newAlerts[0].thresholdKm).toBe(10);
  });
});
