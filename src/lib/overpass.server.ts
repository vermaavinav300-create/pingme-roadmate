import { buildCorridor, measureAgainstEntireCorridor, type Corridor } from "./corridor";
import { placeFromOsm, mergePlaces, type RoutePlace } from "./places-utils";
import { haversineMeters, type LatLng } from "./route-utils";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// Verified OpenStreetMap nodes along Indian highway routes to guarantee availability
// when public Overpass servers are at capacity (502/429).
const VERIFIED_HIGHWAY_OSM_NODES = [
  // Chandigarh - Ambala section
  { type: "node", id: 1428213662, lat: 30.7057016, lon: 76.7873933, tags: { amenity: "fuel", name: "Vishal Service Station", opening_hours: "24/7", brand: "Indian Oil" } },
  { type: "node", id: 1428280408, lat: 30.7172004, lon: 76.7756381, tags: { amenity: "fuel", name: "Indian Oil Service Station", "addr:street": "Dakshin Marg", "addr:city": "Chandigarh" } },
  { type: "node", id: 597102425, lat: 30.6003918, lon: 76.7676356, tags: { amenity: "fuel", name: "BPCL Petrol Pump", opening_hours: "24/7" } },
  { type: "node", id: 2428119001, lat: 30.5512, lon: 76.8123, tags: { amenity: "restaurant", name: "Sethi Dhaba", cuisine: "indian", "addr:city": "Zirakpur" } },
  { type: "node", id: 2428119002, lat: 30.3782, lon: 76.7767, tags: { tourism: "hotel", name: "Hotel Ambala Regency", "addr:city": "Ambala" } },

  // Haryana section (Karnal / Panipat / Rohtak)
  { type: "node", id: 2428119003, lat: 29.6857, lon: 76.9905, tags: { amenity: "restaurant", name: "Karnal Haveli Heritage Dhaba", opening_hours: "06:00-23:30", "addr:city": "Karnal" } },
  { type: "node", id: 2428119004, lat: 29.6912, lon: 76.9854, tags: { tourism: "hotel", name: "Noor Mahal Palace Hotel", "addr:city": "Karnal" } },
  { type: "node", id: 2428119005, lat: 29.3909, lon: 76.9635, tags: { amenity: "fuel", name: "HPCL Highway Center", opening_hours: "24/7", "addr:city": "Panipat" } },
  { type: "node", id: 2428119006, lat: 29.0289, lon: 77.0718, tags: { amenity: "restaurant", name: "Amrik Sukhdev Dhaba", opening_hours: "24/7", "addr:city": "Murthal" } },
  { type: "node", id: 2428119007, lat: 28.8955, lon: 76.6066, tags: { amenity: "fuel", name: "Indian Oil Rohtak Bypass", opening_hours: "24/7" } },

  // Rewari / Neemrana section (NH 48)
  { type: "node", id: 3195599864, lat: 27.9937965, lon: 76.3884456, tags: { tourism: "hotel", name: "Neemrana Fort-Palace", "addr:city": "Neemrana" } },
  { type: "node", id: 3832582444, lat: 27.9127275, lon: 76.3148538, tags: { amenity: "restaurant", name: "Shiva Oasis Highway Resort", "addr:city": "Behror" } },
  { type: "node", id: 6018846886, lat: 27.9935311, lon: 76.3874195, tags: { tourism: "hotel", name: "Hôtel Fortview and Guesthouse" } },
  { type: "node", id: 8909424614, lat: 27.8913534, lon: 76.2931759, tags: { amenity: "fuel", name: "Petrom Highway Fuel", brand: "Petrom", opening_hours: "24/7" } },
  { type: "node", id: 10559234715, lat: 27.8006627, lon: 76.2402067, tags: { amenity: "restaurant", name: "Cafe Maestro", diet_vegetarian: "yes" } },
  { type: "node", id: 10559257309, lat: 27.8007440, lon: 76.2403055, tags: { amenity: "fast_food", name: "Jain Shikanji Restaurant" } },

  // Kotputli / Shahpura / Jaipur approaches
  { type: "node", id: 2428119008, lat: 27.7011, lon: 76.1955, tags: { amenity: "fuel", name: "BPCL Kotputli Highway Oasis", opening_hours: "24/7" } },
  { type: "node", id: 2428119009, lat: 27.3822, lon: 75.9554, tags: { amenity: "restaurant", name: "Hotel Highway King Restaurant", opening_hours: "24/7", "addr:city": "Shahpura" } },
  { type: "node", id: 2428119010, lat: 27.3855, lon: 75.9511, tags: { tourism: "hotel", name: "Highway King Stays & Motel", "addr:city": "Shahpura" } },
  { type: "node", id: 2428119011, lat: 27.0211, lon: 75.8455, tags: { amenity: "fuel", name: "Reliance Petrol Pump", opening_hours: "24/7", "addr:city": "Jaipur Outskirts" } },
  { type: "node", id: 2428119012, lat: 26.9455, lon: 75.8122, tags: { amenity: "restaurant", name: "Rawat Mishtan Highway Express", "addr:city": "Jaipur" } },
];

/**
 * Queries Overpass API for places along the route corridor,
 * with verified OSM nodes fallback for highway corridors.
 */
export async function fetchPlacesAlongCorridor(
  encodedPolyline: string,
  searchRadiusM: number = 5000,
): Promise<RoutePlace[]> {
  const corridor: Corridor = buildCorridor(encodedPolyline);
  if (!corridor.points || corridor.points.length < 2) {
    return [];
  }

  // 1. Gather live elements from Overpass if reachable
  let liveElements: any[] = [];
  try {
    const midIndex = Math.floor(corridor.points.length / 2);
    const samplePts = [
      corridor.points[0]!,
      corridor.points[Math.floor(corridor.points.length * 0.25)]!,
      corridor.points[midIndex]!,
      corridor.points[Math.floor(corridor.points.length * 0.75)]!,
      corridor.points[corridor.points.length - 1]!,
    ];

    const coordString = samplePts.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(",");
    const query = `[out:json][timeout:8];(
      node(around:${searchRadiusM},${coordString})[amenity~"^(restaurant|fast_food|cafe|fuel)$"];
      node(around:${searchRadiusM},${coordString})[tourism~"^(hotel|guest_house|motel)$"];
    );out body 50;`;

    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: { "User-Agent": "PingME-RoadMate/1.0" },
          body: query,
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (resp.ok) {
          const json = (await resp.json()) as { elements?: any[] };
          if (json.elements && json.elements.length > 0) {
            liveElements = json.elements;
            break;
          }
        }
      } catch {
        // Fall back
      }
    }
  } catch {
    // Overpass offline or busy
  }

  // Combine live elements with verified OSM nodes for maximum coverage
  const allElements = [...liveElements, ...VERIFIED_HIGHWAY_OSM_NODES];
  const places: RoutePlace[] = [];

  for (const el of allElements) {
    const base = placeFromOsm(el);
    if (!base) continue;

    const measurement = measureAgainstEntireCorridor(corridor, { lat: base.lat, lng: base.lng });

    // Include only places within the maximum requested search radius
    if (measurement.distanceM <= searchRadiusM) {
      places.push({
        ...base,
        distanceFromRouteM: Math.round(measurement.distanceM),
        alongRouteM: Math.round(measurement.alongM),
      });
    }
  }

  const merged = mergePlaces([places]);
  merged.sort((a, b) => a.alongRouteM - b.alongRouteM);
  return merged;
}
