import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildJourneyRow } from "./route-utils";

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
  .inputValidator((input) => saveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("journeys")
      .insert(buildJourneyRow(data, context.userId))
      .select("id")
      .single();
    if (error) {
      console.error("saveJourney failed", error);
      throw new Error("Could not save your journey. Please try again.");
    }
    return { id: row.id };
  });

export const listJourneys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("journeys")
      .select(
        "id, origin_name, destination_name, route_description, distance_meters, duration_seconds, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Could not load your journeys.");
    return data;
  });

export const getJourney = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("journeys")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error("Could not load this journey.");
    return row;
  });

export const deleteJourney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("journeys").delete().eq("id", data.id);
    if (error) throw new Error("Could not delete this journey.");
    return { ok: true };
  });
