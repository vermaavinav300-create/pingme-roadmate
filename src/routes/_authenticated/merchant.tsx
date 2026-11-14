import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  UtensilsCrossed,
  Hotel,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  Phone,
  User,
  ShoppingBag,
  Users,
  Smartphone,
  ChevronRight,
  ShieldCheck,
  Building,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import { AppHeader } from "@/components/roadmate/AppHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listOrdersAndReservations, updateMerchantStatus, verifyUpiPayment } from "@/lib/orders.functions";
import type { DbOrder, DbReservation, DbHotelReservation, OrderStatus } from "@/lib/orders-db.server";

export const Route = createFileRoute("/_authenticated/merchant")({
  head: () => ({
    meta: [
      { title: "Merchant Terminal — PingME RoadMate" },
      { name: "description", content: "Live order and table reservation management for highway restaurants and hotels." },
    ],
  }),
  component: MerchantPage,
});

function MerchantPage() {
  const fetchAllFn = useServerFn(listOrdersAndReservations);
  const updateStatusFn = useServerFn(updateMerchantStatus);
  const verifyUpiFn = useServerFn(verifyUpiPayment);

  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [reservations, setReservations] = useState<DbReservation[]>([]);
  const [hotelReservations, setHotelReservations] = useState<DbHotelReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "food" | "tables" | "hotels">("all");
  const [selectedMerchant, setSelectedMerchant] = useState<string>("all");

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchAllFn();
      setOrders(res.orders || []);
      setReservations(res.reservations || []);
      setHotelReservations(res.hotelReservations || []);
    } catch (err) {
      toast.error("Failed to load merchant orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  // Unique list of merchants
  const merchantNames = Array.from(
    new Set([
      ...orders.map((o) => o.restaurantName),
      ...reservations.map((r) => r.restaurantName),
      ...hotelReservations.map((h) => h.hotelName),
    ]),
  ).filter(Boolean);

  const filteredOrders = orders.filter(
    (o) => selectedMerchant === "all" || o.restaurantName === selectedMerchant,
  );
  const filteredReservations = reservations.filter(
    (r) => selectedMerchant === "all" || r.restaurantName === selectedMerchant,
  );
  const filteredHotels = hotelReservations.filter(
    (h) => selectedMerchant === "all" || h.hotelName === selectedMerchant,
  );

  const totalRevenue =
    filteredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0) +
    filteredHotels.reduce((sum, h) => sum + (h.totalAmount || 0), 0);

  const pendingCount =
    filteredOrders.filter((o) => o.status === "submitted").length +
    filteredReservations.filter((r) => r.status === "submitted").length +
    filteredHotels.filter((h) => h.status === "submitted").length;

  const handleUpdate = async (type: "order" | "table" | "hotel", id: string, newStatus: OrderStatus) => {
    try {
      await updateStatusFn({ data: { type, id, newStatus } });
      toast.success(`Status updated to ${newStatus.replace("_", " ")}`);
      await loadData();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleVerifyUpi = async (type: "order" | "table" | "hotel", id: string) => {
    const utr = `UPI/${Date.now().toString().slice(-8)}/9901`;
    try {
      await verifyUpiFn({ data: { type, id, upiRef: utr } });
      toast.success(`Payment verified with UTR: ${utr}`);
      await loadData();
    } catch {
      toast.error("Payment verification failed");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Terminal Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-500/15 p-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <Building className="size-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Partner Tablet Terminal
              </span>
            </div>
            <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-foreground">
              Live Merchant Kitchen & Reception Portal
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live order management console for highway restaurants, dhabas, and hotels.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-1.5 text-xs">
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button asChild size="sm" variant="default" className="text-xs font-bold">
              <Link to="/orders">View Customer Tracker</Link>
            </Button>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-6">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Pending Action</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{pendingCount}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Requires merchant response</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Food Orders</p>
            <p className="text-2xl font-black text-foreground mt-1">{filteredOrders.length}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Advance kitchen pre-orders</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Table & Room Bookings</p>
            <p className="text-2xl font-black text-foreground mt-1">
              {filteredReservations.length + filteredHotels.length}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Reserved stops along route</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Incoming Volume</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">₹{totalRevenue}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Live prototype transaction flow</p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-muted p-1 text-xs font-bold border">
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded-lg px-3 py-1.5 transition ${activeTab === "all" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
            >
              All Items ({filteredOrders.length + filteredReservations.length + filteredHotels.length})
            </button>
            <button
              onClick={() => setActiveTab("food")}
              className={`rounded-lg px-3 py-1.5 transition ${activeTab === "food" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
            >
              🍽️ Food Orders ({filteredOrders.length})
            </button>
            <button
              onClick={() => setActiveTab("tables")}
              className={`rounded-lg px-3 py-1.5 transition ${activeTab === "tables" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
            >
              🪑 Tables ({filteredReservations.length})
            </button>
            <button
              onClick={() => setActiveTab("hotels")}
              className={`rounded-lg px-3 py-1.5 transition ${activeTab === "hotels" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
            >
              🏨 Hotels ({filteredHotels.length})
            </button>
          </div>

          {merchantNames.length > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-semibold">Filter Merchant:</span>
              <select
                value={selectedMerchant}
                onChange={(e) => setSelectedMerchant(e.target.value)}
                className="h-8 rounded-lg border bg-card px-2 text-xs font-medium"
              >
                <option value="all">All Establishments</option>
                {merchantNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {(activeTab === "all" || activeTab === "food") &&
            filteredOrders.map((order) => (
              <div key={order.id} className="rounded-xl border bg-card p-5 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-orange-500/10 px-2 py-0.5 text-xs font-bold text-orange-600">
                        Food Order
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">#{order.id.slice(0, 8)}</span>
                      <Badge
                        variant="outline"
                        className={
                          order.status === "confirmed"
                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 font-bold"
                            : order.status === "sent_to_restaurant"
                              ? "bg-amber-500/10 text-amber-700 border-amber-500/30 font-bold"
                              : "bg-blue-500/10 text-blue-700 border-blue-500/30 font-bold"
                        }
                      >
                        {order.status === "confirmed"
                          ? "✓ Confirmed / Preparing"
                          : order.status === "sent_to_restaurant"
                            ? "⚡ Kitchen Preparing"
                            : "🕒 Submitted (Pending)"}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-lg text-foreground mt-1">{order.restaurantName}</h3>
                    <p className="text-xs text-muted-foreground">
                      Expected Arrival: <strong className="text-foreground">{new Date(order.estimatedArrival).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong> ({order.detourText || "Along Route"})
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">₹{order.totalAmount}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">Payment: {order.paymentMethod.replace(/_/g, " ")}</p>
                  </div>
                </div>

                {/* Items */}
                <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
                  <p className="font-bold text-foreground mb-1">Ordered Dishes:</p>
                  {(order.items || []).map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-muted-foreground">
                      <span>{item.quantity} × {item.name} {item.isVeg ? "🟢" : "🔴"}</span>
                      <span className="font-mono">₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                  {order.notes && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 pt-1 border-t">
                      Note from driver: "{order.notes}"
                    </p>
                  )}
                </div>

                {/* Merchant Actions Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <div className="flex items-center gap-2">
                    {order.status === "submitted" && (
                      <Button
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1"
                        onClick={() => handleUpdate("order", order.id, "sent_to_restaurant")}
                      >
                        <Send className="size-3.5" /> Accept & Send to Kitchen
                      </Button>
                    )}
                    {order.status !== "confirmed" && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1"
                        onClick={() => handleUpdate("order", order.id, "confirmed")}
                      >
                        <CheckCircle2 className="size-3.5" /> Confirm Food Ready
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs font-semibold gap-1 text-emerald-600 hover:text-emerald-700"
                      onClick={() => handleVerifyUpi("order", order.id)}
                    >
                      <Smartphone className="size-3.5" /> Confirm UPI Paid
                    </Button>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Created: {new Date(order.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}

          {(activeTab === "all" || activeTab === "tables") &&
            filteredReservations.map((res) => (
              <div key={res.id} className="rounded-xl border bg-card p-5 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-sky-500/10 px-2 py-0.5 text-xs font-bold text-sky-600">
                        Table Reservation
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">#{res.id.slice(0, 8)}</span>
                      <Badge
                        variant="outline"
                        className={
                          res.status === "confirmed"
                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 font-bold"
                            : res.status === "sent_to_restaurant"
                              ? "bg-amber-500/10 text-amber-700 border-amber-500/30 font-bold"
                              : "bg-blue-500/10 text-blue-700 border-blue-500/30 font-bold"
                        }
                      >
                        {res.status === "confirmed" ? "✓ Table Reserved" : res.status === "sent_to_restaurant" ? "⚡ Processing" : "🕒 Pending"}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-lg text-foreground mt-1">{res.restaurantName}</h3>
                    <p className="text-xs text-muted-foreground">
                      Guest: <strong className="text-foreground">{res.customerName}</strong> ({res.customerPhone}) • Table for <strong className="text-foreground">{res.guestCount} guests</strong>
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Arrival Time</p>
                    <p className="text-base font-bold text-foreground">
                      {new Date(res.arrivalTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="text-[11px] text-muted-foreground capitalize">{res.paymentMethod.replace(/_/g, " ")}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <div className="flex items-center gap-2">
                    {res.status !== "confirmed" && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1"
                        onClick={() => handleUpdate("table", res.id, "confirmed")}
                      >
                        <CheckCircle2 className="size-3.5" /> Confirm Table Ready
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs font-semibold gap-1 text-emerald-600 hover:text-emerald-700"
                      onClick={() => handleVerifyUpi("table", res.id)}
                    >
                      <Smartphone className="size-3.5" /> Verify Table Payment
                    </Button>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Requested: {new Date(res.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}

          {(activeTab === "all" || activeTab === "hotels") &&
            filteredHotels.map((hotel) => (
              <div key={hotel.id} className="rounded-xl border bg-card p-5 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-purple-500/10 px-2 py-0.5 text-xs font-bold text-purple-600">
                        Hotel Room Stay
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">#{hotel.id.slice(0, 8)}</span>
                      <Badge
                        variant="outline"
                        className={
                          hotel.status === "confirmed"
                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 font-bold"
                            : hotel.status === "sent_to_restaurant"
                              ? "bg-amber-500/10 text-amber-700 border-amber-500/30 font-bold"
                              : "bg-blue-500/10 text-blue-700 border-blue-500/30 font-bold"
                        }
                      >
                        {hotel.status === "confirmed" ? "✓ Room Reserved" : hotel.status === "sent_to_restaurant" ? "⚡ Front Desk Processing" : "🕒 Pending"}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-lg text-foreground mt-1">{hotel.hotelName}</h3>
                    <p className="text-xs text-muted-foreground">
                      Guest: <strong className="text-foreground">{hotel.customerName}</strong> ({hotel.customerPhone}) • Room: <strong className="text-foreground">{hotel.roomType} ({hotel.roomCount} room, {hotel.guestCount} guests)</strong>
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total Bill</p>
                    <p className="text-xl font-black text-purple-600 dark:text-purple-400">₹{hotel.totalAmount}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">
                      {hotel.paymentStatus === "paid" ? "🟢 Paid via UPI" : "🟡 Payment Pending"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <div className="flex items-center gap-2">
                    {hotel.status !== "confirmed" && (
                      <Button
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs gap-1"
                        onClick={() => handleUpdate("hotel", hotel.id, "confirmed")}
                      >
                        <CheckCircle2 className="size-3.5" /> Confirm Room Key Ready
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs font-semibold gap-1 text-emerald-600 hover:text-emerald-700"
                      onClick={() => handleVerifyUpi("hotel", hotel.id)}
                    >
                      <Smartphone className="size-3.5" /> Mark Hotel UPI Paid
                    </Button>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Check-in: {new Date(hotel.checkIn).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}

          {!loading && filteredOrders.length === 0 && filteredReservations.length === 0 && filteredHotels.length === 0 && (
            <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
              <AlertCircle className="mx-auto mb-2 size-8 text-muted-foreground/60" />
              <p className="text-base font-bold">No active orders or reservations found</p>
              <p className="text-xs mt-1">
                When travelers place an advance food order or book a hotel along their route, they will appear here live.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
