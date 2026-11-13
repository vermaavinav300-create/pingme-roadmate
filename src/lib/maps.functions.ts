import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { describeRouteFromSteps, type LatLng, type RouteOption } from "./route-utils";

export type PlaceSuggestion = { placeId: string; mainText: string; secondaryText: string };

const USER_AGENT = "PingME-RoadMate/1.0 (Hackathon Prototype; https://github.com/vermaavinav300-create/pingme-roadmate)";

export const autocompletePlaces = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ input: z.string().trim().min(2).max(120), sessionToken: z.string().uuid().optional() })
      .parse(input),
  )
  .handler(async ({ data }): Promise<PlaceSuggestion[]> => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(data.input)}&format=json&addressdetails=1&limit=6&countrycodes=in`;
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!res.ok) return [];
      const items = (await res.json()) as Array<{
        place_id: number;
        display_name: string;
        name: string;
        lat: string;
        lon: string;
        address?: Record<string, string>;
      }>;

      return items.map((item) => {
        const parts = item.display_name.split(",").map((p) => p.trim());
        const mainText = item.name || parts[0] || "";
        const secondaryText = parts.slice(1, 4).join(", ");
        return {
          placeId: `${item.lat},${item.lon}`,
          mainText,
          secondaryText,
        };
      });
    } catch (err) {
      console.error("autocompletePlaces error:", err);
      return [];
    }
  });

const endpointSchema = z.object({
  name: z.string().trim().min(2).max(200),
  placeId: z.string().max(300).nullish(),
});

export async function resolveCoordinates(endpoint: z.infer<typeof endpointSchema>): Promise<LatLng> {
  if (endpoint.placeId && endpoint.placeId.includes(",")) {
    const [latStr, lngStr] = endpoint.placeId.split(",");
    const lat = parseFloat(latStr!);
    const lng = parseFloat(lngStr!);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }

  // Geocode by name via Nominatim
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(endpoint.name)}&format=json&limit=1&countrycodes=in`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Could not locate "${endpoint.name}"`);
  const items = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!items || items.length === 0) {
    throw new Error(`Location not found: "${endpoint.name}"`);
  }
  return { lat: parseFloat(items[0]!.lat), lng: parseFloat(items[0]!.lon) };
}

export async function calculateDrivingRoute(
  start: LatLng,
  end: LatLng,
  orsKey?: string,
): Promise<RouteOption[]> {
  // 1. Try OpenRouteService if API key is present
  if (orsKey) {
    try {
      const orsUrl = "https://api.openrouteservice.org/v2/directions/driving-car";
      const orsRes = await fetch(orsUrl, {
        method: "POST",
        headers: {
          Authorization: orsKey,
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
        },
        body: JSON.stringify({
          coordinates: [
            [start.lng, start.lat],
            [end.lng, end.lat],
          ],
          alternative_routes: { target_count: 2 },
        }),
      });

      if (orsRes.ok) {
        const json = await orsRes.json();
        const orsRoutes = json.routes as Array<{
          geometry: string;
          summary: { distance: number; duration: number };
          segments?: Array<{ steps?: Array<{ name: string; distance: number }> }>;
        }>;

        if (orsRoutes && orsRoutes.length > 0) {
          return orsRoutes.map((r, index) => {
            const allSteps = (r.segments ?? []).flatMap((s) => s.steps ?? []);
            const desc = describeRouteFromSteps(allSteps);
            return {
              index,
              description: desc,
              labels: index === 0 ? ["FASTEST"] : ["ALTERNATIVE"],
              distanceMeters: r.summary.distance,
              durationSeconds: r.summary.duration,
              encodedPolyline: r.geometry,
              warnings: [],
              start,
              end,
            };
          });
        }
      }
    } catch (orsErr) {
      console.warn("OpenRouteService request failed, falling back to OSRM:", orsErr);
    }
  }

  // 2. Free OSRM (Open Source Routing Machine) - No API key required
  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=polyline&steps=true&alternatives=true`;
  const osrmRes = await fetch(osrmUrl, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!osrmRes.ok) {
    throw new Error(`Routing service returned error code ${osrmRes.status}`);
  }

  const osrmJson = (await osrmRes.json()) as {
    code: string;
    routes?: Array<{
      distance: number;
      duration: number;
      geometry: string;
      legs?: Array<{ steps?: Array<{ name: string; distance: number }> }>;
    }>;
  };

  if (osrmJson.code !== "Ok" || !osrmJson.routes || osrmJson.routes.length === 0) {
    throw new Error("No driving route found between these locations.");
  }

  return osrmJson.routes.map((r, index) => {
    const allSteps = (r.legs ?? []).flatMap((l) => l.steps ?? []);
    const desc = describeRouteFromSteps(allSteps);
    return {
      index,
      description: desc,
      labels: index === 0 ? ["FASTEST"] : ["ALTERNATIVE"],
      distanceMeters: r.distance,
      durationSeconds: r.duration,
      encodedPolyline: r.geometry,
      warnings: [],
      start,
      end,
    };
  });
}

export const computeDrivingRoutes = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ origin: endpointSchema, destination: endpointSchema }).parse(input),
  )
  .handler(async ({ data }): Promise<{ routes: RouteOption[] }> => {
    const start = await resolveCoordinates(data.origin);
    const end = await resolveCoordinates(data.destination);
    const orsKey = process.env["OPENROUTESERVICE_API_KEY"]?.trim();
    const routes = await calculateDrivingRoute(start, end, orsKey);
    return { routes };
  });
