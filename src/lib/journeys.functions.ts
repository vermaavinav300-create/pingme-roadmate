import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildJourneyRow } from "./route-utils";
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
  type DbJourneyStop,
  type UserPreferences,
} from "./orders-db.server";

const latLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

const saveSchema = z.object({
  origin: z.object({ name: z.string().trim().min(1).max(200), placeId: z.string().max(300).nullish() }),
  destination: z.object({
    name: z.string().trim().min(1).max(200),
    placeId: z.string().max(300).nullish(),
  }),
  route: z.object({
    index: z.number().int().min(0).max(10),
    description: z.string().max(300),
    labels: z.array(z.string().max(60)).max(10),
    distanceMeters: z.number().min(0),
    durationSeconds: z.number().min(0),
    encodedPolyline: z.string().min(1).max(200_000),
    warnings: z.array(z.string().max(500)).max(20),
    start: latLng,
    end: latLng,
  }),
});

export const saveJourney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const journeyId = crypto.randomUUID();
    const now = new Date().toISOString();

    // 1. Always persist locally in SQLite first (guarantees offline/local persistence)
    saveLocalJourney({
      id: journeyId,
      userId: context.userId || "default-user",
      originName: data.origin.name,
      originLat: data.route.start.lat,
      originLng: data.route.start.lng,
      destinationName: data.destination.name,
      destinationLat: data.route.end.lat,
      destinationLng: data.route.end.lng,
      routeIndex: data.route.index,
      routeLabel: data.route.labels[0] ?? null,
      routeDescription: data.route.description,
      encodedPolyline: data.route.encodedPolyline,
      distanceMeters: data.route.distanceMeters,
      durationSeconds: data.route.durationSeconds,
      status: "planned",
      createdAt: now,
      updatedAt: now,
    });

    // 2. Also save to Supabase cloud if available
    try {
      const rowData = {
        ...buildJourneyRow(data, context.userId),
        id: journeyId,
      };
      await context.supabase.from("journeys").insert(rowData);
    } catch (err) {
      console.warn("Could not mirror journey to Supabase (using SQLite):", err);
    }

    return { id: journeyId };
  });

export const listJourneys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // 1. Load from local SQLite
    const local = listLocalJourneys(context.userId);

    // 2. Load from Supabase if connected
    let cloudRows: any[] = [];
    try {
      const { data } = await context.supabase
        .from("journeys")
        .select(
          "id, origin_name, destination_name, route_description, distance_meters, duration_seconds, status, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) cloudRows = data;
    } catch {
      // Supabase not reachable or table not ready, local storage handles it
    }

    // Merge without duplicates
    const seen = new Set<string>();
    const merged: any[] = [];

    for (const j of local) {
      seen.add(j.id);
      merged.push({
        id: j.id,
        origin_name: j.originName,
        destination_name: j.destinationName,
        route_description: j.routeDescription,
        distance_meters: j.distanceMeters,
        duration_seconds: j.durationSeconds,
        status: j.status,
        created_at: j.createdAt,
      });
    }

    for (const j of cloudRows) {
      if (!seen.has(j.id)) {
        seen.add(j.id);
        merged.push(j);
      }
    }

    return merged;
  });

export const getJourney = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // Check local SQLite first
    const local = getLocalJourney(data.id);
    if (local) {
      return {
        id: local.id,
        user_id: local.userId,
        origin_name: local.originName,
        origin_lat: local.originLat,
        origin_lng: local.originLng,
        destination_name: local.destinationName,
        destination_lat: local.destinationLat,
        destination_lng: local.destinationLng,
        route_index: local.routeIndex,
        route_label: local.routeLabel,
        route_description: local.routeDescription,
        encoded_polyline: local.encodedPolyline,
        distance_meters: local.distanceMeters,
        duration_seconds: local.durationSeconds,
        status: local.status,
        created_at: local.createdAt,
        updated_at: local.updatedAt,
      };
    }

    // Fall back to Supabase
    try {
      const { data: row } = await context.supabase
        .from("journeys")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      if (row) return row;
    } catch {
      // fallback
    }

    return null;
  });

export const renameJourney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), newTitle: z.string().trim().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    renameLocalJourney(data.id, data.newTitle);
    try {
      await context.supabase
        .from("journeys")
        .update({ route_description: data.newTitle, route_label: data.newTitle })
        .eq("id", data.id);
    } catch {
      // handled
    }
    return { ok: true, id: data.id, newTitle: data.newTitle };
  });

export const deleteJourney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    deleteLocalJourney(data.id);
    try {
      await context.supabase.from("journeys").delete().eq("id", data.id);
    } catch {
      // handled
    }
    return { ok: true };
  });

// ==========================================
// STAGE 7: STOPS FUNCTIONS
// ==========================================

const stopInputSchema = z.object({
  journeyId: z.string().uuid(),
  placeId: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
  category: z.enum(["restaurant", "fuel", "hotel"]),
  lat: z.number(),
  lng: z.number(),
  alongRouteM: z.number(),
  distanceFromRouteM: z.number(),
  detourMeters: z.number(),
  detourSeconds: z.number(),
  address: z.string().nullish(),
  phone: z.string().nullish(),
  openingHours: z.string().nullish(),
});

export const addJourneyStop = createServerFn({ method: "POST" })
  .validator((input: unknown) => stopInputSchema.parse(input))
  .handler(async ({ data }) => {
    const saved = addStopToJourney({
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
    });
    return { stop: saved };
  });

export const removeJourneyStop = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ stopId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const ok = removeStopFromJourney(data.stopId);
    return { ok };
  });

export const listJourneyStops = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ journeyId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const stops = listStopsForJourney(data.journeyId);
    return { stops };
  });

// ==========================================
// STAGE 7: USER PREFERENCES FUNCTIONS
// ==========================================

const prefsSchema = z.object({
  preferredMaxDetourKm: z.number().min(1).max(10).optional(),
  foodPreference: z.enum(["any", "veg", "non-veg"]).optional(),
  alertDistanceKm: z.number().min(1).max(20).optional(),
});

export const getUserPreferences = createServerFn({ method: "GET" }).handler(async () => {
  const prefs = getUserPreferencesFromDb("default-user");
  return { preferences: prefs };
});

export const saveUserPreferences = createServerFn({ method: "POST" })
  .validator((input: unknown) => prefsSchema.parse(input))
  .handler(async ({ data }) => {
    const updated = saveUserPreferencesToDb("default-user", data);
    return { preferences: updated };
  });
