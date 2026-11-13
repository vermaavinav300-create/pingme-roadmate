// Pure, browser-safe helpers for places found along a route (OpenStreetMap data).

export type PlaceCategory = "restaurant" | "fuel" | "hotel";

export type RoutePlace = {
  id: string; // e.g. "node/123456"
  name: string | null;
  category: PlaceCategory;
  kind: string; // restaurant | fast_food | cafe | dhaba | fuel | hotel | guest_house | motel
  lat: number;
  lng: number;
  address: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string | null;
  distanceFromRouteM: number;
  alongRouteM: number;
};

/** Places are searched within this distance of the selected route. */
export const SEARCH_RADIUS_M = 5000;
/** Average speed used for the estimated detour time. */
export const DETOUR_SPEED_KMH = 40;
export const MIN_DETOUR_KM = 1;
export const MAX_DETOUR_KM = 10;

/**
 * Estimated detour = going from the route to the place and back again
 * (twice the straight distance from the route), driven at 40 km/h.
 */
export function estimateDetour(distanceFromRouteM: number): { meters: number; seconds: number } {
  const meters = 2 * distanceFromRouteM;
  const seconds = (meters / 1000 / DETOUR_SPEED_KMH) * 3600;
  return { meters, seconds };
}

export type PlaceSort = "nearest" | "name";

export function filterPlaces(
  places: RoutePlace[],
  opts: { category: PlaceCategory; maxDetourKm: number; sort: PlaceSort },
): RoutePlace[] {
  const maxDetourM = opts.maxDetourKm * 1000;
  const list = places.filter(
    (p) => p.category === opts.category && estimateDetour(p.distanceFromRouteM).meters <= maxDetourM,
  );
  if (opts.sort === "name") {
    return list.sort((a, b) => {
      if (!a.name && !b.name) return a.distanceFromRouteM - b.distanceFromRouteM;
      if (!a.name) return 1;
      if (!b.name) return -1;
      return a.name.localeCompare(b.name);
    });
  }
  return list.sort((a, b) => a.distanceFromRouteM - b.distanceFromRouteM);
}

/** Merges places from overlapping route stretches, keeping the closest measurement. */
export function mergePlaces(lists: RoutePlace[][]): RoutePlace[] {
  const byId = new Map<string, RoutePlace>();
  for (const list of lists) {
    for (const p of list) {
      const prev = byId.get(p.id);
      if (!prev || p.distanceFromRouteM < prev.distanceFromRouteM) byId.set(p.id, p);
    }
  }
  return [...byId.values()];
}

const KIND_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  fast_food: "Fast food",
  cafe: "Café",
  dhaba: "Dhaba",
  fuel: "Petrol pump",
  hotel: "Hotel",
  guest_house: "Guest house",
  motel: "Motel",
};
export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

type OsmElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function clean(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

/** Turns one Overpass element into a place, using only tags that exist in the data. */
export function placeFromOsm(el: OsmElement): Omit<RoutePlace, "distanceFromRouteM" | "alongRouteM"> | null {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat === undefined || lng === undefined) return null;

  let category: PlaceCategory;
  let kind: string;
  const amenity = tags["amenity"];
  const tourism = tags["tourism"];
  if (amenity === "fuel") {
    category = "fuel";
    kind = "fuel";
  } else if (amenity === "restaurant" || amenity === "fast_food" || amenity === "cafe") {
    category = "restaurant";
    const isDhaba =
      /dhaba/i.test(tags["name"] ?? "") || /dhaba/i.test(tags["cuisine"] ?? "") || tags["restaurant"] === "dhaba";
    kind = isDhaba ? "dhaba" : amenity;
  } else if (tourism === "hotel" || tourism === "guest_house" || tourism === "motel") {
    category = "hotel";
    kind = tourism;
  } else {
    return null;
  }

  const street = [clean(tags["addr:housenumber"]), clean(tags["addr:street"])].filter(Boolean).join(" ");
  const address =
    clean(tags["addr:full"]) ??
    ([street || null, clean(tags["addr:place"]) ?? clean(tags["addr:suburb"]), clean(tags["addr:city"]), clean(tags["addr:postcode"])]
      .filter(Boolean)
      .join(", ") ||
      null);

  return {
    id: `${el.type}/${el.id}`,
    name: clean(tags["name:en"]) ?? clean(tags["name"]) ?? clean(tags["brand"]),
    category,
    kind,
    lat,
    lng,
    address,
    phone: clean(tags["phone"]) ?? clean(tags["contact:phone"]) ?? clean(tags["contact:mobile"]),
    website: clean(tags["website"]) ?? clean(tags["contact:website"]),
    openingHours: clean(tags["opening_hours"]),
  };
}
