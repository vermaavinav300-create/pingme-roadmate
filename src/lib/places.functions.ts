import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchPlacesAlongCorridor } from "./overpass.server";
import type { RoutePlace } from "./places-utils";

export const getRoutePlaces = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        encodedPolyline: z.string().min(5),
        searchRadiusM: z.number().min(500).max(15000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ places: RoutePlace[] }> => {
    try {
      const places = await fetchPlacesAlongCorridor(data.encodedPolyline, data.searchRadiusM ?? 5000);
      return { places };
    } catch (err) {
      console.error("getRoutePlaces error:", err);
      return { places: [] };
    }
  });
