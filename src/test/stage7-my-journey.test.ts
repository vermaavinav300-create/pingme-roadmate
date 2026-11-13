import { describe, it, expect, beforeEach } from "vitest";
import {
  saveLocalJourney,
  listLocalJourneys,
  getLocalJourney,
  renameLocalJourney,
  deleteLocalJourney,
  addStopToJourney,
  removeStopFromJourney,
  listStopsForJourney,
  getUserPreferencesFromDb,
  saveUserPreferencesToDb,
  saveOrderToDb,
  listOrdersFromDb,
  advanceOrderStatusInDb,
  saveReservationToDb,
  listReservationsFromDb,
  advanceReservationStatusInDb,
} from "../lib/orders-db.server";
import crypto from "node:crypto";

describe("Stage 7: My Journey & Preferences Engine", () => {
  const testUserId = "test-explorer-" + crypto.randomUUID();
  const testJourneyId = crypto.randomUUID();

  it("saves, lists, renames, and deletes a local journey with SQLite persistence", () => {
    // 1. Save Journey (Chandigarh to Jaipur)
    const now = new Date().toISOString();
    saveLocalJourney({
      id: testJourneyId,
      userId: testUserId,
      originName: "Chandigarh, Sector 17",
      originLat: 30.7333,
      originLng: 76.7794,
      destinationName: "Jaipur, Hawa Mahal",
      destinationLat: 26.9239,
      destinationLng: 75.8267,
      routeIndex: 0,
      routeLabel: "NH 48 / NH 52",
      routeDescription: "via NH 48 and NH 52",
      encodedPolyline: "test_polyline_data",
      distanceMeters: 495000,
      durationSeconds: 28800,
      status: "planned",
      createdAt: now,
      updatedAt: now,
    });

    // 2. Fetch Journey
    const found = getLocalJourney(testJourneyId);
    expect(found).not.toBeNull();
    expect(found?.originName).toBe("Chandigarh, Sector 17");
    expect(found?.destinationName).toBe("Jaipur, Hawa Mahal");
    expect(found?.distanceMeters).toBe(495000);

    // 3. Rename Journey
    renameLocalJourney(testJourneyId, "Chandigarh to Jaipur Weekend Roadtrip");
    const renamed = getLocalJourney(testJourneyId);
    expect(renamed?.routeDescription).toBe("Chandigarh to Jaipur Weekend Roadtrip");

    // 4. Verify in List
    const all = listLocalJourneys(testUserId);
    expect(all.some((j) => j.id === testJourneyId)).toBe(true);

    // 5. Delete Journey
    deleteLocalJourney(testJourneyId);
    const deleted = getLocalJourney(testJourneyId);
    expect(deleted).toBeNull();
  });

  it("adds upcoming stops, returns them ordered by distance along route, and removes them", () => {
    const journeyId = crypto.randomUUID();

    // Add Stop 2 (farther: 240 km along NH 48)
    const stop2 = addStopToJourney({
      journeyId,
      placeId: "osm_node_hotel_king",
      name: "Hotel Highway King",
      kind: "hotel",
      category: "hotel",
      lat: 28.1,
      lng: 76.5,
      alongRouteM: 240000,
      distanceFromRouteM: 300,
      detourMeters: 600,
      detourSeconds: 90,
      address: "NH 48 Highway Corridor",
    });

    // Add Stop 1 (closer: 85 km along route)
    const stop1 = addStopToJourney({
      journeyId,
      placeId: "osm_node_haveli_dhaba",
      name: "Old Rao Dhaba",
      kind: "restaurant",
      category: "restaurant",
      lat: 28.3,
      lng: 76.8,
      alongRouteM: 85000,
      distanceFromRouteM: 150,
      detourMeters: 300,
      detourSeconds: 45,
      address: "NH 48 Mile 85",
    });

    // Add Stop 3 (mid: 160 km along route)
    const stop3 = addStopToJourney({
      journeyId,
      placeId: "osm_node_ioc_fuel",
      name: "IndianOil Petrol Pump",
      kind: "fuel",
      category: "fuel",
      lat: 28.2,
      lng: 76.6,
      alongRouteM: 160000,
      distanceFromRouteM: 50,
      detourMeters: 100,
      detourSeconds: 20,
    });

    // Verify stops are returned sorted chronologically along the route
    const orderedStops = listStopsForJourney(journeyId);
    expect(orderedStops.length).toBe(3);
    expect(orderedStops[0].name).toBe("Old Rao Dhaba"); // 85 km
    expect(orderedStops[1].name).toBe("IndianOil Petrol Pump"); // 160 km
    expect(orderedStops[2].name).toBe("Hotel Highway King"); // 240 km

    // Remove stop 2
    const removed = removeStopFromJourney(stop2.id);
    expect(removed).toBe(true);

    const remainingStops = listStopsForJourney(journeyId);
    expect(remainingStops.length).toBe(2);
    expect(remainingStops.some((s) => s.id === stop2.id)).toBe(false);
  });

  it("persists user preferences and restores them accurately", () => {
    const prefsUserId = "prefs-user-" + crypto.randomUUID();

    // Default before save
    const initialPrefs = getUserPreferencesFromDb(prefsUserId);
    expect(initialPrefs.preferredMaxDetourKm).toBe(5);
    expect(initialPrefs.foodPreference).toBe("any");
    expect(initialPrefs.alertDistanceKm).toBe(5);

    // Save custom preferences: 3.5 km detour, veg only, 10 km alert
    saveUserPreferencesToDb(prefsUserId, {
      preferredMaxDetourKm: 3.5,
      foodPreference: "veg",
      alertDistanceKm: 10,
    });

    const updated = getUserPreferencesFromDb(prefsUserId);
    expect(updated.preferredMaxDetourKm).toBe(3.5);
    expect(updated.foodPreference).toBe("veg");
    expect(updated.alertDistanceKm).toBe(10);
  });

  it("links food orders and table reservations to journey and executes simulated status flow", () => {
    const journeyId = crypto.randomUUID();

    // 1. Advance Food Order
    const order = saveOrderToDb({
      userId: testUserId,
      journeyId,
      restaurantId: "osm_node_dhaba_chandigarh_jaipur",
      restaurantName: "Highway Mannat Haveli",
      restaurantAddress: "NH 48 Bypass",
      detourText: "+0.8 km detour",
      estimatedArrival: new Date(Date.now() + 3600000).toISOString(),
      notes: "Less spicy please",
      paymentMethod: "upi_at_table",
      totalAmount: 580,
      items: [
        { itemId: "dal_makhani", name: "Dal Makhani", category: "Mains", price: 260, quantity: 1, isVeg: true },
        { itemId: "butter_naan", name: "Butter Naan", category: "Breads", price: 60, quantity: 4, isVeg: true },
        { itemId: "sweet_lassi", name: "Kulhad Sweet Lassi", category: "Beverages", price: 80, quantity: 1, isVeg: true },
      ],
    });

    expect(order.status).toBe("submitted");
    expect(order.prototypeDisclaimer).toBe("Prototype: not confirmed by the restaurant");

    // Advance Order Status Workflow Simulation
    const status1 = advanceOrderStatusInDb(order.id);
    expect(status1).toBe("sent_to_restaurant");

    const status2 = advanceOrderStatusInDb(order.id);
    expect(status2).toBe("confirmed");

    const status3 = advanceOrderStatusInDb(order.id);
    expect(status3).toBe("submitted");

    // 2. Table Reservation Request
    const reservation = saveReservationToDb({
      userId: testUserId,
      journeyId,
      restaurantId: "osm_node_dhaba_chandigarh_jaipur",
      restaurantName: "Highway Mannat Haveli",
      arrivalTime: new Date(Date.now() + 4000000).toISOString(),
      guestCount: 4,
      customerName: "Avinav Sharma",
      customerPhone: "9876543210",
      specialRequests: "Window booth if available",
      paymentMethod: "upi_at_table",
    });

    expect(reservation.status).toBe("submitted");

    // Advance Reservation Status Workflow Simulation
    const resStatus1 = advanceReservationStatusInDb(reservation.id);
    expect(resStatus1).toBe("sent_to_restaurant");

    const resStatus2 = advanceReservationStatusInDb(reservation.id);
    expect(resStatus2).toBe("confirmed");
  });
});
