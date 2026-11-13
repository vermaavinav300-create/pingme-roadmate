-- Cached OpenStreetMap places found along one stretch (segment) of a saved journey
CREATE TABLE public.journey_place_segments (
  journey_id UUID NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL,
  user_id UUID NOT NULL,
  places JSONB NOT NULL DEFAULT '[]'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (journey_id, segment_index)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_place_segments TO authenticated;
GRANT ALL ON public.journey_place_segments TO service_role;
ALTER TABLE public.journey_place_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own place cache" ON public.journey_place_segments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own place cache" ON public.journey_place_segments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.journeys j WHERE j.id = journey_id AND j.user_id = auth.uid()));
CREATE POLICY "Users update own place cache" ON public.journey_place_segments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own place cache" ON public.journey_place_segments FOR DELETE TO authenticated USING (auth.uid() = user_id);