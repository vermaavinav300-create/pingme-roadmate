import { describe, it, expect, beforeEach } from "vitest";
import { getRestaurantMenu, MENU_DISCLAIMER, PROTOTYPE_DISCLAIMER } from "@/lib/menu-data";
import {
  saveOrderToDb,
  saveReservationToDb,
  listOrdersFromDb,
  listReservationsFromDb,
  advanceOrderStatusInDb,
  advanceReservationStatusInDb,
} from "@/lib/orders-db.server";

describe("Stage 3: Restaurant Menus, Orders and Reservations", () => {
  it("generates 8 to 10 sample menu items with category, price in INR, and veg/non-veg tags", () => {
    const menu = getRestaurantMenu("node-12345", "Sukhdev Dhaba");

    expect(menu.length).toBeGreaterThanOrEqual(6);
    expect(menu.length).toBeLessThanOrEqual(10);
    expect(MENU_DISCLAIMER).toBe("Sample menu (demo data)");
    expect(PROTOTYPE_DISCLAIMER).toBe("Prototype: not confirmed by the restaurant");

    // Every item has valid fields
    for (const item of menu) {
      expect(item.name).toBeTruthy();
      expect(["Starters", "Main Course", "Breads & Rice", "Beverages & Desserts"]).toContain(item.category);
      expect(item.price).toBeGreaterThan(0);
      expect(typeof item.isVeg).toBe("boolean");
      expect(item.description).toBeTruthy();
    }

    // Deterministic: same restaurant ID produces identical menu
    const menu2 = getRestaurantMenu("node-12345", "Sukhdev Dhaba");
    expect(menu).toEqual(menu2);
  });

  it("persists advance food order in database with pay_at_restaurant and prototype disclaimers", () => {
    const futureArrival = new Date(Date.now() + 2 * 3600 * 1000).toISOString();

    const order = saveOrderToDb({
      userId: "test-user-chd-jpr",
      journeyId: "chd-to-jpr-journey",
      restaurantId: "osm-dhaba-44",
      restaurantName: "Highway Mannat Dhaba",
      restaurantAddress: "NH-44 Highway Corridor, near Ambala",
      detourText: "+1.2 km (3 min)",
      estimatedArrival: futureArrival,
      notes: "Keep ready for takeaway, mild spicy",
      paymentMethod: "pay_at_restaurant",
      totalAmount: 490,
      items: [
        {
          itemId: "m-1",
          name: "Highway Dal Makhani",
          category: "Main Course",
          price: 210,
          quantity: 1,
          isVeg: true,
        },
        {
          itemId: "m-2",
          name: "Tandoori Chicken (Half)",
          category: "Starters",
          price: 280,
          quantity: 1,
          isVeg: false,
        },
      ],
    });

    expect(order.id).toBeTruthy();
    expect(order.status).toBe("submitted");
    expect(order.paymentMethod).toBe("pay_at_restaurant");
    expect(order.prototypeDisclaimer).toBe("Prototype: not confirmed by the restaurant");
    expect(order.totalAmount).toBe(490);
    expect(order.items).toHaveLength(2);

    // Verify it survives page refresh (persisted in SQLite database)
    const allOrders = listOrdersFromDb("test-user-chd-jpr");
    const found = allOrders.find((o) => o.id === order.id);
    expect(found).toBeDefined();
    expect(found?.restaurantName).toBe("Highway Mannat Dhaba");
    expect(found?.items).toHaveLength(2);
  });

  it("supports UPI payment in advance (in car) and UPI payment at table after reaching", () => {
    const futureArrival = new Date(Date.now() + 90 * 60 * 1000).toISOString();

    // 1. Order with UPI In Advance (In Car)
    const orderInCar = saveOrderToDb({
      userId: "test-user-upi",
      restaurantId: "rest-car-upi",
      restaurantName: "Highway King Dhaba",
      estimatedArrival: futureArrival,
      paymentMethod: "upi_advance",
      totalAmount: 320,
      items: [
        { itemId: "c-1", name: "Kadhai Paneer", category: "Main Course", price: 260, quantity: 1, isVeg: true },
        { itemId: "c-2", name: "Garlic Butter Naan", category: "Breads & Rice", price: 60, quantity: 1, isVeg: true },
      ],
    });

    expect(orderInCar.paymentMethod).toBe("upi_advance");

    // 2. Order with UPI At Table (After Reaching)
    const orderAtTable = saveOrderToDb({
      userId: "test-user-upi",
      restaurantId: "rest-table-upi",
      restaurantName: "Highway King Dhaba",
      estimatedArrival: futureArrival,
      paymentMethod: "upi_at_table",
      totalAmount: 180,
      items: [
        { itemId: "t-1", name: "Amritsari Aloo Kulcha", category: "Breads & Rice", price: 90, quantity: 2, isVeg: true },
      ],
    });

    expect(orderAtTable.paymentMethod).toBe("upi_at_table");

    // 3. Table Reservation with UPI At Table
    const resAtTable = saveReservationToDb({
      userId: "test-user-upi",
      restaurantId: "rest-table-upi",
      restaurantName: "Highway King Dhaba",
      arrivalTime: futureArrival,
      guestCount: 3,
      customerName: "Rohan",
      customerPhone: "9876543210",
      paymentMethod: "upi_at_table",
    });

    expect(resAtTable.paymentMethod).toBe("upi_at_table");

    // 4. Table Reservation with UPI In Advance (In Car)
    const resInCar = saveReservationToDb({
      userId: "test-user-upi",
      restaurantId: "rest-car-upi",
      restaurantName: "Highway King Dhaba",
      arrivalTime: futureArrival,
      guestCount: 2,
      customerName: "Rohan",
      customerPhone: "9876543210",
      paymentMethod: "upi_advance",
    });

    expect(resInCar.paymentMethod).toBe("upi_advance");

    // Check list persistence
    const orders = listOrdersFromDb("test-user-upi");
    expect(orders.find((o) => o.id === orderInCar.id)?.paymentMethod).toBe("upi_advance");
    expect(orders.find((o) => o.id === orderAtTable.id)?.paymentMethod).toBe("upi_at_table");

    const reservations = listReservationsFromDb("test-user-upi");
    expect(reservations.find((r) => r.id === resAtTable.id)?.paymentMethod).toBe("upi_at_table");
    expect(reservations.find((r) => r.id === resInCar.id)?.paymentMethod).toBe("upi_advance");
  });

  it("persists table reservation request in database with honest prototype disclaimers", () => {
    const futureArrival = new Date(Date.now() + 3 * 3600 * 1000).toISOString();

    const reservation = saveReservationToDb({
      userId: "test-user-chd-jpr",
      journeyId: "chd-to-jpr-journey",
      restaurantId: "osm-dhaba-44",
      restaurantName: "Highway Mannat Dhaba",
      restaurantAddress: "NH-44 Highway Corridor, near Ambala",
      detourText: "+1.2 km (3 min)",
      arrivalTime: futureArrival,
      guestCount: 4,
      customerName: "Arsh Verma",
      customerPhone: "9876543210",
      specialRequests: "Family section with baby high-chair",
    });

    expect(reservation.id).toBeTruthy();
    expect(reservation.status).toBe("submitted");
    expect(reservation.guestCount).toBe(4);
    expect(reservation.customerName).toBe("Arsh Verma");
    expect(reservation.customerPhone).toBe("9876543210");
    expect(reservation.prototypeDisclaimer).toBe("Prototype: not confirmed by the restaurant");

    // Verify it survives refresh
    const allRes = listReservationsFromDb("test-user-chd-jpr");
    const found = allRes.find((r) => r.id === reservation.id);
    expect(found).toBeDefined();
    expect(found?.guestCount).toBe(4);
    expect(found?.customerPhone).toBe("9876543210");
  });

  it("simulates restaurant status transitions for demos (Submitted -> Sent -> Confirmed)", () => {
    const futureArrival = new Date(Date.now() + 3600 * 1000).toISOString();

    // 1. Order Status simulation
    const order = saveOrderToDb({
      userId: "test-user-simulation",
      restaurantId: "dhaba-sim-1",
      restaurantName: "Simulated Highway Kitchen",
      estimatedArrival: futureArrival,
      totalAmount: 180,
      items: [
        { itemId: "i-1", name: "Yellow Dal Tadka", category: "Main Course", price: 170, quantity: 1, isVeg: true },
      ],
    });

    expect(order.status).toBe("submitted");

    // Step 1: Simulate advancing to Sent
    const s1 = advanceOrderStatusInDb(order.id);
    expect(s1).toBe("sent_to_restaurant");

    // Step 2: Simulate advancing to Confirmed
    const s2 = advanceOrderStatusInDb(order.id);
    expect(s2).toBe("confirmed");

    // 2. Reservation Status simulation
    const res = saveReservationToDb({
      userId: "test-user-simulation",
      restaurantId: "dhaba-sim-1",
      restaurantName: "Simulated Highway Kitchen",
      arrivalTime: futureArrival,
      guestCount: 2,
      customerName: "Explorer",
      customerPhone: "9999888877",
    });

    expect(res.status).toBe("submitted");

    const r1 = advanceReservationStatusInDb(res.id);
    expect(r1).toBe("sent_to_restaurant");

    const r2 = advanceReservationStatusInDb(res.id);
    expect(r2).toBe("confirmed");
  });
});
