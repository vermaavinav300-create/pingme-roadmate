import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Hotel,
  Clock,
  Navigation,
  MapPin,
  Users,
  Calendar,
  Phone,
  User,
  CheckCircle2,
  AlertTriangle,
  Info,
  DollarSign,
  ChevronRight,
  QrCode,
  Smartphone,
  Banknote,
  Check,
  Bed,
  Wifi,
  Sparkles,
} from "lucide-react";
import { AppHeader } from "@/components/roadmate/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getHotelRooms, HOTEL_DISCLAIMER, type RoomOption } from "@/lib/hotel-data";
import { requestHotelReservation } from "@/lib/orders.functions";
import { UpiPaymentDialog } from "@/components/roadmate/UpiPaymentDialog";

type SearchParams = {
  name?: string | undefined;
  address?: string | undefined;
  detourKm?: string | undefined;
  detourMin?: string | undefined;
  alongRouteM?: string | undefined;
  journeyId?: string | undefined;
};

export const Route = createFileRoute("/_authenticated/hotels/$hotelId")({
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
      { title: "Hotel Rooms & Reservation — PingME RoadMate" },
      { name: "description", content: "Highway hotel room booking and night stay reservation." },
    ],
  }),
  component: HotelDetailPage,
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

function HotelDetailPage() {
  const { hotelId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();

  const requestBookingFn = useServerFn(requestHotelReservation);

  const hotelName = search.name || "Highway Hotel & Stay";
  const hotelAddress = search.address || "Highway Corridor (OpenStreetMap Node)";
  const detourKm = search.detourKm ? `${search.detourKm} km` : "Quick detour";
  const detourMin = search.detourMin ? `${search.detourMin} min` : "Under 5 min";

  // Calculate default estimated arrival date
  const defaultArrivalDate = useMemo(() => {
    const alongMeters = search.alongRouteM ? parseFloat(search.alongRouteM) : 0;
    const travelMinutes = Math.max(30, Math.round((alongMeters / 1000) * 1.1) + 20);
    return new Date(Date.now() + travelMinutes * 60 * 1000);
  }, [search.alongRouteM]);

  const hotelData = useMemo(() => getHotelRooms(hotelId, hotelName), [hotelId, hotelName]);

  const [selectedRoomId, setSelectedRoomId] = useState<string>("dlx-room");
  const [checkInTime, setCheckInTime] = useState<string>(formatDatetimeLocal(defaultArrivalDate));
  const [guestCount, setGuestCount] = useState<number>(2);
  const [roomCount, setRoomCount] = useState<number>(1);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"upi_at_checkin" | "upi_advance" | "pay_at_hotel">("upi_at_checkin");
  const [submitting, setSubmitting] = useState(false);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [createdReservationId, setCreatedReservationId] = useState<string>("");

  const selectedRoom = hotelData.rooms.find((r) => r.id === selectedRoomId) || hotelData.rooms[0]!;
  const totalAmount = selectedRoom.pricePerNight * roomCount;

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!guestName.trim() || guestName.trim().length < 2) {
      toast.error("Please enter a valid guest name.");
      return;
    }

    const digitsOnly = guestPhone.replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }

    const arrivalDate = new Date(checkInTime);
    if (isNaN(arrivalDate.getTime()) || arrivalDate.getTime() < Date.now() - 2 * 60 * 1000) {
      toast.error("Check-in time must be in the future.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await requestBookingFn({
        data: {
          journeyId: search.journeyId ?? null,
          hotelId,
          hotelName,
          hotelAddress,
          detourText: `${detourKm} (${detourMin})`,
          checkIn: checkInTime,
          guestCount,
          roomCount,
          roomType: selectedRoom.name,
          customerName: guestName.trim(),
          customerPhone: guestPhone.trim(),
          specialRequests: specialRequests.trim() || null,
          paymentMethod,
          totalAmount,
        },
      });

      const newId = res.reservation.id;
      setCreatedReservationId(newId);
      toast.success("Hotel reservation request submitted!");

      if (paymentMethod === "upi_advance") {
        setShowUpiModal(true);
      } else {
        navigate({ to: "/orders" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit reservation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <UpiPaymentDialog
        open={showUpiModal}
        onOpenChange={(open) => {
          setShowUpiModal(open);
          if (!open) navigate({ to: "/orders" });
        }}
        payeeName={hotelName}
        amount={totalAmount}
        orderId={createdReservationId}
        orderType="hotel"
        onPaymentSuccess={() => {
          setTimeout(() => navigate({ to: "/orders" }), 1500);
        }}
      />

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link
          to={search.journeyId ? "/journeys/$journeyId" : "/journeys"}
          params={search.journeyId ? { journeyId: search.journeyId } : undefined}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to Route Stops
        </Link>

        {/* Hotel Header Banner */}
        <div className="rounded-2xl border bg-card p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-purple-100 dark:bg-purple-950/60 p-2 text-purple-600">
                  <Hotel className="size-5" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Highway Stay & Hotel
                </span>
              </div>
              <h1 className="mt-2 text-2xl md:text-3xl font-extrabold text-foreground">{hotelName}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" /> {hotelAddress}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                +{detourKm} detour ({detourMin})
              </span>
              <span className="rounded-xl border bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Clock className="size-3.5" /> Check-in: 12:00 PM
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <Info className="size-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{HOTEL_DISCLAIMER}</p>
              <p className="opacity-90">All bookings are prototype demonstrations and not confirmed by the hotel.</p>
            </div>
          </div>
        </div>

        {/* Room Selection & Booking Form */}
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          {/* Room Categories */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Bed className="size-5 text-purple-600" /> Choose Your Room
            </h2>

            <div className="grid gap-3 sm:grid-cols-2">
              {hotelData.rooms.map((room) => {
                const isSelected = room.id === selectedRoomId;
                return (
                  <div
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`cursor-pointer rounded-xl border p-4 transition-all hover:border-purple-500/50 ${
                      isSelected
                        ? "border-purple-600 bg-purple-50/50 dark:bg-purple-950/20 ring-2 ring-purple-600/20 shadow-xs"
                        : "bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase text-secondary-foreground">
                          {room.category}
                        </span>
                        <h3 className="font-bold text-base mt-1 text-foreground">{room.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{room.bedType}</p>
                      </div>
                      <span className="text-right">
                        <span className="text-lg font-black text-purple-600 dark:text-purple-400">
                          ₹{room.pricePerNight}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">/ night</span>
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{room.description}</p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {room.amenities.map((am) => (
                        <span
                          key={am}
                          className="rounded-md border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          {am}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t pt-2 text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Users className="size-3" /> Up to {room.maxGuests} Guests
                      </span>
                      {isSelected ? (
                        <span className="font-bold text-purple-600 flex items-center gap-1">
                          <Check className="size-3.5" /> Selected
                        </span>
                      ) : (
                        <span className="text-muted-foreground hover:text-foreground font-semibold">Select</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Booking Summary & Form */}
          <div className="rounded-2xl border bg-card p-5 shadow-xs h-fit space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Calendar className="size-4 text-purple-600" /> Room Reservation Form
            </h2>

            <form onSubmit={handleSubmitBooking} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Selected Room & Rates
                </label>
                <div className="rounded-lg border bg-muted/40 p-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-foreground block">{selectedRoom.name}</span>
                    <span className="text-muted-foreground">₹{selectedRoom.pricePerNight} × {roomCount} room(s)</span>
                  </div>
                  <span className="text-base font-black text-purple-600">₹{totalAmount}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Rooms</label>
                  <select
                    value={roomCount}
                    onChange={(e) => setRoomCount(Number(e.target.value))}
                    className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-xs font-semibold"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} Room{n > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Guests</label>
                  <select
                    value={guestCount}
                    onChange={(e) => setGuestCount(Number(e.target.value))}
                    className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-xs font-semibold"
                  >
                    {[1, 2, 3, 4, 6, 8, 10].map((n) => (
                      <option key={n} value={n}>
                        {n} Guest{n > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Expected Check-in Time
                </label>
                <Input
                  type="datetime-local"
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                  className="text-xs font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Primary Guest Name</label>
                <Input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="text-xs font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Mobile Phone Number</label>
                <Input
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="text-xs font-medium"
                  required
                />
              </div>

              {/* Payment Method Selector */}
              <div className="border-t pt-3">
                <label className="text-xs font-bold text-foreground block mb-1.5">Payment Method</label>
                <div className="space-y-1.5 text-xs">
                  <label className="flex items-center gap-2 rounded-lg border p-2 cursor-pointer hover:bg-muted/40">
                    <input
                      type="radio"
                      name="hotelPayment"
                      value="upi_at_checkin"
                      checked={paymentMethod === "upi_at_checkin"}
                      onChange={() => setPaymentMethod("upi_at_checkin")}
                    />
                    <div>
                      <span className="font-semibold block">📱 Pay with UPI at Check-in</span>
                      <span className="text-[11px] text-muted-foreground">Scan hotel desk UPI QR upon arrival</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border p-2 cursor-pointer hover:bg-muted/40">
                    <input
                      type="radio"
                      name="hotelPayment"
                      value="upi_advance"
                      checked={paymentMethod === "upi_advance"}
                      onChange={() => setPaymentMethod("upi_advance")}
                    />
                    <div>
                      <span className="font-semibold block">⚡ Pay Advance UPI Now</span>
                      <span className="text-[11px] text-muted-foreground">Instant UPI QR & app payment in car</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border p-2 cursor-pointer hover:bg-muted/40">
                    <input
                      type="radio"
                      name="hotelPayment"
                      value="pay_at_hotel"
                      checked={paymentMethod === "pay_at_hotel"}
                      onChange={() => setPaymentMethod("pay_at_hotel")}
                    />
                    <div>
                      <span className="font-semibold block">🏨 Pay Cash / Card at Hotel</span>
                      <span className="text-[11px] text-muted-foreground">Settle payment at front desk</span>
                    </div>
                  </label>
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm h-10 mt-3"
              >
                {submitting ? "Submitting..." : `Request Room (₹${totalAmount})`}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
