import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  saveOrderToDb,
  saveReservationToDb,
  listOrdersFromDb,
  listReservationsFromDb,
  advanceOrderStatusInDb,
  advanceReservationStatusInDb,
  saveHotelReservationToDb,
  listHotelReservationsFromDb,
  advanceHotelReservationStatusInDb,
  updateMerchantOrderStatusInDb,
  markPaymentStatusInDb,
  type DbOrder,
  type DbReservation,
  type DbHotelReservation,
  type OrderStatus,
} from "./orders-db.server";

// Schema for placing an advance food order
const orderItemSchema = z.object({
  itemId: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  price: z.number().int().min(1),
  quantity: z.number().int().min(1).max(50),
  isVeg: z.boolean(),
});

const placeOrderSchema = z.object({
  journeyId: z.string().nullish(),
  restaurantId: z.string().min(1),
  restaurantName: z.string().min(1),
  restaurantAddress: z.string().nullish(),
  detourText: z.string().nullish(),
  estimatedArrival: z.string().min(1),
  notes: z.string().max(500).nullish(),
  paymentMethod: z.enum(["upi_at_table", "upi_advance", "pay_at_restaurant"]).default("upi_at_table"),
  items: z.array(orderItemSchema).min(1, "Please add at least one item to your cart."),
});

// Schema for making a table reservation request
const reservationSchema = z.object({
  journeyId: z.string().nullish(),
  restaurantId: z.string().min(1),
  restaurantName: z.string().min(1),
  restaurantAddress: z.string().nullish(),
  detourText: z.string().nullish(),
  arrivalTime: z.string().min(1),
  guestCount: z.number().int().min(1, "Guest count must be at least 1").max(30, "Maximum 30 guests allowed"),
  customerName: z.string().trim().min(2, "Name must be at least 2 characters"),
  customerPhone: z.string().trim().min(10, "Phone number must have at least 10 digits"),
  specialRequests: z.string().max(500).nullish(),
  paymentMethod: z.enum(["upi_at_table", "upi_advance", "pay_at_restaurant"]).default("upi_at_table"),
});

export const placeAdvanceOrder = createServerFn({ method: "POST" })
  .validator((input: unknown) => placeOrderSchema.parse(input))
  .handler(async ({ data }) => {
    // Validate arrival time is in the future
    const arrivalDate = new Date(data.estimatedArrival);
    if (isNaN(arrivalDate.getTime())) {
      throw new Error("Invalid arrival time provided.");
    }
    // Allow small 2-minute clock skew, but reject past times
    if (arrivalDate.getTime() < Date.now() - 2 * 60 * 1000) {
      throw new Error("Estimated arrival time must be in the future.");
    }

    const totalAmount = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const saved = saveOrderToDb({
      userId: "explorer-user",
      journeyId: data.journeyId ?? null,
      restaurantId: data.restaurantId,
      restaurantName: data.restaurantName,
      restaurantAddress: data.restaurantAddress ?? null,
      detourText: data.detourText ?? null,
      estimatedArrival: data.estimatedArrival,
      notes: data.notes ?? null,
      paymentMethod: data.paymentMethod,
      totalAmount,
      items: data.items,
    });

    return { order: saved };
  });

export const requestTableReservation = createServerFn({ method: "POST" })
  .validator((input: unknown) => reservationSchema.parse(input))
  .handler(async ({ data }) => {
    // Validate arrival time is in the future
    const arrivalDate = new Date(data.arrivalTime);
    if (isNaN(arrivalDate.getTime())) {
      throw new Error("Invalid arrival time provided.");
    }
    if (arrivalDate.getTime() < Date.now() - 2 * 60 * 1000) {
      throw new Error("Reservation arrival time must be in the future.");
    }

    // Phone digits validation
    const digitsOnly = data.customerPhone.replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      throw new Error("Please enter a valid 10-digit mobile phone number.");
    }

    const saved = saveReservationToDb({
      userId: "explorer-user",
      journeyId: data.journeyId ?? null,
      restaurantId: data.restaurantId,
      restaurantName: data.restaurantName,
      restaurantAddress: data.restaurantAddress ?? null,
      detourText: data.detourText ?? null,
      arrivalTime: data.arrivalTime,
      guestCount: data.guestCount,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      specialRequests: data.specialRequests ?? null,
      paymentMethod: data.paymentMethod,
    });

    return { reservation: saved };
  });

export const listOrdersAndReservations = createServerFn({ method: "GET" }).handler(async () => {
  const orders = listOrdersFromDb();
  const reservations = listReservationsFromDb();
  const hotelReservations = listHotelReservationsFromDb();
  return { orders, reservations, hotelReservations };
});

export const advanceOrderStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const nextStatus = advanceOrderStatusInDb(data.orderId);
    return { orderId: data.orderId, newStatus: nextStatus };
  });

export const advanceReservationStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ reservationId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const nextStatus = advanceReservationStatusInDb(data.reservationId);
    return { reservationId: data.reservationId, newStatus: nextStatus };
  });

const hotelBookingSchema = z.object({
  journeyId: z.string().nullish(),
  hotelId: z.string().min(1),
  hotelName: z.string().min(1),
  hotelAddress: z.string().nullish(),
  detourText: z.string().nullish(),
  checkIn: z.string().min(1),
  guestCount: z.number().int().min(1).max(20),
  roomCount: z.number().int().min(1).max(10),
  roomType: z.string().min(1),
  customerName: z.string().trim().min(2),
  customerPhone: z.string().trim().min(10),
  specialRequests: z.string().max(500).nullish(),
  paymentMethod: z.enum(["upi_at_checkin", "upi_advance", "pay_at_hotel"]).default("pay_at_hotel"),
  totalAmount: z.number().int().min(1),
});

export const requestHotelReservation = createServerFn({ method: "POST" })
  .validator((input: unknown) => hotelBookingSchema.parse(input))
  .handler(async ({ data }) => {
    const digitsOnly = data.customerPhone.replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      throw new Error("Please enter a valid 10-digit mobile phone number.");
    }

    const saved = saveHotelReservationToDb({
      userId: "explorer-user",
      journeyId: data.journeyId ?? null,
      hotelId: data.hotelId,
      hotelName: data.hotelName,
      hotelAddress: data.hotelAddress ?? null,
      detourText: data.detourText ?? null,
      checkIn: data.checkIn,
      guestCount: data.guestCount,
      roomCount: data.roomCount,
      roomType: data.roomType,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      specialRequests: data.specialRequests ?? null,
      paymentMethod: data.paymentMethod,
      totalAmount: data.totalAmount,
    });

    return { reservation: saved };
  });

export const advanceHotelReservationStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ reservationId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const nextStatus = advanceHotelReservationStatusInDb(data.reservationId);
    return { reservationId: data.reservationId, newStatus: nextStatus };
  });

export const updateMerchantStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        type: z.enum(["order", "table", "hotel"]),
        id: z.string().uuid(),
        newStatus: z.enum(["submitted", "sent_to_restaurant", "confirmed"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    updateMerchantOrderStatusInDb(data.type, data.id, data.newStatus);
    return { ok: true, id: data.id, status: data.newStatus };
  });

export const verifyUpiPayment = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        type: z.enum(["order", "table", "hotel"]),
        id: z.string().uuid(),
        upiRef: z.string().min(6),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    markPaymentStatusInDb(data.type, data.id, data.upiRef);
    return { ok: true, id: data.id, upiRef: data.upiRef, status: "paid" };
  });

