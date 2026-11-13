import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { googleMapsFetch } from "./google-maps.server";
import { parseDurationSeconds, type RouteOption } from "./route-utils";

export type PlaceSuggestion = { placeId: string; mainText: string; secondaryText: string };

// Bias suggestions to India (RoadMate's launch market) without blocking other places.
const INDIA_BIAS = {
  rectangle: {
    low: { latitude: 6.5, longitude: 68.0 },
    high: { latitude: 35.7, longitude: 97.4 },
  },
};

export const autocompletePlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ input: z.string().trim().min(2).max(120), sessionToken: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data }): Promise<PlaceSuggestion[]> => {
    const json = (await googleMapsFetch("/places/v1/places:autocomplete", {
      fieldMask:
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat",
      body: {
        input: data.input,
        sessionToken: data.sessionToken,
        locationBias: INDIA_BIAS,
        languageCode: "en",
        regionCode: "in",
      },
    })) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId: string;
          text?: { text: string };
          structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
        };
      }>;
    };
    return (json.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
      .slice(0, 6)
      .map((p) => ({
        placeId: p.placeId,
        mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
      }));
  });

const endpointSchema = z.object({
  name: z.string().trim().min(2).max(200),
  placeId: z.string().max(300).nullish(),
});

function toWaypoint(p: z.infer<typeof endpointSchema>) {
  return p.placeId ? { placeId: p.placeId } : { address: p.name };
}

export const computeDrivingRoutes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ origin: endpointSchema, destination: endpointSchema }).parse(input),
  )
  .handler(async ({ data }): Promise<{ routes: RouteOption[] }> => {
    const json = (await googleMapsFetch("/routes/directions/v2:computeRoutes", {
      fieldMask:
        "routes.distanceMeters,routes.duration,routes.description,routes.routeLabels,routes.warnings,routes.polyline.encodedPolyline,routes.legs.startLocation,routes.legs.endLocation",
      body: {
        origin: toWaypoint(data.origin),
        destination: toWaypoint(data.destination),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
        computeAlternativeRoutes: true,
        languageCode: "en-IN",
        regionCode: "IN",
        units: "METRIC",
      },
    })) as {
      routes?: Array<{
        distanceMeters?: number;
        duration?: string;
        description?: string;
        routeLabels?: string[];
        warnings?: string[];
        polyline?: { encodedPolyline?: string };
        legs?: Array<{
          startLocation?: { latLng?: { latitude: number; longitude: number } };
          endLocation?: { latLng?: { latitude: number; longitude: number } };
        }>;
      }>;
    };

    const routes: RouteOption[] = [];
    (json.routes ?? []).forEach((r, index) => {
      const start = r.legs?.[0]?.startLocation?.latLng;
      const end = r.legs?.[r.legs.length - 1]?.endLocation?.latLng;
      if (!r.polyline?.encodedPolyline || !start || !end || !r.duration) return;
      routes.push({
        index,
        description: r.description ?? "",
        labels: r.routeLabels ?? [],
        // Protobuf JSON omits zero values, so a missing distance on a valid route is 0.
        distanceMeters: r.distanceMeters ?? 0,
        durationSeconds: parseDurationSeconds(r.duration),
        encodedPolyline: r.polyline.encodedPolyline,
        warnings: r.warnings ?? [],
        start: { lat: start.latitude, lng: start.longitude },
        end: { lat: end.latitude, lng: end.longitude },
      });
    });
    return { routes };
  });
