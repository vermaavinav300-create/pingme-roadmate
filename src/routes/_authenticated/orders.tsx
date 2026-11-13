import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ShoppingBag,
  Users,
  Clock,
  MapPin,
  UtensilsCrossed,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Send,
  Navigation,
  ArrowRight,
  Info,
  QrCode,
  Car,
  Smartphone,
  Banknote,
  Check,
} from "lucide-react";
import { AppHeader } from "@/components/roadmate/AppHeader";
import { Button } from "@/components/ui/button";
import {
  listOrdersAndReservations,
  advanceOrderStatus,
  advanceReservationStatus,
} from "@/lib/orders.functions";
import type { DbOrder, DbReservation, OrderStatus } from "@/lib/orders-db.server";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "Orders & Requests — PingME RoadMate" },
      { name: "description", content: "Track your advance food orders and table reservation requests." },
    ],
  }),
  component: OrdersPage,
});

function formatStatusLabel(status: OrderStatus): { label: string; colorClass: string; icon: any } {
  switch (status) {
    case "submitted":
      return {
        label: "Submitted",
        colorClass: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
        icon: Clock,
      };
    case "sent_to_restaurant":
      return {
        label: "Sent to restaurant (simulated)",
        colorClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
        icon: Send,
      };
    case "confirmed":
      return {
        label: "Confirmed (simulated)",
        colorClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
        icon: CheckCircle2,
      };
  }
}

function formatPaymentMethodBadge(method: string) {
  switch (method) {
    case "upi_advance":
      return {
        label: "📱 UPI: Pre-Paid from Car (Simulated)",
        detail: "Pre-paid from vehicle. Ready for rapid pickup / dining.",
        badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
        isUpiTable: false,
      };
    case "upi_at_table":
      return {
        label: "📱 UPI: Pay at Table upon Arrival",
        detail: "Scan table QR code after reaching to pay with GPay, PhonePe, or Paytm.",
        badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
        isUpiTable: true,
      };
    default:
      return {
        label: "💵 Cash / Card at Restaurant",
        detail: "Pay at counter or table upon arrival.",
        badgeClass: "bg-secondary text-secondary-foreground border-border",
        isUpiTable: false,
      };
  }
}

function OrdersPage() {
  const fetchAll = useServerFn(listOrdersAndReservations);
  const advanceOrderFn = useServerFn(advanceOrderStatus);
  const advanceReservationFn = useServerFn(advanceReservationStatus);

  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [reservations, setReservations] = useState<DbReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulatingId, setSimulatingId] = useState<string | null>(null);
  const [expandedQrId, setExpandedQrId] = useState<string | null>(null);

  // Tab filter: "all" | "orders" | "reservations"
  const [activeTab, setActiveTab] = useState<"all" | "orders" | "reservations">("all");

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchAll();
      setOrders(res.orders);
      setReservations(res.reservations);
    } catch (err) {
      toast.error("Could not load orders and reservations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Advance Order Status Simulation
  const handleAdvanceOrder = async (orderId: string) => {
    setSimulatingId(orderId);
    try {
      const res = await advanceOrderFn({ data: { orderId } });
      const nextLabel = formatStatusLabel(res.newStatus).label;
      toast.success(`Order status updated to: ${nextLabel}`);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: res.newStatus } : o)),
      );
    } catch (err) {
      toast.error("Could not simulate order response.");
    } finally {
      setSimulatingId(null);
    }
  };

  // Advance Reservation Status Simulation
  const handleAdvanceReservation = async (reservationId: string) => {
    setSimulatingId(reservationId);
    try {
      const res = await advanceReservationFn({ data: { reservationId } });
      const nextLabel = formatStatusLabel(res.newStatus).label;
      toast.success(`Reservation status updated to: ${nextLabel}`);
      setReservations((prev) =>
        prev.map((r) => (r.id === reservationId ? { ...r, status: res.newStatus } : r)),
      );
    } catch (err) {
      toast.error("Could not simulate reservation response.");
    } finally {
      setSimulatingId(null);
    }
  };

  const totalCount = orders.length + reservations.length;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-[1200px] px-4 py-8">
        {/* Page Title & Refresh */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Orders & Requests
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review your advance food orders and table reservations. Real persistent storage saved on your device.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="self-start gap-1.5 sm:self-auto"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {/* Category Tabs: All, Food Orders, Reservations */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-b pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            All Activity ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "orders"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShoppingBag className="size-3.5 text-orange-500" /> Food Orders ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("reservations")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "reservations"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="size-3.5 text-purple-500" /> Table Reservations ({reservations.length})
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="my-12 flex flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-xs font-medium">Loading your orders and reservations from database...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && totalCount === 0 && (
          <div className="my-12 rounded-2xl border border-dashed bg-card/50 p-10 text-center">
            <UtensilsCrossed className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <h3 className="font-display text-base font-bold">No orders or reservation requests yet</h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Plan a driving route, select any restaurant along the highway, and you can pre-order food or request a dining table before you arrive.
            </p>
            <div className="mt-5">
              <Button asChild variant="signal" size="default">
                <Link to="/plan">
                  Plan a Highway Trip <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* List of Orders and Reservations */}
        {!loading && totalCount > 0 && (
          <div className="mt-6 flex flex-col gap-4">
            {/* FOOD ORDERS */}
            {(activeTab === "all" || activeTab === "orders") &&
              orders.map((order) => {
                const statusMeta = formatStatusLabel(order.status);
                const paymentMeta = formatPaymentMethodBadge(order.paymentMethod || "upi_at_table");
                const StatusIcon = statusMeta.icon;
                const isSimulating = simulatingId === order.id;
                const isQrOpen = expandedQrId === order.id;

                return (
                  <div
                    key={order.id}
                    className="overflow-hidden rounded-2xl border bg-card p-5 shadow-xs transition hover:border-primary/40"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1 rounded bg-orange-500/10 px-2 py-0.5 text-[11px] font-bold text-orange-600 dark:text-orange-400">
                            <ShoppingBag className="size-3" /> Advance Food Order
                          </span>
                          <span
                            className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusMeta.colorClass}`}
                          >
                            <StatusIcon className="size-3" /> {statusMeta.label}
                          </span>
                          <span
                            className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${paymentMeta.badgeClass}`}
                          >
                            {paymentMeta.label}
                          </span>
                        </div>

                        <h3 className="mt-2 font-display text-lg font-bold">{order.restaurantName}</h3>

                        {order.restaurantAddress && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="size-3 text-muted-foreground/70" /> {order.restaurantAddress}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                          {order.detourText && (
                            <span className="rounded bg-secondary px-1.5 py-0.2 font-medium">
                              {order.detourText}
                            </span>
                          )}
                          <span>
                            Est. Arrival:{" "}
                            <strong className="text-foreground">
                              {new Date(order.estimatedArrival).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Total & Simulation Action Button */}
                      <div className="flex flex-col items-start gap-2 border-t pt-3 sm:items-end sm:border-t-0 sm:pt-0">
                        <div className="text-left sm:text-right">
                          <span className="text-[11px] text-muted-foreground">
                            {order.paymentMethod === "upi_advance" ? "Pre-Paid via UPI (In Car)" : "Pay at Table via UPI / Cash"}
                          </span>
                          <p className="font-display text-xl font-black text-primary">₹{order.totalAmount}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {order.paymentMethod === "upi_at_table" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setExpandedQrId(isQrOpen ? null : order.id)}
                              className="h-8 gap-1.5 text-xs font-semibold"
                            >
                              <QrCode className="size-3.5 text-primary" />
                              {isQrOpen ? "Hide Table QR" : "Show Table UPI QR"}
                            </Button>
                          )}

                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={isSimulating}
                            onClick={() => handleAdvanceOrder(order.id)}
                            className="h-8 gap-1.5 text-xs font-semibold"
                          >
                            <Sparkles className="size-3 text-amber-500" />
                            {isSimulating ? "Simulating..." : "Simulate restaurant response"}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Table UPI QR Drawer */}
                    {isQrOpen && (
                      <div className="mt-4 rounded-xl border border-dashed border-sky-400 bg-sky-50/60 dark:bg-sky-950/20 p-4">
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                          <div className="flex size-24 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-slate-800 bg-white p-2 shadow-xs">
                            <QrCode className="size-16 text-slate-900" />
                            <span className="text-[8px] font-bold text-slate-800 tracking-wider">UPI SCAN & PAY</span>
                          </div>
                          <div className="flex-1 text-center sm:text-left">
                            <h4 className="font-display text-sm font-bold flex items-center justify-center sm:justify-start gap-1.5 text-foreground">
                              <QrCode className="size-4 text-sky-600" /> Dining Table UPI QR Code (Ready to Scan)
                            </h4>
                            <p className="mt-1 text-xs text-muted-foreground leading-normal">
                              When you reach <strong className="text-foreground">{order.restaurantName}</strong>, scan this QR code right at your dining table to settle your bill.
                            </p>
                            <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs">
                              <span className="rounded bg-background px-2.5 py-1 font-mono font-semibold border text-[11px]">
                                UPI ID: {order.restaurantName.toLowerCase().replace(/[^a-z0-9]/g, "")}@icici
                              </span>
                              <span className="rounded bg-emerald-500/10 px-2 py-1 font-bold text-emerald-700 dark:text-emerald-300">
                                Total: ₹{order.totalAmount}
                              </span>
                            </div>
                            <p className="mt-1.5 text-[10px] text-muted-foreground">
                              Supported apps: Google Pay • PhonePe • Paytm • BHIM • Any Banking UPI
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Ordered Items List */}
                    {order.items && order.items.length > 0 && (
                      <div className="mt-4 rounded-xl bg-muted/50 p-3">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Ordered Items ({order.items.reduce((s, i) => s + i.quantity, 0)}):
                        </span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {order.items.map((item) => (
                            <span
                              key={item.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1 text-xs"
                            >
                              <span
                                className={`size-1.5 rounded-full ${item.isVeg ? "bg-emerald-600" : "bg-red-600"}`}
                              />
                              <span className="font-medium">{item.name}</span>
                              <span className="text-muted-foreground">× {item.quantity}</span>
                              <span className="font-semibold text-foreground/80">₹{item.price * item.quantity}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {order.notes && (
                      <p className="mt-2 text-xs italic text-muted-foreground">
                        📝 Notes: &ldquo;{order.notes}&rdquo;
                      </p>
                    )}

                    {/* Honest Transparency Note */}
                    <div className="mt-3 flex items-center justify-between border-t pt-2 text-[10px] text-muted-foreground/80">
                      <span>{order.prototypeDisclaimer}</span>
                      <span>Placed on {new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}

            {/* TABLE RESERVATIONS */}
            {(activeTab === "all" || activeTab === "reservations") &&
              reservations.map((res) => {
                const statusMeta = formatStatusLabel(res.status);
                const paymentMeta = formatPaymentMethodBadge(res.paymentMethod || "upi_at_table");
                const StatusIcon = statusMeta.icon;
                const isSimulating = simulatingId === res.id;
                const isQrOpen = expandedQrId === res.id;

                return (
                  <div
                    key={res.id}
                    className="overflow-hidden rounded-2xl border bg-card p-5 shadow-xs transition hover:border-primary/40"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1 rounded bg-purple-500/10 px-2 py-0.5 text-[11px] font-bold text-purple-600 dark:text-purple-400">
                            <Users className="size-3" /> Table Reservation Request
                          </span>
                          <span
                            className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusMeta.colorClass}`}
                          >
                            <StatusIcon className="size-3" /> {statusMeta.label}
                          </span>
                          <span
                            className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${paymentMeta.badgeClass}`}
                          >
                            {paymentMeta.label}
                          </span>
                        </div>

                        <h3 className="mt-2 font-display text-lg font-bold">{res.restaurantName}</h3>

                        {res.restaurantAddress && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="size-3 text-muted-foreground/70" /> {res.restaurantAddress}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            👥 {res.guestCount} {res.guestCount === 1 ? "Guest" : "Guests"}
                          </span>
                          <span>•</span>
                          <span>
                            Requested for:{" "}
                            <strong className="text-foreground">
                              {new Date(res.arrivalTime).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </strong>
                          </span>
                          <span>•</span>
                          <span>👤 {res.customerName} ({res.customerPhone})</span>
                        </div>
                      </div>

                      {/* Simulation & QR Buttons */}
                      <div className="flex flex-wrap items-center gap-2 border-t pt-3 sm:border-t-0 sm:pt-0">
                        {res.paymentMethod === "upi_at_table" && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setExpandedQrId(isQrOpen ? null : res.id)}
                            className="h-8 gap-1.5 text-xs font-semibold"
                          >
                            <QrCode className="size-3.5 text-primary" />
                            {isQrOpen ? "Hide Table QR" : "Show Table UPI QR"}
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={isSimulating}
                          onClick={() => handleAdvanceReservation(res.id)}
                          className="h-8 gap-1.5 text-xs font-semibold"
                        >
                          <Sparkles className="size-3 text-amber-500" />
                          {isSimulating ? "Simulating..." : "Simulate restaurant response"}
                        </Button>
                      </div>
                    </div>

                    {/* Interactive Table UPI QR Drawer */}
                    {isQrOpen && (
                      <div className="mt-4 rounded-xl border border-dashed border-sky-400 bg-sky-50/60 dark:bg-sky-950/20 p-4">
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                          <div className="flex size-24 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-slate-800 bg-white p-2 shadow-xs">
                            <QrCode className="size-16 text-slate-900" />
                            <span className="text-[8px] font-bold text-slate-800 tracking-wider">UPI SCAN & PAY</span>
                          </div>
                          <div className="flex-1 text-center sm:text-left">
                            <h4 className="font-display text-sm font-bold flex items-center justify-center sm:justify-start gap-1.5 text-foreground">
                              <QrCode className="size-4 text-sky-600" /> Dining Table UPI QR Code (Ready to Scan)
                            </h4>
                            <p className="mt-1 text-xs text-muted-foreground leading-normal">
                              When seated at your table at <strong className="text-foreground">{res.restaurantName}</strong>, scan this QR code to settle your final dining bill via UPI.
                            </p>
                            <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs">
                              <span className="rounded bg-background px-2.5 py-1 font-mono font-semibold border text-[11px]">
                                UPI ID: {res.restaurantName.toLowerCase().replace(/[^a-z0-9]/g, "")}@icici
                              </span>
                              <span className="rounded bg-primary/10 px-2 py-1 font-bold text-primary">
                                Table for {res.guestCount}
                              </span>
                            </div>
                            <p className="mt-1.5 text-[10px] text-muted-foreground">
                              Supported apps: Google Pay • PhonePe • Paytm • BHIM • Any Banking UPI
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {res.specialRequests && (
                      <p className="mt-3 rounded-lg bg-muted/40 p-2 text-xs italic text-muted-foreground">
                        Seating request: &ldquo;{res.specialRequests}&rdquo;
                      </p>
                    )}

                    <div className="mt-3 flex items-center justify-between border-t pt-2 text-[10px] text-muted-foreground/80">
                      <span>{res.prototypeDisclaimer}</span>
                      <span>Requested on {new Date(res.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </main>
    </div>
  );
}
