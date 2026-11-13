-- Stage 3: Orders, Order Items, and Table Reservation Requests
-- Real persistent storage schema for restaurant advance food orders and table reservations

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  journey_id UUID,
  restaurant_id TEXT NOT NULL,
  restaurant_name TEXT NOT NULL,
  restaurant_address TEXT,
  detour_text TEXT,
  estimated_arrival TIMESTAMPTZ NOT NULL,
  notes TEXT,
  payment_method TEXT NOT NULL DEFAULT 'pay_at_restaurant',
  total_amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted', -- 'submitted', 'sent_to_restaurant', 'confirmed'
  prototype_disclaimer TEXT NOT NULL DEFAULT 'Prototype: not confirmed by the restaurant',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  is_veg BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.reservation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  journey_id UUID,
  restaurant_id TEXT NOT NULL,
  restaurant_name TEXT NOT NULL,
  restaurant_address TEXT,
  detour_text TEXT,
  arrival_time TIMESTAMPTZ NOT NULL,
  guest_count INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  special_requests TEXT,
  payment_method TEXT NOT NULL DEFAULT 'upi_at_table',
  status TEXT NOT NULL DEFAULT 'submitted', -- 'submitted', 'sent_to_restaurant', 'confirmed'
  prototype_disclaimer TEXT NOT NULL DEFAULT 'Prototype: not confirmed by the restaurant',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row Level Security policies
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own orders" ON public.orders FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users read own order items" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "Users insert own order items" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

CREATE POLICY "Users read own reservations" ON public.reservation_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own reservations" ON public.reservation_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own reservations" ON public.reservation_requests FOR UPDATE TO authenticated USING (auth.uid() = user_id);
