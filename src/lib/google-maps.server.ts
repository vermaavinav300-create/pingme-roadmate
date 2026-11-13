// Server-only: calls Google Maps Platform through Lovable's connector gateway.
// API keys never reach the browser.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export async function googleMapsFetch(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; fieldMask?: string } = {},
): Promise<unknown> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) {
    throw new Error("Google Maps is not connected for this app yet.");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": mapsKey,
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.fieldMask) headers["X-Goog-FieldMask"] = init.fieldMask;

  const response = await fetch(`${GATEWAY_URL}${path}`, {
    method: init.method ?? "POST",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : null,
  });

  if (response.status === 403) {
    const text = await response.text();
    console.error(`Google Maps 403: ${text}`);
    throw new Error("Google Maps refused this request (403). Check the Maps connection settings.");
  }
  if (!response.ok) {
    const text = await response.text();
    console.error(`Google Maps request failed [${response.status}]: ${text}`);
    throw new Error(`Google Maps request failed (${response.status}).`);
  }
  return response.json();
}
