import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type OrderStatus = "submitted" | "sent_to_restaurant" | "confirmed";

export type DbOrderItem = {
  id: string;
  orderId: string;
  itemId: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  isVeg: boolean;
};

export type DbOrder = {
  id: string;
  userId: string;
  journeyId: string | null;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string | null;
  detourText: string | null;
  estimatedArrival: string;
  notes: string | null;
  paymentMethod: string;
  totalAmount: number;
  status: OrderStatus;
  prototypeDisclaimer: string;
  createdAt: string;
  updatedAt: string;
  items?: DbOrderItem[];
};

export type DbReservation = {
  id: string;
  userId: string;
  journeyId: string | null;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string | null;
  detourText: string | null;
  arrivalTime: string;
  guestCount: number;
  customerName: string;
  customerPhone: string;
  specialRequests: string | null;
  paymentMethod: string;
  status: OrderStatus;
  prototypeDisclaimer: string;
  createdAt: string;
  updatedAt: string;
};

export type DbJourneyStop = {
  id: string;
  journeyId: string;
  placeId: string;
  name: string;
  kind: string;
  category: "restaurant" | "fuel" | "hotel";
  lat: number;
  lng: number;
  alongRouteM: number;
  distanceFromRouteM: number;
  detourMeters: number;
  detourSeconds: number;
  address?: string | null;
  phone?: string | null;
  openingHours?: string | null;
  createdAt: string;
};

export type UserPreferences = {
  userId: string;
  preferredMaxDetourKm: number;
  foodPreference: "any" | "veg" | "non-veg";
  alertDistanceKm: number;
  updatedAt: string;
};

export type LocalJourney = {
  id: string;
  userId: string;
  originName: string;
  originLat: number;
  originLng: number;
  destinationName: string;
  destinationLat: number;
  destinationLng: number;
  routeIndex: number;
  routeLabel: string | null;
  routeDescription: string | null;
  encodedPolyline: string;
  distanceMeters: number;
  durationSeconds: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

let dbInstance: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const dataDir = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "roadmate_stage3.sqlite");
  const db = new DatabaseSync(dbPath);

  // Set busy timeout before setting journal mode for high concurrency
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA journal_mode = WAL;");

  // Create persistent tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      journey_id TEXT,
      restaurant_id TEXT NOT NULL,
      restaurant_name TEXT NOT NULL,
      restaurant_address TEXT,
      detour_text TEXT,
      estimated_arrival TEXT NOT NULL,
      notes TEXT,
      payment_method TEXT NOT NULL DEFAULT 'pay_at_restaurant',
      total_amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted',
      prototype_disclaimer TEXT NOT NULL DEFAULT 'Prototype: not confirmed by the restaurant',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      is_veg INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reservation_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      journey_id TEXT,
      restaurant_id TEXT NOT NULL,
      restaurant_name TEXT NOT NULL,
      restaurant_address TEXT,
      detour_text TEXT,
      arrival_time TEXT NOT NULL,
      guest_count INTEGER NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      special_requests TEXT,
      payment_method TEXT NOT NULL DEFAULT 'upi_at_table',
      status TEXT NOT NULL DEFAULT 'submitted',
      prototype_disclaimer TEXT NOT NULL DEFAULT 'Prototype: not confirmed by the restaurant',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journey_stops (
      id TEXT PRIMARY KEY,
      journey_id TEXT NOT NULL,
      place_id TEXT NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      category TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      along_route_m REAL NOT NULL,
      distance_from_route_m REAL NOT NULL,
      detour_meters REAL NOT NULL,
      detour_seconds REAL NOT NULL,
      address TEXT,
      phone TEXT,
      opening_hours TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY,
      preferred_max_detour_km REAL NOT NULL DEFAULT 5.0,
      food_preference TEXT NOT NULL DEFAULT 'any',
      alert_distance_km REAL NOT NULL DEFAULT 5.0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_journeys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      origin_name TEXT NOT NULL,
      origin_lat REAL NOT NULL,
      origin_lng REAL NOT NULL,
      destination_name TEXT NOT NULL,
      destination_lat REAL NOT NULL,
      destination_lng REAL NOT NULL,
      route_index INTEGER NOT NULL DEFAULT 0,
      route_label TEXT,
      route_description TEXT,
      encoded_polyline TEXT NOT NULL,
      distance_meters INTEGER NOT NULL,
      duration_seconds INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_order_items ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_res_user ON reservation_requests(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_stops_journey ON journey_stops(journey_id, along_route_m ASC);
    CREATE INDEX IF NOT EXISTS idx_local_journeys_user ON local_journeys(user_id, created_at DESC);
  `);

  try {
    db.exec("ALTER TABLE reservation_requests ADD COLUMN payment_method TEXT DEFAULT 'upi_at_table';");
  } catch {
    // Column already exists
  }

  dbInstance = db;
  return dbInstance;
}

export function saveOrderToDb(data: {
  userId: string;
  journeyId?: string | null;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress?: string | null;
  detourText?: string | null;
  estimatedArrival: string;
  notes?: string | null;
  paymentMethod?: string | null;
  totalAmount: number;
  items: Array<{
    itemId: string;
    name: string;
    category: string;
    price: number;
    quantity: number;
    isVeg: boolean;
  }>;
}): DbOrder {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const paymentMethod = data.paymentMethod || "upi_at_table";

  const insertOrder = db.prepare(`
    INSERT INTO orders (
      id, user_id, journey_id, restaurant_id, restaurant_name, restaurant_address,
      detour_text, estimated_arrival, notes, payment_method, total_amount,
      status, prototype_disclaimer, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', 'Prototype: not confirmed by the restaurant', ?, ?)
  `);

  insertOrder.run(
    id,
    data.userId,
    data.journeyId ?? null,
    data.restaurantId,
    data.restaurantName,
    data.restaurantAddress ?? null,
    data.detourText ?? null,
    data.estimatedArrival,
    data.notes ?? null,
    paymentMethod,
    data.totalAmount,
    now,
    now,
  );

  const insertItem = db.prepare(`
    INSERT INTO order_items (id, order_id, item_id, name, category, price, quantity, is_veg)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const savedItems: DbOrderItem[] = [];
  for (const item of data.items) {
    const itemId = crypto.randomUUID();
    insertItem.run(
      itemId,
      id,
      item.itemId,
      item.name,
      item.category,
      item.price,
      item.quantity,
      item.isVeg ? 1 : 0,
    );
    savedItems.push({
      id: itemId,
      orderId: id,
      itemId: item.itemId,
      name: item.name,
      category: item.category,
      price: item.price,
      quantity: item.quantity,
      isVeg: item.isVeg,
    });
  }

  return {
    id,
    userId: data.userId,
    journeyId: data.journeyId ?? null,
    restaurantId: data.restaurantId,
    restaurantName: data.restaurantName,
    restaurantAddress: data.restaurantAddress ?? null,
    detourText: data.detourText ?? null,
    estimatedArrival: data.estimatedArrival,
    notes: data.notes ?? null,
    paymentMethod,
    totalAmount: data.totalAmount,
    status: "submitted",
    prototypeDisclaimer: "Prototype: not confirmed by the restaurant",
    createdAt: now,
    updatedAt: now,
    items: savedItems,
  };
}

export function saveReservationToDb(data: {
  userId: string;
  journeyId?: string | null;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress?: string | null;
  detourText?: string | null;
  arrivalTime: string;
  guestCount: number;
  customerName: string;
  customerPhone: string;
  specialRequests?: string | null;
  paymentMethod?: string | null;
}): DbReservation {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const paymentMethod = data.paymentMethod || "upi_at_table";

  const insert = db.prepare(`
    INSERT INTO reservation_requests (
      id, user_id, journey_id, restaurant_id, restaurant_name, restaurant_address,
      detour_text, arrival_time, guest_count, customer_name, customer_phone,
      special_requests, payment_method, status, prototype_disclaimer, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', 'Prototype: not confirmed by the restaurant', ?, ?)
  `);

  insert.run(
    id,
    data.userId,
    data.journeyId ?? null,
    data.restaurantId,
    data.restaurantName,
    data.restaurantAddress ?? null,
    data.detourText ?? null,
    data.arrivalTime,
    data.guestCount,
    data.customerName,
    data.customerPhone,
    data.specialRequests ?? null,
    paymentMethod,
    now,
    now,
  );

  return {
    id,
    userId: data.userId,
    journeyId: data.journeyId ?? null,
    restaurantId: data.restaurantId,
    restaurantName: data.restaurantName,
    restaurantAddress: data.restaurantAddress ?? null,
    detourText: data.detourText ?? null,
    arrivalTime: data.arrivalTime,
    guestCount: data.guestCount,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    specialRequests: data.specialRequests ?? null,
    paymentMethod,
    status: "submitted",
    prototypeDisclaimer: "Prototype: not confirmed by the restaurant",
    createdAt: now,
    updatedAt: now,
  };
}

export function listOrdersFromDb(userId?: string): DbOrder[] {
  const db = getDb();
  let rows: any[];
  if (userId) {
    rows = db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").all(userId);
  } else {
    rows = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
  }

  const getItems = db.prepare("SELECT * FROM order_items WHERE order_id = ?");

  return rows.map((r) => {
    const rawItems = getItems.all(r.id) as any[];
    const items: DbOrderItem[] = rawItems.map((i) => ({
      id: i.id,
      orderId: i.order_id,
      itemId: i.item_id,
      name: i.name,
      category: i.category,
      price: i.price,
      quantity: i.quantity,
      isVeg: Boolean(i.is_veg),
    }));

    return {
      id: r.id,
      userId: r.user_id,
      journeyId: r.journey_id,
      restaurantId: r.restaurant_id,
      restaurantName: r.restaurant_name,
      restaurantAddress: r.restaurant_address,
      detourText: r.detour_text,
      estimatedArrival: r.estimated_arrival,
      notes: r.notes,
      paymentMethod: r.payment_method,
      totalAmount: r.total_amount,
      status: r.status as OrderStatus,
      prototypeDisclaimer: r.prototype_disclaimer,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      items,
    };
  });
}

export function listReservationsFromDb(userId?: string): DbReservation[] {
  const db = getDb();
  let rows: any[];
  if (userId) {
    rows = db.prepare("SELECT * FROM reservation_requests WHERE user_id = ? ORDER BY created_at DESC").all(userId);
  } else {
    rows = db.prepare("SELECT * FROM reservation_requests ORDER BY created_at DESC").all();
  }

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    journeyId: r.journey_id,
    restaurantId: r.restaurant_id,
    restaurantName: r.restaurant_name,
    restaurantAddress: r.restaurant_address,
    detourText: r.detour_text,
    arrivalTime: r.arrival_time,
    guestCount: r.guest_count,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    specialRequests: r.special_requests,
    paymentMethod: r.payment_method || "upi_at_table",
    status: r.status as OrderStatus,
    prototypeDisclaimer: r.prototype_disclaimer,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function advanceOrderStatusInDb(orderId: string): OrderStatus {
  const db = getDb();
  const row = db.prepare("SELECT status FROM orders WHERE id = ?").get(orderId) as any;
  if (!row) throw new Error("Order not found");

  let nextStatus: OrderStatus = "submitted";
  if (row.status === "submitted") {
    nextStatus = "sent_to_restaurant";
  } else if (row.status === "sent_to_restaurant") {
    nextStatus = "confirmed";
  } else {
    nextStatus = "submitted";
  }

  const now = new Date().toISOString();
  db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(nextStatus, now, orderId);
  return nextStatus;
}

export function advanceReservationStatusInDb(reservationId: string): OrderStatus {
  const db = getDb();
  const row = db.prepare("SELECT status FROM reservation_requests WHERE id = ?").get(reservationId) as any;
  if (!row) throw new Error("Reservation request not found");

  let nextStatus: OrderStatus = "submitted";
  if (row.status === "submitted") {
    nextStatus = "sent_to_restaurant";
  } else if (row.status === "sent_to_restaurant") {
    nextStatus = "confirmed";
  } else {
    nextStatus = "submitted";
  }

  const now = new Date().toISOString();
  db.prepare("UPDATE reservation_requests SET status = ?, updated_at = ? WHERE id = ?").run(nextStatus, now, reservationId);
  return nextStatus;
}

// ==========================================
// STAGE 7: JOURNEY STOPS IMPLEMENTATION
// ==========================================

export function addStopToJourney(data: Omit<DbJourneyStop, "id" | "createdAt">): DbJourneyStop {
  const db = getDb();
  // Check if stop already added
  const existing = db
    .prepare("SELECT * FROM journey_stops WHERE journey_id = ? AND place_id = ?")
    .get(data.journeyId, data.placeId) as any;

  if (existing) {
    return {
      id: existing.id,
      journeyId: existing.journey_id,
      placeId: existing.place_id,
      name: existing.name,
      kind: existing.kind,
      category: existing.category,
      lat: existing.lat,
      lng: existing.lng,
      alongRouteM: existing.along_route_m,
      distanceFromRouteM: existing.distance_from_route_m,
      detourMeters: existing.detour_meters,
      detourSeconds: existing.detour_seconds,
      address: existing.address,
      phone: existing.phone,
      openingHours: existing.opening_hours,
      createdAt: existing.created_at,
    };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const insert = db.prepare(`
    INSERT INTO journey_stops (
      id, journey_id, place_id, name, kind, category, lat, lng,
      along_route_m, distance_from_route_m, detour_meters, detour_seconds,
      address, phone, opening_hours, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    id,
    data.journeyId,
    data.placeId,
    data.name,
    data.kind,
    data.category,
    data.lat,
    data.lng,
    data.alongRouteM,
    data.distanceFromRouteM,
    data.detourMeters,
    data.detourSeconds,
    data.address ?? null,
    data.phone ?? null,
    data.openingHours ?? null,
    now,
  );

  return {
    id,
    journeyId: data.journeyId,
    placeId: data.placeId,
    name: data.name,
    kind: data.kind,
    category: data.category,
    lat: data.lat,
    lng: data.lng,
    alongRouteM: data.alongRouteM,
    distanceFromRouteM: data.distanceFromRouteM,
    detourMeters: data.detourMeters,
    detourSeconds: data.detourSeconds,
    address: data.address ?? null,
    phone: data.phone ?? null,
    openingHours: data.openingHours ?? null,
    createdAt: now,
  };
}

export function removeStopFromJourney(stopId: string): boolean {
  const db = getDb();
  const info = db.prepare("DELETE FROM journey_stops WHERE id = ?").run(stopId);
  return info.changes > 0;
}

export function listStopsForJourney(journeyId: string): DbJourneyStop[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM journey_stops WHERE journey_id = ? ORDER BY along_route_m ASC")
    .all(journeyId) as any[];

  return rows.map((r) => ({
    id: r.id,
    journeyId: r.journey_id,
    placeId: r.place_id,
    name: r.name,
    kind: r.kind,
    category: r.category,
    lat: r.lat,
    lng: r.lng,
    alongRouteM: r.along_route_m,
    distanceFromRouteM: r.distance_from_route_m,
    detourMeters: r.detour_meters,
    detourSeconds: r.detour_seconds,
    address: r.address,
    phone: r.phone,
    openingHours: r.opening_hours,
    createdAt: r.created_at,
  }));
}

// ==========================================
// STAGE 7: USER PREFERENCES
// ==========================================

export function getUserPreferencesFromDb(userId = "default-user"): UserPreferences {
  const db = getDb();
  const row = db.prepare("SELECT * FROM user_preferences WHERE user_id = ?").get(userId) as any;
  if (!row) {
    return {
      userId,
      preferredMaxDetourKm: 5.0,
      foodPreference: "any",
      alertDistanceKm: 5.0,
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    userId: row.user_id,
    preferredMaxDetourKm: Number(row.preferred_max_detour_km),
    foodPreference: row.food_preference as "any" | "veg" | "non-veg",
    alertDistanceKm: Number(row.alert_distance_km),
    updatedAt: row.updated_at,
  };
}

export function saveUserPreferencesToDb(
  userId = "default-user",
  prefs: { preferredMaxDetourKm?: number; foodPreference?: "any" | "veg" | "non-veg"; alertDistanceKm?: number },
): UserPreferences {
  const db = getDb();
  const current = getUserPreferencesFromDb(userId);
  const now = new Date().toISOString();

  const nextMaxDetour = prefs.preferredMaxDetourKm ?? current.preferredMaxDetourKm;
  const nextFood = prefs.foodPreference ?? current.foodPreference;
  const nextAlert = prefs.alertDistanceKm ?? current.alertDistanceKm;

  db.prepare(`
    INSERT INTO user_preferences (user_id, preferred_max_detour_km, food_preference, alert_distance_km, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      preferred_max_detour_km = excluded.preferred_max_detour_km,
      food_preference = excluded.food_preference,
      alert_distance_km = excluded.alert_distance_km,
      updated_at = excluded.updated_at
  `).run(userId, nextMaxDetour, nextFood, nextAlert, now);

  return {
    userId,
    preferredMaxDetourKm: nextMaxDetour,
    foodPreference: nextFood,
    alertDistanceKm: nextAlert,
    updatedAt: now,
  };
}

// ==========================================
// STAGE 7: LOCAL JOURNEYS PERSISTENCE & RENAME
// ==========================================

export function saveLocalJourney(j: LocalJourney): LocalJourney {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO local_journeys (
      id, user_id, origin_name, origin_lat, origin_lng, destination_name, destination_lat, destination_lng,
      route_index, route_label, route_description, encoded_polyline, distance_meters, duration_seconds,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      route_label = excluded.route_label,
      route_description = excluded.route_description,
      status = excluded.status,
      updated_at = excluded.updated_at
  `).run(
    j.id,
    j.userId,
    j.originName,
    j.originLat,
    j.originLng,
    j.destinationName,
    j.destinationLat,
    j.destinationLng,
    j.routeIndex,
    j.routeLabel ?? null,
    j.routeDescription ?? null,
    j.encodedPolyline,
    j.distanceMeters,
    j.durationSeconds,
    j.status,
    j.createdAt || now,
    now,
  );

  return j;
}

export function listLocalJourneys(userId?: string): LocalJourney[] {
  const db = getDb();
  let rows: any[];
  if (userId) {
    rows = db.prepare("SELECT * FROM local_journeys WHERE user_id = ? ORDER BY created_at DESC").all(userId);
  } else {
    rows = db.prepare("SELECT * FROM local_journeys ORDER BY created_at DESC").all();
  }

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    originName: r.origin_name,
    originLat: r.origin_lat,
    originLng: r.origin_lng,
    destinationName: r.destination_name,
    destinationLat: r.destination_lat,
    destinationLng: r.destination_lng,
    routeIndex: r.route_index,
    routeLabel: r.route_label,
    routeDescription: r.route_description,
    encodedPolyline: r.encoded_polyline,
    distanceMeters: r.distance_meters,
    durationSeconds: r.duration_seconds,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function getLocalJourney(id: string): LocalJourney | null {
  const db = getDb();
  const r = db.prepare("SELECT * FROM local_journeys WHERE id = ?").get(id) as any;
  if (!r) return null;

  return {
    id: r.id,
    userId: r.user_id,
    originName: r.origin_name,
    originLat: r.origin_lat,
    originLng: r.origin_lng,
    destinationName: r.destination_name,
    destinationLat: r.destination_lat,
    destinationLng: r.destination_lng,
    routeIndex: r.route_index,
    routeLabel: r.route_label,
    routeDescription: r.route_description,
    encodedPolyline: r.encoded_polyline,
    distanceMeters: r.distance_meters,
    durationSeconds: r.duration_seconds,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function renameLocalJourney(id: string, newTitle: string): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  const res = db
    .prepare("UPDATE local_journeys SET route_description = ?, route_label = ?, updated_at = ? WHERE id = ?")
    .run(newTitle, newTitle, now, id);
  return res.changes > 0;
}

export function deleteLocalJourney(id: string): boolean {
  const db = getDb();
  db.prepare("DELETE FROM journey_stops WHERE journey_id = ?").run(id);
  const res = db.prepare("DELETE FROM local_journeys WHERE id = ?").run(id);
  return res.changes > 0;
}
