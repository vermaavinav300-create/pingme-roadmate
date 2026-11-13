import { describeRouteFromSteps, type LatLng, type RouteOption } from "../src/lib/route-utils";

const USER_AGENT =
  "PingME-RoadMate/1.0 (Hackathon Prototype; https://github.com/vermaavinav300-create/pingme-roadmate)";

interface CoordinateEndpoint {
  name: string;
  placeId?: string | null;
}

interface RequestPayload {
  origin?: CoordinateEndpoint | LatLng;
  destination?: CoordinateEndpoint | LatLng;
}

interface ServerlessReq {
  method?: string;
  body?: unknown;
  json?: () => Promise<unknown>;
}

interface ServerlessRes {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => {
    json: (body: unknown) => void;
    end: () => void;
  };
}

async function resolveCoordinates(endpoint: CoordinateEndpoint): Promise<LatLng> {
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

async function fetchDrivingRoutes(
  start: LatLng,
  end: LatLng,
  orsKey?: string,
): Promise<RouteOption[]> {
  // 1. Try OpenRouteService if API key is configured
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
    } catch (err) {
      console.warn(
        "OpenRouteService request failed in serverless function, falling back to OSRM:",
        err,
      );
    }
  }

  // 2. Free OpenStreetMap OSRM fallback (no API key required)
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

  if (!osrmJson.code !== false && (!osrmJson.routes || osrmJson.routes.length === 0)) {
    throw new Error("No driving route found between these locations.");
  }

  return (osrmJson.routes ?? []).map((r, index) => {
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

/**
 * Vercel Serverless Function handler.
 * Compatible with Node.js Serverless runtime and Web standard fetch runtime.
 * OPENROUTESERVICE_API_KEY is read exclusively from process.env on the server.
 */
export default async function handler(
  req: ServerlessReq,
  res?: ServerlessRes,
) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    if (res && typeof res.setHeader === "function") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      return res.status(200).end();
    }
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    const errorMsg = { error: "Method not allowed. Use POST." };
    if (res && typeof res.status === "function") {
      return res.status(405).json(errorMsg);
    }
    return new Response(JSON.stringify(errorMsg), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    let body = req.body as RequestPayload | string | undefined;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body) as RequestPayload;
      } catch {
        // body remains string or undefined
      }
    } else if (!body && typeof req.json === "function") {
      body = (await req.json()) as RequestPayload;
    }

    const payload = body as RequestPayload | undefined;
    if (!payload || !payload.origin || !payload.destination) {
      const errorMsg = {
        error: "Missing required 'origin' and 'destination' fields in request body.",
      };
      if (res && typeof res.status === "function") {
        return res.status(400).json(errorMsg);
      }
      return new Response(JSON.stringify(errorMsg), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const originVal = payload.origin;
    const destVal = payload.destination;

    const start: LatLng =
      "lat" in originVal && typeof originVal.lat === "number" && typeof originVal.lng === "number"
        ? (originVal as LatLng)
        : await resolveCoordinates(originVal as CoordinateEndpoint);

    const end: LatLng =
      "lat" in destVal && typeof destVal.lat === "number" && typeof destVal.lng === "number"
        ? (destVal as LatLng)
        : await resolveCoordinates(destVal as CoordinateEndpoint);

    // Read the secret key on the server only
    const orsKey = process.env.OPENROUTESERVICE_API_KEY?.trim();
    const routes = await fetchDrivingRoutes(start, end, orsKey);

    const responseData = { routes };

    if (res && typeof res.status === "function") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.status(200).json(responseData);
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to calculate driving routes";
    const errorMsg = { error: message };
    if (res && typeof res.status === "function") {
      return res.status(500).json(errorMsg);
    }
    return new Response(JSON.stringify(errorMsg), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
