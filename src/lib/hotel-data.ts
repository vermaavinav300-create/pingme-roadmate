// Deterministic room types & pricing for hotels discovered on OpenStreetMap.
// Zero fabrication honesty rule: clearly marked as sample demo hotel rates.

export type RoomOption = {
  id: string;
  name: string;
  category: "Standard" | "Deluxe" | "Suite" | "Family";
  pricePerNight: number;
  maxGuests: number;
  bedType: string;
  amenities: string[];
  description: string;
};

export type HotelDetails = {
  id: string;
  name: string;
  city: string;
  checkInTime: string;
  checkOutTime: string;
  rooms: RoomOption[];
  disclaimer: string;
};

export const HOTEL_DISCLAIMER = "Sample room availability & rates (demo data). Prototype: not confirmed by the hotel.";

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getHotelRooms(hotelId: string, hotelName: string): HotelDetails {
  const hash = simpleHash(hotelId + hotelName);

  const basePriceStandard = 1400 + (hash % 5) * 100;
  const basePriceDeluxe = 2100 + ((hash >> 2) % 6) * 120;
  const basePriceSuite = 3200 + ((hash >> 4) % 8) * 150;
  const basePriceFamily = 2800 + ((hash >> 3) % 7) * 130;

  const rooms: RoomOption[] = [
    {
      id: "std-room",
      name: "Highway Standard Room",
      category: "Standard",
      pricePerNight: basePriceStandard,
      maxGuests: 2,
      bedType: "1 Queen Bed",
      amenities: ["Free Wi-Fi", "Air Conditioning", "Private Bathroom", "Electric Kettle"],
      description: "Comfortable and quiet room for a quick rest along your highway trip.",
    },
    {
      id: "dlx-room",
      name: "Executive Deluxe AC Room",
      category: "Deluxe",
      pricePerNight: basePriceDeluxe,
      maxGuests: 3,
      bedType: "1 King Bed + 1 Sofa",
      amenities: ["Free Wi-Fi", "Air Conditioning", "Smart TV", "Mini Fridge", "Breakfast Included"],
      description: "Spacious deluxe room with premium bedding and complimentary morning breakfast.",
    },
    {
      id: "ste-room",
      name: "Highway Suite with Balcony",
      category: "Suite",
      pricePerNight: basePriceSuite,
      maxGuests: 3,
      bedType: "1 King Bed",
      amenities: ["Highway View", "Living Area", "Tea/Coffee Maker", "Bathtub", "Free Parking", "Breakfast Included"],
      description: "Luxurious highway suite featuring panoramic views and an executive lounge.",
    },
    {
      id: "fam-room",
      name: "Family Comfort Suite",
      category: "Family",
      pricePerNight: basePriceFamily,
      maxGuests: 4,
      bedType: "2 Queen Beds",
      amenities: ["Free Wi-Fi", "Twin AC", "Dining Table", "Hot Shower 24/7", "Secure Parking"],
      description: "Ideal for road-tripping families with children needing extra space and comfort.",
    },
  ];

  return {
    id: hotelId,
    name: hotelName,
    city: "Highway Corridor",
    checkInTime: "12:00 PM",
    checkOutTime: "11:00 AM",
    rooms,
    disclaimer: HOTEL_DISCLAIMER,
  };
}
