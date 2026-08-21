/**
 * Sample inventory for merchants exploring stock control, recipes and movements.
 * All rows are flagged isDemo=true on import.
 */

export type DemoInvCategoryDef = { key: string; name: string };
export type DemoInvUnitDef = { code: string; name: string };
export type DemoInvUnitRatioDef = { fromCode: string; toCode: string; factor: number };
export type DemoInvSupplierDef = {
  key: string;
  name: string;
  email: string;
  phone: string;
  contactPerson: string;
};
export type DemoInvItemDef = {
  key: string;
  name: string;
  unit: string;
  cost: number;
  onHand: number;
  minStock: number;
  reorderQty: number;
  categoryKey: string;
  supplierKey: string;
  perishable?: boolean;
  autoReorderEnabled?: boolean;
};
export type DemoInvMovementDef = {
  itemKey: string;
  type: "in" | "sale" | "waste";
  qty: number;
  daysAgo: number;
  note: string;
  supplierName?: string;
};
export type DemoInvRecipeDef = {
  /** Matches demo catalog product key (demo-prod-{key}) */
  productKey: string;
  recipeYield: number;
  /** Short label shown on the inventory dashboard as an example case */
  exampleLabel: string;
  lines: Array<{ itemKey: string; qty: number; unit?: string }>;
};

export const DEMO_INV_CATEGORIES: DemoInvCategoryDef[] = [
  { key: "produce", name: "Produce" },
  { key: "dairy", name: "Dairy" },
  { key: "dry", name: "Dry goods" },
  { key: "meat", name: "Meat & poultry" },
];

export const DEMO_INV_UNITS: DemoInvUnitDef[] = [
  { code: "kg", name: "Kilogram" },
  { code: "g", name: "Gram" },
  { code: "L", name: "Liter" },
  { code: "ml", name: "Milliliter" },
  { code: "piece", name: "Piece" },
];

export const DEMO_INV_UNIT_RATIOS: DemoInvUnitRatioDef[] = [
  { fromCode: "kg", toCode: "g", factor: 1000 },
  { fromCode: "L", toCode: "ml", factor: 1000 },
];

export const DEMO_INV_SUPPLIERS: DemoInvSupplierDef[] = [
  {
    key: "wholesale",
    name: "Fresh Foods Wholesale (demo)",
    email: "orders@freshfoods-demo.example",
    phone: "+41 44 000 00 00",
    contactPerson: "Demo Supplier",
  },
  {
    key: "roasters",
    name: "Alpine Coffee Roasters (demo)",
    email: "wholesale@alpine-demo.example",
    phone: "+41 44 000 00 01",
    contactPerson: "Maria K.",
  },
];

export const DEMO_INV_ITEMS: DemoInvItemDef[] = [
  {
    key: "flour",
    name: "Flour (demo)",
    unit: "kg",
    cost: 1.2,
    onHand: 22,
    minStock: 10,
    reorderQty: 20,
    categoryKey: "dry",
    supplierKey: "wholesale",
  },
  {
    key: "mozzarella",
    name: "Mozzarella cheese (demo)",
    unit: "kg",
    cost: 12.5,
    onHand: 8,
    minStock: 3,
    reorderQty: 5,
    categoryKey: "dairy",
    supplierKey: "wholesale",
    perishable: true,
  },
  {
    key: "tomatoSauce",
    name: "Tomato sauce (demo)",
    unit: "L",
    cost: 4.2,
    onHand: 12,
    minStock: 4,
    reorderQty: 8,
    categoryKey: "dry",
    supplierKey: "wholesale",
  },
  {
    key: "chicken",
    name: "Chicken breast (demo)",
    unit: "kg",
    cost: 14.8,
    onHand: 3.5,
    minStock: 10,
    reorderQty: 15,
    categoryKey: "meat",
    supplierKey: "wholesale",
    perishable: true,
    autoReorderEnabled: true,
  },
  {
    key: "tomatoes",
    name: "Tomatoes (demo)",
    unit: "kg",
    cost: 3.4,
    onHand: 15,
    minStock: 5,
    reorderQty: 10,
    categoryKey: "produce",
    supplierKey: "wholesale",
    perishable: true,
  },
  {
    key: "pizzaBase",
    name: "Pizza dough base (demo)",
    unit: "piece",
    cost: 0.85,
    onHand: 40,
    minStock: 15,
    reorderQty: 30,
    categoryKey: "dry",
    supplierKey: "wholesale",
  },
  {
    key: "coffeeBeans",
    name: "Coffee beans (demo)",
    unit: "kg",
    cost: 22,
    onHand: 4.2,
    minStock: 2,
    reorderQty: 3,
    categoryKey: "dry",
    supplierKey: "roasters",
  },
  {
    key: "milk",
    name: "Whole milk (demo)",
    unit: "L",
    cost: 1.6,
    onHand: 24,
    minStock: 10,
    reorderQty: 20,
    categoryKey: "dairy",
    supplierKey: "wholesale",
    perishable: true,
  },
  {
    key: "bread",
    name: "Burger buns (demo)",
    unit: "piece",
    cost: 0.35,
    onHand: 72,
    minStock: 30,
    reorderQty: 50,
    categoryKey: "dry",
    supplierKey: "wholesale",
  },
  {
    key: "pitaBread",
    name: "Pita bread (demo)",
    unit: "piece",
    cost: 0.42,
    onHand: 55,
    minStock: 20,
    reorderQty: 40,
    categoryKey: "dry",
    supplierKey: "wholesale",
  },
  {
    key: "mixedSalad",
    name: "Mixed salad (demo)",
    unit: "kg",
    cost: 3.1,
    onHand: 5.5,
    minStock: 2,
    reorderQty: 4,
    categoryKey: "produce",
    supplierKey: "wholesale",
    perishable: true,
  },
  {
    key: "beefMince",
    name: "Beef mince (demo)",
    unit: "kg",
    cost: 16.5,
    onHand: 6,
    minStock: 3,
    reorderQty: 5,
    categoryKey: "meat",
    supplierKey: "wholesale",
    perishable: true,
  },
  {
    key: "bacon",
    name: "Bacon (demo)",
    unit: "kg",
    cost: 18,
    onHand: 4,
    minStock: 2,
    reorderQty: 3,
    categoryKey: "meat",
    supplierKey: "wholesale",
    perishable: true,
  },
  {
    key: "romaine",
    name: "Romaine lettuce (demo)",
    unit: "kg",
    cost: 2.8,
    onHand: 6,
    minStock: 2,
    reorderQty: 4,
    categoryKey: "produce",
    supplierKey: "wholesale",
    perishable: true,
  },
  {
    key: "parmesan",
    name: "Parmesan (demo)",
    unit: "kg",
    cost: 24,
    onHand: 3,
    minStock: 1,
    reorderQty: 2,
    categoryKey: "dairy",
    supplierKey: "wholesale",
    perishable: true,
  },
  {
    key: "oliveOil",
    name: "Olive oil (demo)",
    unit: "L",
    cost: 9.5,
    onHand: 10,
    minStock: 3,
    reorderQty: 5,
    categoryKey: "dry",
    supplierKey: "wholesale",
  },
];

/** Backdated movements for history, consumption report and dashboard charts. */
export const DEMO_INV_MOVEMENTS: DemoInvMovementDef[] = [
  {
    itemKey: "flour",
    type: "in",
    qty: 25,
    daysAgo: 6,
    note: "Demo delivery — flour pallet",
    supplierName: "Fresh Foods Wholesale (demo)",
  },
  {
    itemKey: "chicken",
    type: "in",
    qty: 8,
    daysAgo: 5,
    note: "Demo delivery — chicken restock",
    supplierName: "Fresh Foods Wholesale (demo)",
  },
  {
    itemKey: "milk",
    type: "in",
    qty: 20,
    daysAgo: 4,
    note: "Demo delivery — dairy run",
    supplierName: "Fresh Foods Wholesale (demo)",
  },
  {
    itemKey: "coffeeBeans",
    type: "in",
    qty: 3,
    daysAgo: 3,
    note: "Demo delivery — coffee beans",
    supplierName: "Alpine Coffee Roasters (demo)",
  },
  {
    itemKey: "mozzarella",
    type: "in",
    qty: 5,
    daysAgo: 2,
    note: "Demo delivery — cheese restock",
    supplierName: "Fresh Foods Wholesale (demo)",
  },
  {
    itemKey: "milk",
    type: "sale",
    qty: 12,
    daysAgo: 2,
    note: "Demo — cappuccino & latte sales consumption",
  },
  {
    itemKey: "flour",
    type: "sale",
    qty: 2.5,
    daysAgo: 1,
    note: "Demo — pizza sales consumption",
  },
  {
    itemKey: "chicken",
    type: "sale",
    qty: 4.5,
    daysAgo: 1,
    note: "Demo — kebab & sandwich sales consumption",
  },
  {
    itemKey: "mixedSalad",
    type: "waste",
    qty: 0.4,
    daysAgo: 6,
    note: "Demo — end-of-day salad trim waste",
  },
  {
    itemKey: "coffeeBeans",
    type: "sale",
    qty: 0.8,
    daysAgo: 3,
    note: "Demo — espresso bar consumption",
  },
];

export const DEMO_INV_RECIPES: DemoInvRecipeDef[] = [
  {
    productKey: "pizzaMargherita",
    recipeYield: 1,
    exampleLabel: "Pizza Margherita — flour, cheese & sauce per portion",
    lines: [
      { itemKey: "flour", qty: 0.12, unit: "kg" },
      { itemKey: "mozzarella", qty: 0.08, unit: "kg" },
      { itemKey: "tomatoSauce", qty: 0.06, unit: "L" },
      { itemKey: "pizzaBase", qty: 1, unit: "piece" },
    ],
  },
  {
    productKey: "kebabPlate",
    recipeYield: 1,
    exampleLabel: "Chicken kebab plate — meat, pita & salad per plate",
    lines: [
      { itemKey: "chicken", qty: 0.18, unit: "kg" },
      { itemKey: "pitaBread", qty: 1, unit: "piece" },
      { itemKey: "mixedSalad", qty: 0.05, unit: "kg" },
    ],
  },
  {
    productKey: "cappuccino",
    recipeYield: 1,
    exampleLabel: "Cappuccino — beans & milk per cup",
    lines: [
      { itemKey: "coffeeBeans", qty: 0.018, unit: "kg" },
      { itemKey: "milk", qty: 0.15, unit: "L" },
    ],
  },
  {
    productKey: "latte",
    recipeYield: 1,
    exampleLabel: "Caffè latte — beans & extra milk",
    lines: [
      { itemKey: "coffeeBeans", qty: 0.018, unit: "kg" },
      { itemKey: "milk", qty: 0.2, unit: "L" },
    ],
  },
  {
    productKey: "clubSandwich",
    recipeYield: 1,
    exampleLabel: "Club sandwich — chicken, bacon, tomato & bun",
    lines: [
      { itemKey: "chicken", qty: 0.08, unit: "kg" },
      { itemKey: "bacon", qty: 0.04, unit: "kg" },
      { itemKey: "tomatoes", qty: 0.05, unit: "kg" },
      { itemKey: "bread", qty: 2, unit: "piece" },
    ],
  },
  {
    productKey: "grilledCheese",
    recipeYield: 1,
    exampleLabel: "Grilled cheese — mozzarella & bun",
    lines: [
      { itemKey: "mozzarella", qty: 0.06, unit: "kg" },
      { itemKey: "bread", qty: 2, unit: "piece" },
    ],
  },
  {
    productKey: "caesarSalad",
    recipeYield: 1,
    exampleLabel: "Caesar salad — romaine, parmesan & oil",
    lines: [
      { itemKey: "romaine", qty: 0.12, unit: "kg" },
      { itemKey: "parmesan", qty: 0.02, unit: "kg" },
      { itemKey: "oliveOil", qty: 0.01, unit: "L" },
    ],
  },
];
