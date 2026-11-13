export type MenuCategory = "Starters" | "Main Course" | "Breads & Rice" | "Beverages & Desserts";

export type MenuItem = {
  id: string;
  name: string;
  category: MenuCategory;
  price: number; // in INR (₹)
  isVeg: boolean;
  description: string;
};

export const MENU_DISCLAIMER = "Sample menu (demo data)";
export const PROTOTYPE_DISCLAIMER = "Prototype: not confirmed by the restaurant";

const CATALOG_STARTERS: Omit<MenuItem, "id">[] = [
  { name: "Paneer Tikka (6 pcs)", category: "Starters", price: 220, isVeg: true, description: "Charcoal-grilled cottage cheese marinated in spiced yogurt and herbs." },
  { name: "Crispy Corn Chat", category: "Starters", price: 160, isVeg: true, description: "Golden fried sweet corn tossed with lemon, green chillies and chaat masala." },
  { name: "Hara Bhara Kebab (4 pcs)", category: "Starters", price: 180, isVeg: true, description: "Spiced spinach, green peas and potato patties pan-fried to crisp perfection." },
  { name: "Tandoori Chicken (Half)", category: "Starters", price: 280, isVeg: false, description: "Classic bone-in chicken slow roasted in a clay tandoor with aromatic Punjabi spices." },
  { name: "Chicken Malai Tikka (6 pcs)", category: "Starters", price: 310, isVeg: false, description: "Tender boneless chicken marinated in cream, mild green cardamom and cheese." },
  { name: "Fish Fry Amritsari (4 pcs)", category: "Starters", price: 340, isVeg: false, description: "Carom-spiced batter fried river fish with mint chutney." },
];

const CATALOG_MAINS: Omit<MenuItem, "id">[] = [
  { name: "Highway Dal Makhani", category: "Main Course", price: 210, isVeg: true, description: "Signature slow-cooked black lentils finished with fresh cream and country butter." },
  { name: "Dhaba Style Paneer Butter Masala", category: "Main Course", price: 260, isVeg: true, description: "Fresh paneer cubes simmered in a rich tomato, butter, and cashew gravy." },
  { name: "Kadhai Paneer", category: "Main Course", price: 250, isVeg: true, description: "Cottage cheese wok-tossed with crisp bell peppers, onions and crushed coriander seeds." },
  { name: "Yellow Dal Tadka", category: "Main Course", price: 170, isVeg: true, description: "Arhar dal tempered with cumin, garlic, dry red chillies and pure desi ghee." },
  { name: "Butter Chicken (Boneless)", category: "Main Course", price: 340, isVeg: false, description: "Tandoori grilled chicken tikka in velvety mild tomato-fenugreek butter gravy." },
  { name: "Dhaba Chicken Curry", category: "Main Course", price: 310, isVeg: false, description: "Rustic homestyle chicken gravy cooked with whole spices, onions and ginger." },
  { name: "Mutton Rogan Josh", category: "Main Course", price: 390, isVeg: false, description: "Tender slow-braised mutton in aromatic Kashmiri red chili and fennel sauce." },
];

const CATALOG_BREADS_RICE: Omit<MenuItem, "id">[] = [
  { name: "Tandoori Butter Roti", category: "Breads & Rice", price: 25, isVeg: true, description: "Crisp whole wheat flatbread baked in the clay oven and buttered." },
  { name: "Garlic Butter Naan", category: "Breads & Rice", price: 60, isVeg: true, description: "Refined flour leavened bread generously topped with roasted minced garlic." },
  { name: "Amritsari Aloo Kulcha", category: "Breads & Rice", price: 90, isVeg: true, description: "Flaky layered bread stuffed with spiced mashed potatoes, served with chole." },
  { name: "Jeera Rice", category: "Breads & Rice", price: 140, isVeg: true, description: "Fragrant basmati rice gently tempered with toasted cumin seeds and ghee." },
  { name: "Chicken Dum Biryani", category: "Breads & Rice", price: 290, isVeg: false, description: "Aromatic basmati rice cooked on dum with marinated chicken and saffron." },
  { name: "Subz Dum Biryani", category: "Breads & Rice", price: 220, isVeg: true, description: "Garden vegetables layered with basmati rice, mint, fried onions and saffron." },
];

const CATALOG_BEVERAGES: Omit<MenuItem, "id">[] = [
  { name: "Kulhad Masala Chai", category: "Beverages & Desserts", price: 35, isVeg: true, description: "Hot highway spiced tea brewed with ginger, crushed cardamom and lemongrass." },
  { name: "Punjabi Sweet Lassi (Clay Kulhad)", category: "Beverages & Desserts", price: 80, isVeg: true, description: "Thick hand-churned chilled sweet yogurt drink topped with a layer of malai." },
  { name: "Fresh Lime Soda (Sweet & Salt)", category: "Beverages & Desserts", price: 65, isVeg: true, description: "Refreshing freshly squeezed lime juice with sparkling club soda." },
  { name: "Gulab Jamun (2 pcs)", category: "Beverages & Desserts", price: 70, isVeg: true, description: "Warm khoya dumplings soaked in rose and green cardamom scented sugar syrup." },
];

// Simple deterministic hash based on restaurant string ID to generate a consistent menu
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Returns a consistent 8-to-10 item sample menu tailored to the given restaurant.
 * Always labeled with "Sample menu (demo data)".
 */
export function getRestaurantMenu(restaurantId: string, restaurantName?: string): MenuItem[] {
  const seed = hashString(restaurantId + (restaurantName ?? ""));

  // Select 2 starters
  const s1 = CATALOG_STARTERS[seed % CATALOG_STARTERS.length];
  const s2 = CATALOG_STARTERS[(seed + 2) % CATALOG_STARTERS.length];

  // Select 3 mains
  const m1 = CATALOG_MAINS[seed % CATALOG_MAINS.length];
  const m2 = CATALOG_MAINS[(seed + 1) % CATALOG_MAINS.length];
  const m3 = CATALOG_MAINS[(seed + 3) % CATALOG_MAINS.length];

  // Select 2 breads / rice
  const b1 = CATALOG_BREADS_RICE[seed % CATALOG_BREADS_RICE.length];
  const b2 = CATALOG_BREADS_RICE[(seed + 2) % CATALOG_BREADS_RICE.length];

  // Select 2 beverages/desserts
  const d1 = CATALOG_BEVERAGES[seed % CATALOG_BEVERAGES.length];
  const d2 = CATALOG_BEVERAGES[(seed + 1) % CATALOG_BEVERAGES.length];

  const rawList = [s1, s2, m1, m2, m3, b1, b2, d1, d2];

  // Remove any duplicates if seed caused collision
  const seen = new Set<string>();
  const menu: MenuItem[] = [];

  rawList.forEach((item, index) => {
    if (!item) return;
    if (!seen.has(item.name)) {
      seen.add(item.name);
      menu.push({
        id: `m-${hashString(item.name)}-${index}`,
        name: item.name,
        category: item.category,
        price: item.price,
        isVeg: item.isVeg,
        description: item.description,
      });
    }
  });

  return menu;
}
