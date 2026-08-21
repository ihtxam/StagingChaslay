/**
 * Café/bistro demo catalog — Ashley's-style sample menu for new merchants.
 * Keys are stable references for linking modifiers and combo slots.
 */

export type DemoCategoryDef = {
  key: string;
  name: string;
  description: string;
  color: string;
};

export type DemoModifierGroupDef = {
  key: string;
  title: string;
  pricingType: "free" | "fixed";
  selectionType: "optional" | "required";
  minSelectable?: number;
  maxSelectable?: number;
  options: Array<{ name: string; price?: number; isDefault?: boolean }>;
};

export type DemoProductDef = {
  key: string;
  name: string;
  description: string;
  price: number;
  categoryKey: string;
  sku?: string;
  stock?: number;
  modifierGroupKeys?: string[];
};

export type DemoComboDef = {
  key: string;
  name: string;
  description: string;
  price: number;
  categoryKey: string;
  sku?: string;
  slots: Array<{
    name: string;
    minPick: number;
    maxPick: number;
    productKeys: string[];
    extraPrices?: number[];
  }>;
};

export const DEMO_CATEGORIES: DemoCategoryDef[] = [
  {
    key: "coffee",
    name: "Coffee",
    description: "Espresso bar classics",
    color: "#78350F",
  },
  {
    key: "sandwiches",
    name: "Sandwiches",
    description: "Fresh sandwiches & wraps",
    color: "#F97316",
  },
  {
    key: "salads",
    name: "Salads",
    description: "Seasonal bowls & greens",
    color: "#22C55E",
  },
  {
    key: "desserts",
    name: "Desserts",
    description: "Homemade sweets",
    color: "#EC4899",
  },
  {
    key: "drinks",
    name: "Drinks",
    description: "Juices, tea & soft drinks",
    color: "#0EA5E9",
  },
  {
    key: "breakfast",
    name: "Breakfast",
    description: "Morning favourites",
    color: "#EAB308",
  },
  {
    key: "combos",
    name: "Combos",
    description: "Meal deals & bundles",
    color: "#8B5CF6",
  },
  {
    key: "mains",
    name: "Mains",
    description: "Hot plates & pizza",
    color: "#DC2626",
  },
];

export const DEMO_MODIFIER_GROUPS: DemoModifierGroupDef[] = [
  {
    key: "milk",
    title: "Milk",
    pricingType: "fixed",
    selectionType: "optional",
    maxSelectable: 1,
    options: [
      { name: "Whole milk", price: 0, isDefault: true },
      { name: "Skim milk", price: 0 },
      { name: "Oat milk", price: 0.8 },
      { name: "Almond milk", price: 0.8 },
      { name: "Soy milk", price: 0.6 },
    ],
  },
  {
    key: "coffeeExtras",
    title: "Coffee extras",
    pricingType: "fixed",
    selectionType: "optional",
    maxSelectable: 3,
    options: [
      { name: "Extra shot", price: 1.0 },
      { name: "Decaf", price: 0 },
      { name: "Whipped cream", price: 0.5 },
      { name: "Vanilla syrup", price: 0.6 },
    ],
  },
  {
    key: "bread",
    title: "Bread",
    pricingType: "fixed",
    selectionType: "required",
    minSelectable: 1,
    maxSelectable: 1,
    options: [
      { name: "White bread", price: 0, isDefault: true },
      { name: "Whole grain", price: 0 },
      { name: "Ciabatta", price: 0 },
      { name: "Gluten-free wrap", price: 1.5 },
    ],
  },
  {
    key: "sandwichExtras",
    title: "Sandwich extras",
    pricingType: "fixed",
    selectionType: "optional",
    maxSelectable: 3,
    options: [
      { name: "Bacon", price: 2.5 },
      { name: "Extra cheese", price: 1.5 },
      { name: "Avocado", price: 2.0 },
      { name: "Pickles", price: 0 },
    ],
  },
  {
    key: "dressing",
    title: "Dressing",
    pricingType: "free",
    selectionType: "required",
    minSelectable: 1,
    maxSelectable: 1,
    options: [
      { name: "Caesar", isDefault: true },
      { name: "Balsamic", isDefault: false },
      { name: "Lemon vinaigrette", isDefault: false },
      { name: "No dressing", isDefault: false },
    ],
  },
  {
    key: "drinkSize",
    title: "Size",
    pricingType: "fixed",
    selectionType: "required",
    minSelectable: 1,
    maxSelectable: 1,
    options: [
      { name: "Small (0.3L)", price: 0, isDefault: true },
      { name: "Regular (0.5L)", price: 0.5 },
      { name: "Large (0.7L)", price: 1.0 },
    ],
  },
];

export const DEMO_PRODUCTS: DemoProductDef[] = [
  // Coffee
  {
    key: "espresso",
    name: "Espresso",
    description: "Single shot, rich & bold",
    price: 3.5,
    categoryKey: "coffee",
    sku: "COF-ESP",
    modifierGroupKeys: ["milk", "coffeeExtras"],
  },
  {
    key: "cappuccino",
    name: "Cappuccino",
    description: "Espresso with steamed milk foam",
    price: 4.8,
    categoryKey: "coffee",
    sku: "COF-CAP",
    modifierGroupKeys: ["milk", "coffeeExtras"],
  },
  {
    key: "latte",
    name: "Caffè Latte",
    description: "Smooth espresso with steamed milk",
    price: 5.2,
    categoryKey: "coffee",
    sku: "COF-LAT",
    modifierGroupKeys: ["milk", "coffeeExtras"],
  },
  {
    key: "flatWhite",
    name: "Flat White",
    description: "Double ristretto with microfoam",
    price: 5.5,
    categoryKey: "coffee",
    sku: "COF-FW",
    modifierGroupKeys: ["milk", "coffeeExtras"],
  },
  // Sandwiches
  {
    key: "clubSandwich",
    name: "Club Sandwich",
    description: "Chicken, bacon, egg, tomato",
    price: 12.9,
    categoryKey: "sandwiches",
    sku: "SND-CLUB",
    modifierGroupKeys: ["bread", "sandwichExtras"],
  },
  {
    key: "turkeyAvocado",
    name: "Turkey & Avocado",
    description: "Sliced turkey, avocado, greens",
    price: 11.5,
    categoryKey: "sandwiches",
    sku: "SND-TUR",
    modifierGroupKeys: ["bread", "sandwichExtras"],
  },
  {
    key: "grilledCheese",
    name: "Grilled Cheese",
    description: "Swiss & cheddar on sourdough",
    price: 9.5,
    categoryKey: "sandwiches",
    sku: "SND-GRD",
    modifierGroupKeys: ["bread", "sandwichExtras"],
  },
  {
    key: "veggieWrap",
    name: "Veggie Wrap",
    description: "Hummus, roasted veg, feta",
    price: 10.9,
    categoryKey: "sandwiches",
    sku: "SND-VEG",
    modifierGroupKeys: ["bread", "sandwichExtras"],
  },
  // Salads
  {
    key: "caesarSalad",
    name: "Caesar Salad",
    description: "Romaine, parmesan, croutons",
    price: 13.5,
    categoryKey: "salads",
    sku: "SAL-CAE",
    modifierGroupKeys: ["dressing"],
  },
  {
    key: "greekSalad",
    name: "Greek Salad",
    description: "Feta, olives, cucumber, tomato",
    price: 12.0,
    categoryKey: "salads",
    sku: "SAL-GRK",
    modifierGroupKeys: ["dressing"],
  },
  {
    key: "quinoaBowl",
    name: "Quinoa Power Bowl",
    description: "Quinoa, chickpeas, avocado, seeds",
    price: 14.5,
    categoryKey: "salads",
    sku: "SAL-QUI",
    modifierGroupKeys: ["dressing"],
  },
  // Desserts
  {
    key: "brownie",
    name: "Chocolate Brownie",
    description: "Warm Belgian chocolate",
    price: 4.5,
    categoryKey: "desserts",
    sku: "DES-BRW",
  },
  {
    key: "lemonTart",
    name: "Lemon Tart",
    description: "Sharp lemon curd, shortcrust",
    price: 5.8,
    categoryKey: "desserts",
    sku: "DES-LMN",
  },
  {
    key: "cheesecake",
    name: "New York Cheesecake",
    description: "Classic creamy slice",
    price: 6.2,
    categoryKey: "desserts",
    sku: "DES-CHK",
  },
  // Drinks
  {
    key: "orangeJuice",
    name: "Fresh Orange Juice",
    description: "Pressed daily",
    price: 5.0,
    categoryKey: "drinks",
    sku: "DRK-OJ",
    modifierGroupKeys: ["drinkSize"],
  },
  {
    key: "icedTea",
    name: "Iced Tea",
    description: "Peach or lemon",
    price: 4.0,
    categoryKey: "drinks",
    sku: "DRK-TEA",
    modifierGroupKeys: ["drinkSize"],
  },
  {
    key: "sparklingWater",
    name: "Sparkling Water",
    description: "0.5L San Pellegrino style",
    price: 3.5,
    categoryKey: "drinks",
    sku: "DRK-SPK",
  },
  {
    key: "hotChocolate",
    name: "Hot Chocolate",
    description: "Rich cocoa with whipped cream",
    price: 5.5,
    categoryKey: "drinks",
    sku: "DRK-HOT",
    modifierGroupKeys: ["milk"],
  },
  // Breakfast
  {
    key: "croissant",
    name: "Butter Croissant",
    description: "Flaky, baked fresh",
    price: 3.8,
    categoryKey: "breakfast",
    sku: "BRK-CRO",
  },
  {
    key: "avocadoToast",
    name: "Avocado Toast",
    description: "Sourdough, lime, chili flakes",
    price: 9.9,
    categoryKey: "breakfast",
    sku: "BRK-AVO",
  },
  {
    key: "fullEnglish",
    name: "Full English",
    description: "Eggs, bacon, sausage, beans, toast",
    price: 16.5,
    categoryKey: "breakfast",
    sku: "BRK-FUL",
  },
  {
    key: "porridge",
    name: "Porridge",
    description: "Oats with honey & berries",
    price: 7.5,
    categoryKey: "breakfast",
    sku: "BRK-POR",
    modifierGroupKeys: ["milk"],
  },
  {
    key: "pizzaMargherita",
    name: "Pizza Margherita",
    description: "Tomato, mozzarella & basil on thin crust",
    price: 16.9,
    categoryKey: "mains",
    sku: "MAIN-PIZ-MAR",
  },
  {
    key: "kebabPlate",
    name: "Chicken Kebab Plate",
    description: "Grilled chicken, pita, salad & sauce",
    price: 18.5,
    categoryKey: "mains",
    sku: "MAIN-KEB",
  },
];

export const DEMO_COMBOS: DemoComboDef[] = [
  {
    key: "lunchCombo",
    name: "Lunch Combo",
    description: "Sandwich + side salad + drink",
    price: 18.9,
    categoryKey: "combos",
    sku: "CMB-LUN",
    slots: [
      {
        name: "Sandwich",
        minPick: 1,
        maxPick: 1,
        productKeys: ["clubSandwich", "turkeyAvocado", "grilledCheese", "veggieWrap"],
      },
      {
        name: "Side",
        minPick: 1,
        maxPick: 1,
        productKeys: ["caesarSalad", "greekSalad"],
        extraPrices: [0, 0],
      },
      {
        name: "Drink",
        minPick: 1,
        maxPick: 1,
        productKeys: ["icedTea", "orangeJuice", "sparklingWater"],
        extraPrices: [0, 1.0, 0],
      },
    ],
  },
  {
    key: "coffeePastry",
    name: "Coffee & Pastry",
    description: "Any coffee + a sweet treat",
    price: 8.5,
    categoryKey: "combos",
    sku: "CMB-COF",
    slots: [
      {
        name: "Coffee",
        minPick: 1,
        maxPick: 1,
        productKeys: ["espresso", "cappuccino", "latte", "flatWhite"],
      },
      {
        name: "Pastry",
        minPick: 1,
        maxPick: 1,
        productKeys: ["croissant", "brownie", "lemonTart"],
        extraPrices: [0, 0.5, 1.0],
      },
    ],
  },
  {
    key: "breakfastBundle",
    name: "Breakfast Bundle",
    description: "Breakfast plate + coffee + juice",
    price: 15.0,
    categoryKey: "combos",
    sku: "CMB-BRK",
    slots: [
      {
        name: "Breakfast",
        minPick: 1,
        maxPick: 1,
        productKeys: ["avocadoToast", "fullEnglish", "porridge"],
        extraPrices: [0, 2.0, 0],
      },
      {
        name: "Coffee",
        minPick: 1,
        maxPick: 1,
        productKeys: ["cappuccino", "latte", "flatWhite"],
      },
      {
        name: "Juice",
        minPick: 1,
        maxPick: 1,
        productKeys: ["orangeJuice"],
      },
    ],
  },
];
