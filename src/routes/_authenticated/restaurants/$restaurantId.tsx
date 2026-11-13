import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  UtensilsCrossed,
  Clock,
  Navigation,
  MapPin,
  ShoppingBag,
  Users,
  Calendar,
  Phone,
  User,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
  DollarSign,
  ChevronRight,
  QrCode,
  Car,
  Smartphone,
  Banknote,
  Check,
} from "lucide-react";
import { AppHeader } from "@/components/roadmate/AppHeader";
import { Button } from "@/components/ui/button";
import { getRestaurantMenu, MENU_DISCLAIMER, PROTOTYPE_DISCLAIMER, type MenuItem } from "@/lib/menu-data";
import { placeAdvanceOrder, requestTableReservation } from "@/lib/orders.functions";
import { getUserPreferences } from "@/lib/journeys.functions";

type SearchParams = {
  name?: string | undefined;
  address?: string | undefined;
  detourKm?: string | undefined;
  detourMin?: string | undefined;
  alongRouteM?: string | undefined;
  journeyId?: string | undefined;
};

export const Route = createFileRoute("/_authenticated/restaurants/$restaurantId")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    name: typeof search["name"] === "string" ? search["name"] : undefined,
    address: typeof search["address"] === "string" ? search["address"] : undefined,
    detourKm: typeof search["detourKm"] === "string" ? search["detourKm"] : undefined,
    detourMin: typeof search["detourMin"] === "string" ? search["detourMin"] : undefined,
    alongRouteM: typeof search["alongRouteM"] === "string" ? search["alongRouteM"] : undefined,
    journeyId: typeof search["journeyId"] === "string" ? search["journeyId"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Restaurant Menu & Orders — PingME RoadMate" },
      { name: "description", content: "Advance food ordering and table reservation request." },
    ],
  }),
  component: RestaurantDetailPage,
});

function formatDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function RestaurantDetailPage() {
  const { restaurantId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();

  const placeOrderFn = useServerFn(placeAdvanceOrder);
  const requestReservationFn = useServerFn(requestTableReservation);
  const fetchPrefsFn = useServerFn(getUserPreferences);

  const restaurantName = search.name || "Highway Dhaba & Restaurant";
  const restaurantAddress = search.address || "Highway Corridor (OpenStreetMap Node)";
  const detourKm = search.detourKm ? `${search.detourKm} km` : "Quick detour";
  const detourMin = search.detourMin ? `${search.detourMin} min` : "Under 5 min";

  // Calculate default estimated arrival based on distance along route (~60 km/h highway speed)
  const defaultArrivalDate = useMemo(() => {
    const alongMeters = search.alongRouteM ? parseFloat(search.alongRouteM) : 0;
    // Est. 1 min per km (approx 60 km/h) plus 15 min buffer, minimum 20 mins from now
    const travelMinutes = Math.max(20, Math.round((alongMeters / 1000) * 1.1) + 15);
    return new Date(Date.now() + travelMinutes * 60 * 1000);
  }, [search.alongRouteM]);

  // Menu items (deterministic per restaurant)
  const menu = useMemo(() => getRestaurantMenu(restaurantId, restaurantName), [restaurantId, restaurantName]);

  // Active top tab: "order" or "reserve"
  const [activeMode, setActiveMode] = useState<"order" | "reserve">("order");

  // Veg/Non-Veg filter state: "all" | "veg" | "non-veg"
  const [dietFilter, setDietFilter] = useState<"all" | "veg" | "non-veg">("all");

  // Load user saved food preference as default filter
  useEffect(() => {
    fetchPrefsFn()
      .then((res) => {
        if (res.preferences?.foodPreference && res.preferences.foodPreference !== "any") {
          setDietFilter(res.preferences.foodPreference);
        }
      })
      .catch(() => {});
  }, []);

  // Cart state: item ID -> quantity
  const [cart, setCart] = useState<Record<string, number>>({});

  // Order form state
  const [orderArrivalTime, setOrderArrivalTime] = useState(() => formatDatetimeLocal(defaultArrivalDate));
  const [orderNotes, setOrderNotes] = useState("");
  const [orderPaymentMethod, setOrderPaymentMethod] = useState<"upi_at_table" | "upi_advance" | "pay_at_restaurant">("upi_at_table");
  const [orderUpiApp, setOrderUpiApp] = useState<"gpay" | "phonepe" | "paytm" | "upi_id">("gpay");
  const [orderUpiId, setOrderUpiId] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Reservation form state
  const [resArrivalTime, setResArrivalTime] = useState(() => formatDatetimeLocal(defaultArrivalDate));
  const [resGuestCount, setResGuestCount] = useState<number>(2);
  const [resCustomerName, setResCustomerName] = useState("");
  const [resCustomerPhone, setResCustomerPhone] = useState("");
  const [resSpecialRequests, setResSpecialRequests] = useState("");
  const [resPaymentMethod, setResPaymentMethod] = useState<"upi_at_table" | "upi_advance" | "pay_at_restaurant">("upi_at_table");
  const [submittingReservation, setSubmittingReservation] = useState(false);

  // Cart handlers
  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[itemId] || 0;
      const next = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: next };
    });
  };

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const item = menu.find((m) => m.id === id);
        return item ? { ...item, quantity: qty } : null;
      })
      .filter((i): i is MenuItem & { quantity: number } => i !== null);
  }, [cart, menu]);

  const totalAmount = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cartItems]);

  const totalItemCount = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems]);

  // Filtered menu based on veg/non-veg selection
  const filteredMenu = useMemo(() => {
    if (dietFilter === "veg") return menu.filter((i) => i.isVeg);
    if (dietFilter === "non-veg") return menu.filter((i) => !i.isVeg);
    return menu;
  }, [menu, dietFilter]);

  // Group menu by category
  const categories = useMemo(() => {
    const cats = Array.from(new Set(filteredMenu.map((m) => m.category)));
    return cats;
  }, [filteredMenu]);

  // Submit Advance Food Order
  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault();
    if (cartItems.length === 0) {
      toast.error("Your cart is empty. Please add at least one dish from the menu.");
      return;
    }

    const arrivalDate = new Date(orderArrivalTime);
    if (isNaN(arrivalDate.getTime()) || arrivalDate.getTime() < Date.now() - 60000) {
      toast.error("Estimated arrival time must be in the future.");
      return;
    }

    setSubmittingOrder(true);
    try {
      const res = await placeOrderFn({
        data: {
          journeyId: search.journeyId,
          restaurantId,
          restaurantName,
          restaurantAddress,
          detourText: `+${detourKm} (${detourMin})`,
          estimatedArrival: orderArrivalTime,
          notes: orderNotes.trim() || undefined,
          paymentMethod: orderPaymentMethod,
          items: cartItems.map((item) => ({
            itemId: item.id,
            name: item.name,
            category: item.category,
            price: item.price,
            quantity: item.quantity,
            isVeg: item.isVeg,
          })),
        },
      });

      const payMsg =
        orderPaymentMethod === "upi_advance"
          ? "Advance order placed & pre-paid via UPI (in car)!"
          : orderPaymentMethod === "upi_at_table"
            ? "Advance order placed! Pay via UPI at table upon arrival."
            : "Advance order placed! Pay at restaurant counter.";
      toast.success(payMsg);
      navigate({ to: "/orders" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to place order.");
    } finally {
      setSubmittingOrder(false);
    }
  }

  // Submit Table Reservation Request
  async function handleRequestReservation(e: React.FormEvent) {
    e.preventDefault();

    if (!resCustomerName.trim() || resCustomerName.trim().length < 2) {
      toast.error("Please enter your full name.");
      return;
    }

    const digitsOnly = resCustomerPhone.replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }

    const arrivalDate = new Date(resArrivalTime);
    if (isNaN(arrivalDate.getTime()) || arrivalDate.getTime() < Date.now() - 60000) {
      toast.error("Reservation arrival time must be in the future.");
      return;
    }

    if (resGuestCount < 1 || resGuestCount > 30) {
      toast.error("Please specify between 1 and 30 guests.");
      return;
    }

    setSubmittingReservation(true);
    try {
      await requestReservationFn({
        data: {
          journeyId: search.journeyId,
          restaurantId,
          restaurantName,
          restaurantAddress,
          detourText: `+${detourKm} (${detourMin})`,
          arrivalTime: resArrivalTime,
          guestCount: resGuestCount,
          customerName: resCustomerName.trim(),
          customerPhone: resCustomerPhone.trim(),
          specialRequests: resSpecialRequests.trim() || undefined,
          paymentMethod: resPaymentMethod,
        },
      });

      const resMsg =
        resPaymentMethod === "upi_advance"
          ? "Table reserved with advance UPI verification (in car)!"
          : resPaymentMethod === "upi_at_table"
            ? "Table reserved! Pay via UPI at table after dining."
            : "Table reservation request submitted!";
      toast.success(resMsg);
      navigate({ to: "/orders" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit reservation.");
    } finally {
      setSubmittingReservation(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-[1300px] px-4 py-6">
        {/* Back navigation */}
        <div className="mb-4">
          {search.journeyId ? (
            <Link
              to="/journeys/$journeyId"
              params={{ journeyId: search.journeyId }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="size-4" /> Back to Driving Route
            </Link>
          ) : (
            <Link
              to="/plan"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="size-4" /> Back to Trip Planner
            </Link>
          )}
        </div>

        {/* Restaurant Header Card */}
        <div className="rounded-2xl border bg-card p-5 shadow-xs">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                  <UtensilsCrossed className="size-4" />
                </span>
                <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{restaurantName}</h1>
                <span className="rounded bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                  Highway Stop
                </span>
              </div>

              <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3.5 shrink-0 text-muted-foreground/70" />
                {restaurantAddress}
              </p>

              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300">
                  +{detourKm} detour ({detourMin})
                </span>
                <span className="text-muted-foreground/50">•</span>
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="size-3" /> Est. arrival around{" "}
                  {defaultArrivalDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>

            {/* Prototype & Sample Disclaimers */}
            <div className="flex flex-col gap-1.5 border-t pt-3 md:border-t-0 md:pt-0 md:text-right">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="size-3" /> {PROTOTYPE_DISCLAIMER}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Info className="size-3" /> {MENU_DISCLAIMER}
              </span>
            </div>
          </div>

          {/* Mode Switcher Tabs: Advance Food Order vs Table Reservation */}
          <div className="mt-5 grid grid-cols-2 gap-2 border-t pt-4">
            <button
              type="button"
              onClick={() => setActiveMode("order")}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                activeMode === "order"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShoppingBag className="size-4" />
              <span>Advance Food Order</span>
              {totalItemCount > 0 && (
                <span className="rounded-full bg-primary-foreground text-primary px-1.5 py-0.2 text-xs font-bold">
                  {totalItemCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveMode("reserve")}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                activeMode === "reserve"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="size-4" />
              <span>Table Reservation Request</span>
            </button>
          </div>
        </div>

        {/* MODE 1: ADVANCE FOOD ORDER */}
        {activeMode === "order" && (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column: Menu Items & Veg/Non-Veg Filter */}
            <div className="lg:col-span-7">
              {/* Filter controls */}
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Menu:</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setDietFilter("all")}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        dietFilter === "all" ? "bg-secondary text-secondary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      All ({menu.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDietFilter("veg")}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        dietFilter === "veg" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="size-2 rounded-full bg-emerald-600" />
                      Veg ({menu.filter((m) => m.isVeg).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDietFilter("non-veg")}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        dietFilter === "non-veg" ? "bg-red-500/15 text-red-700 dark:text-red-400 font-semibold" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="size-2 rounded-full bg-red-600" />
                      Non-Veg ({menu.filter((m) => !m.isVeg).length})
                    </button>
                  </div>
                </div>

                <span className="text-[11px] text-muted-foreground italic">Prices in INR (₹)</span>
              </div>

              {/* Menu Sections Grouped by Category */}
              <div className="mt-4 flex flex-col gap-6">
                {categories.map((cat) => {
                  const itemsInCat = filteredMenu.filter((m) => m.category === cat);
                  if (itemsInCat.length === 0) return null;

                  return (
                    <div key={cat} className="flex flex-col gap-2.5">
                      <h3 className="font-display text-sm font-bold tracking-tight text-foreground/80 uppercase tracking-wider">
                        {cat}
                      </h3>

                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {itemsInCat.map((item) => {
                          const qty = cart[item.id] || 0;

                          return (
                            <div
                              key={item.id}
                              className={`flex flex-col justify-between rounded-xl border p-3.5 transition-all ${
                                qty > 0 ? "border-primary/50 bg-primary/5 shadow-xs" : "bg-card hover:border-border/80"
                              }`}
                            >
                              <div>
                                <div className="flex items-start justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5">
                                    {/* FSSAI Veg/Non-Veg Indicator */}
                                    <span
                                      className={`flex size-3.5 shrink-0 items-center justify-center border ${
                                        item.isVeg ? "border-emerald-600" : "border-red-600"
                                      } p-0.5`}
                                    >
                                      <span
                                        className={`size-1.5 rounded-full ${
                                          item.isVeg ? "bg-emerald-600" : "bg-red-600"
                                        }`}
                                      />
                                    </span>
                                    <h4 className="font-semibold text-sm leading-snug">{item.name}</h4>
                                  </div>

                                  <span className="font-display text-sm font-bold text-foreground">
                                    ₹{item.price}
                                  </span>
                                </div>

                                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                                  {item.description}
                                </p>
                              </div>

                              <div className="mt-3 flex items-center justify-end border-t pt-2">
                                {qty === 0 ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateQuantity(item.id, 1)}
                                    className="h-8 gap-1 text-xs font-semibold hover:border-primary hover:text-primary"
                                  >
                                    <Plus className="size-3.5" /> Add
                                  </Button>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => updateQuantity(item.id, -1)}
                                      className="flex size-7 items-center justify-center rounded-lg border bg-background text-foreground transition hover:bg-secondary"
                                    >
                                      <Minus className="size-3" />
                                    </button>
                                    <span className="w-5 text-center font-display text-sm font-bold">{qty}</span>
                                    <button
                                      type="button"
                                      onClick={() => updateQuantity(item.id, 1)}
                                      className="flex size-7 items-center justify-center rounded-lg border bg-background text-foreground transition hover:bg-secondary"
                                    >
                                      <Plus className="size-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Cart & Checkout Form */}
            <div className="lg:col-span-5">
              <div className="sticky top-20 rounded-2xl border bg-card p-5 shadow-xs">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="flex items-center gap-2 font-display text-base font-bold">
                    <ShoppingBag className="size-4 text-primary" /> Your Food Cart
                  </h3>
                  {totalItemCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setCart({})}
                      className="text-xs text-muted-foreground hover:text-destructive transition"
                    >
                      Clear cart
                    </button>
                  )}
                </div>

                {/* Cart Items List */}
                {cartItems.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <ShoppingBag className="mx-auto mb-2 size-8 text-muted-foreground/40" />
                    <p className="text-sm font-semibold">Your cart is empty</p>
                    <p className="mt-1 text-xs">Add delicious dishes from the menu to prepare your advance order.</p>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col divide-y">
                    {cartItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-2.5 text-xs">
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="truncate font-medium">{item.name}</p>
                          <span className="text-muted-foreground">
                            {item.quantity} × ₹{item.price}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-display font-semibold">₹{item.quantity * item.price}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, -1)}
                              className="size-6 rounded border bg-background flex items-center justify-center text-xs"
                            >
                              -
                            </button>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, 1)}
                              className="size-6 rounded border bg-background flex items-center justify-center text-xs"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="pt-3">
                      <div className="flex items-center justify-between font-display text-base font-bold">
                        <span>Total Payable:</span>
                        <span className="text-primary">₹{totalAmount}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Advance Order Settings Form */}
                <form onSubmit={handlePlaceOrder} className="mt-4 flex flex-col gap-3.5 border-t pt-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground">
                      Estimated Arrival Time <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={orderArrivalTime}
                      onChange={(e) => setOrderArrivalTime(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Pre-filled based on your travel time from start. You can change it.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground">
                      Cooking / Order Notes (optional)
                    </label>
                    <textarea
                      rows={2}
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="e.g. Keep ready for takeaway, make it less spicy"
                      className="mt-1.5 w-full rounded-lg border bg-background p-2.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  {/* Payment Method Selector */}
                  <div className="flex flex-col gap-2">
                    <label className="block text-xs font-semibold text-muted-foreground">
                      Choose How You Want to Pay:
                    </label>

                    {/* Option 1: UPI at Table */}
                    <label
                      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-all ${
                        orderPaymentMethod === "upi_at_table"
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "bg-card hover:bg-muted/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="orderPaymentMethod"
                        value="upi_at_table"
                        checked={orderPaymentMethod === "upi_at_table"}
                        onChange={() => setOrderPaymentMethod("upi_at_table")}
                        className="mt-0.5 text-primary"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-foreground flex items-center gap-1">
                            <QrCode className="size-3.5 text-primary" /> 📱 Pay via UPI at Table (After Reaching)
                          </span>
                          <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                            Recommended
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground leading-normal">
                          Pre-order now. When you arrive at the restaurant and sit at your table, scan the table UPI QR code to pay with Google Pay, PhonePe, or Paytm.
                        </p>
                      </div>
                    </label>

                    {/* Option 2: UPI In Advance (In Car) */}
                    <label
                      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-all ${
                        orderPaymentMethod === "upi_advance"
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "bg-card hover:bg-muted/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="orderPaymentMethod"
                        value="upi_advance"
                        checked={orderPaymentMethod === "upi_advance"}
                        onChange={() => setOrderPaymentMethod("upi_advance")}
                        className="mt-0.5 text-primary"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-foreground flex items-center gap-1">
                            <Car className="size-3.5 text-emerald-600" /> 📱 Pay via UPI Now (In Your Car)
                          </span>
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                            Pre-Paid
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground leading-normal">
                          Pay in advance from your vehicle right now so your order is confirmed and hot when you arrive.
                        </p>

                        {orderPaymentMethod === "upi_advance" && (
                          <div className="mt-2.5 rounded-lg border bg-background/90 p-2.5">
                            <p className="text-[11px] font-semibold text-muted-foreground">
                              Select UPI App (Simulated Pre-Payment):
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {[
                                { id: "gpay", name: "Google Pay" },
                                { id: "phonepe", name: "PhonePe" },
                                { id: "paytm", name: "Paytm" },
                                { id: "upi_id", name: "UPI ID" },
                              ].map((app) => (
                                <button
                                  key={app.id}
                                  type="button"
                                  onClick={() => setOrderUpiApp(app.id as any)}
                                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                                    orderUpiApp === app.id
                                      ? "bg-primary text-primary-foreground font-bold"
                                      : "bg-muted text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  {app.name}
                                </button>
                              ))}
                            </div>
                            {orderUpiApp === "upi_id" && (
                              <input
                                type="text"
                                placeholder="e.g. mobile@upi or yourname@okhdfcbank"
                                value={orderUpiId}
                                onChange={(e) => setOrderUpiId(e.target.value)}
                                className="mt-2 w-full rounded border bg-card px-2 py-1 text-xs"
                              />
                            )}
                            <p className="mt-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                              <CheckCircle2 className="size-3" /> One-click simulated advance payment of ₹{totalAmount}
                            </p>
                          </div>
                        )}
                      </div>
                    </label>

                    {/* Option 3: Cash / Card at Counter */}
                    <label
                      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-all ${
                        orderPaymentMethod === "pay_at_restaurant"
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "bg-card hover:bg-muted/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="orderPaymentMethod"
                        value="pay_at_restaurant"
                        checked={orderPaymentMethod === "pay_at_restaurant"}
                        onChange={() => setOrderPaymentMethod("pay_at_restaurant")}
                        className="mt-0.5 text-primary"
                      />
                      <div className="flex-1">
                        <span className="font-semibold text-xs text-foreground flex items-center gap-1">
                          <Banknote className="size-3.5 text-muted-foreground" /> 💵 Pay Cash / Card at Restaurant Counter
                        </span>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Pay directly with cash or debit/credit card when you arrive at the restaurant.
                        </p>
                      </div>
                    </label>
                  </div>

                  <Button
                    type="submit"
                    variant="signal"
                    size="lg"
                    disabled={submittingOrder || cartItems.length === 0}
                    className="w-full font-bold"
                  >
                    {submittingOrder ? "Placing Advance Order..." : `Place Advance Order • ₹${totalAmount}`}
                  </Button>

                  <p className="text-center text-[10px] text-muted-foreground">
                    Prototype: not confirmed by the restaurant.
                  </p>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* MODE 2: TABLE RESERVATION REQUEST */}
        {activeMode === "reserve" && (
          <div className="mx-auto mt-6 max-w-xl">
            <div className="rounded-2xl border bg-card p-6 shadow-xs">
              <div className="border-b pb-4">
                <h3 className="flex items-center gap-2 font-display text-lg font-bold">
                  <Users className="size-5 text-primary" /> Request a Dining Table
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Send your estimated arrival time and guest count so the dhaba or restaurant can prepare seating.
                </p>
              </div>

              <form onSubmit={handleRequestReservation} className="mt-5 flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Estimated Arrival Date & Time <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={resArrivalTime}
                    onChange={(e) => setResArrivalTime(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Must be in the future. Based on your current driving pace.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground">
                      Number of Guests <span className="text-destructive">*</span>
                    </label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setResGuestCount((g) => Math.max(1, g - 1))}
                        className="flex size-9 items-center justify-center rounded-lg border bg-background font-bold text-foreground hover:bg-secondary"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        required
                        value={resGuestCount}
                        onChange={(e) => setResGuestCount(parseInt(e.target.value) || 1)}
                        className="h-9 w-full rounded-lg border bg-background text-center text-sm font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => setResGuestCount((g) => Math.min(30, g + 1))}
                        className="flex size-9 items-center justify-center rounded-lg border bg-background font-bold text-foreground hover:bg-secondary"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground">
                      Contact Mobile Number <span className="text-destructive">*</span>
                    </label>
                    <div className="relative mt-1.5">
                      <Phone className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <input
                        type="tel"
                        required
                        placeholder="10-digit mobile number"
                        value={resCustomerPhone}
                        onChange={(e) => setResCustomerPhone(e.target.value)}
                        className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Your Full Name <span className="text-destructive">*</span>
                  </label>
                  <div className="relative mt-1.5">
                    <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rohan Sharma"
                      value={resCustomerName}
                      onChange={(e) => setResCustomerName(e.target.value)}
                      className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Special Seating Requests (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={resSpecialRequests}
                    onChange={(e) => setResSpecialRequests(e.target.value)}
                    placeholder="e.g. AC family section, infant high chair, quiet corner"
                    className="mt-1.5 w-full rounded-lg border bg-background p-2.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                {/* Dining Payment Preference */}
                <div className="flex flex-col gap-2">
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Dining Payment Preference:
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <label
                      className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 transition ${
                        resPaymentMethod === "upi_at_table"
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "bg-card hover:bg-muted/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="resPaymentMethod"
                        value="upi_at_table"
                        checked={resPaymentMethod === "upi_at_table"}
                        onChange={() => setResPaymentMethod("upi_at_table")}
                        className="mt-0.5 text-primary"
                      />
                      <div>
                        <span className="text-xs font-semibold flex items-center gap-1">
                          <QrCode className="size-3 text-primary" /> 📱 Pay via UPI at Table
                        </span>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          Scan UPI QR at the table after meal
                        </p>
                      </div>
                    </label>

                    <label
                      className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 transition ${
                        resPaymentMethod === "upi_advance"
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "bg-card hover:bg-muted/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="resPaymentMethod"
                        value="upi_advance"
                        checked={resPaymentMethod === "upi_advance"}
                        onChange={() => setResPaymentMethod("upi_advance")}
                        className="mt-0.5 text-primary"
                      />
                      <div>
                        <span className="text-xs font-semibold flex items-center gap-1">
                          <Car className="size-3 text-emerald-600" /> 📱 Verify via UPI from Car
                        </span>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          Pre-confirm from vehicle via UPI
                        </p>
                      </div>
                    </label>

                    <label
                      className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 transition ${
                        resPaymentMethod === "pay_at_restaurant"
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "bg-card hover:bg-muted/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="resPaymentMethod"
                        value="pay_at_restaurant"
                        checked={resPaymentMethod === "pay_at_restaurant"}
                        onChange={() => setResPaymentMethod("pay_at_restaurant")}
                        className="mt-0.5 text-primary"
                      />
                      <div>
                        <span className="text-xs font-semibold flex items-center gap-1">
                          <Banknote className="size-3 text-muted-foreground" /> 💵 Cash / Card
                        </span>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          Settle bill directly upon arrival
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Reservation Disclaimer Rule */}
                <div className="rounded-xl border border-dashed bg-secondary/40 p-3 text-xs">
                  <p className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="size-3.5" /> Prototype Reservation Request
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    This reservation request is a prototype demonstration. Tables are not guaranteed and remain subject to actual on-arrival availability at the restaurant.
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="signal"
                  size="lg"
                  disabled={submittingReservation}
                  className="mt-2 w-full font-bold"
                >
                  {submittingReservation ? "Submitting Request..." : "Submit Table Reservation Request"}
                </Button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
