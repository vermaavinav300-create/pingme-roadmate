// Loads the Google Maps JavaScript API once, in the browser only.
// Uses the referrer-restricted browser key (safe to embed) — never the server key.

declare global {
  interface Window {
    __roadmateMapsReady?: () => void;
    google?: typeof google;
  }
}

let loading: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser only"));
  if (window.google?.maps?.Map) return Promise.resolve(window.google);
  if (loading) return loading;

  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as string | undefined;
  const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] as
    | string
    | undefined;
  if (!key) return Promise.reject(new Error("Map key missing"));

  loading = new Promise((resolve, reject) => {
    window.__roadmateMapsReady = () => {
      if (window.google) resolve(window.google);
      else reject(new Error("Google Maps failed to initialise"));
    };
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key,
      loading: "async",
      callback: "__roadmateMapsReady",
      language: "en",
      region: "IN",
    });
    if (channel) params.set("channel", channel);
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      loading = null;
      reject(new Error("Could not load Google Maps"));
    };
    document.head.appendChild(script);
  });
  return loading;
}
