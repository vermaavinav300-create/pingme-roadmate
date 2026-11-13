-- Stage 7: Journey Stops & User Preferences
-- Persistent storage for upcoming stops and traveler preferences

CREATE TABLE IF NOT EXISTS public.journey_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  category TEXT NOT NULL, -- 'restaurant', 'fuel', 'hotel'
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  along_route_m DOUBLE PRECISION NOT NULL,
  distance_from_route_m DOUBLE PRECISION NOT NULL,
  detour_meters DOUBLE PRECISION NOT NULL,
  detour_seconds DOUBLE PRECISION NOT NULL,
  address TEXT,
  phone TEXT,
  opening_hours TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_max_detour_km DOUBLE PRECISION NOT NULL DEFAULT 5.0,
  food_preference TEXT NOT NULL DEFAULT 'any', -- 'any', 'veg', 'non-veg'
  alert_distance_km DOUBLE PRECISION NOT NULL DEFAULT 5.0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journey_stops_journey_along ON public.journey_stops (journey_id, along_route_m ASC);

-- Row Level Security
ALTER TABLE public.journey_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own journey stops" ON public.journey_stops FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.journeys j WHERE j.id = journey_id AND j.user_id = auth.uid()));
CREATE POLICY "Users insert own journey stops" ON public.journey_stops FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.journeys j WHERE j.id = journey_id AND j.user_id = auth.uid()));
CREATE POLICY "Users delete own journey stops" ON public.journey_stops FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.journeys j WHERE j.id = journey_id AND j.user_id = auth.uid()));

CREATE POLICY "Users manage own preferences" ON public.user_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
