export type PizzaPortionType = "whole" | "half" | "quarter";
export type PizzaDiscountOrder = "lowest" | "highest";
export type PizzaStepKind = "size" | "toppings";
export type PizzaItemSource = "modifier" | "product";
export type PizzaPortionKey = "whole" | "left" | "right" | "q1" | "q2" | "q3" | "q4";

export type PizzaSizeRow = {
  id: string;
  name: string;
  maxToppings: number;
};

export type PizzaToppingItem = {
  id: string;
  name: string;
  price: number;
  sourceType: PizzaItemSource;
  sourceId?: string;
  groupId?: string;
};

export type PizzaBuilderStep = {
  id: string;
  kind: PizzaStepKind;
  title: string;
  sizes: PizzaSizeRow[];
  items: PizzaToppingItem[];
};

export type PizzaQuantityLevel = {
  id: string;
  name: string;
  multiplier: number;
  isDefault: boolean;
};

export type PizzaBuilderTemplate = {
  id: string;
  name: string;
  portionType: PizzaPortionType;
  steps: PizzaBuilderStep[];
  quantityLevels: PizzaQuantityLevel[];
  freeToppingEnabled: boolean;
  freeToppingCount: number;
  applyDiscount: PizzaDiscountOrder;
  linkedProductIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type PizzaBuilderSettings = {
  templates: PizzaBuilderTemplate[];
};

export type PizzaPickedTopping = {
  itemId: string;
  name: string;
  basePrice: number;
  quantityLevelId: string;
  multiplier: number;
  portion: PizzaPortionKey;
};

export type PizzaPricedExtra = {
  id: string;
  name: string;
  price: number;
  groupId?: string;
  groupTitle?: string;
};

const SIZE_RECOMMENDED: Record<string, number> = {
  small: 6,
  medium: 8,
  large: 10,
};

export function newPizzaId(prefix = "pz"): string {
  const rand =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}

export function recommendedCapacityForSize(name: string): number | null {
  const key = String(name || "")
    .trim()
    .toLowerCase();
  return SIZE_RECOMMENDED[key] ?? null;
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function asString(raw: unknown, fallback = ""): string {
  return typeof raw === "string" ? raw : fallback;
}

function asNumber(raw: unknown, fallback = 0): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function defaultSizeRows(): PizzaSizeRow[] {
  return [
    { id: newPizzaId("sz"), name: "Small", maxToppings: 6 },
    { id: newPizzaId("sz"), name: "Medium", maxToppings: 8 },
    { id: newPizzaId("sz"), name: "Large", maxToppings: 10 },
  ];
}

export function defaultQuantityLevels(): PizzaQuantityLevel[] {
  return [
    { id: newPizzaId("qty"), name: "Light", multiplier: 0.5, isDefault: false },
    { id: newPizzaId("qty"), name: "Normal", multiplier: 1, isDefault: true },
    { id: newPizzaId("qty"), name: "Extra", multiplier: 2, isDefault: false },
  ];
}

export function defaultSizeStep(): PizzaBuilderStep {
  return {
    id: newPizzaId("st"),
    kind: "size",
    title: "Size",
    sizes: defaultSizeRows(),
    items: [],
  };
}

export function defaultToppingsStep(index = 2): PizzaBuilderStep {
  return {
    id: newPizzaId("st"),
    kind: "toppings",
    title: "",
    sizes: [],
    items: [],
  };
}

export function createEmptyPizzaTemplate(): PizzaBuilderTemplate {
  const ts = nowIso();
  return {
    id: newPizzaId("tpl"),
    name: "",
    portionType: "whole",
    steps: [defaultSizeStep(), defaultToppingsStep(2), defaultToppingsStep(3)],
    quantityLevels: defaultQuantityLevels(),
    freeToppingEnabled: false,
    freeToppingCount: 1,
    applyDiscount: "lowest",
    linkedProductIds: [],
    createdAt: ts,
    updatedAt: ts,
  };
}

function normalizeSize(raw: unknown): PizzaSizeRow {
  const src = asRecord(raw);
  const name = asString(src.name).trim() || "Size";
  const recommended = recommendedCapacityForSize(name);
  const max = Math.max(0, Math.min(99, Math.round(asNumber(src.maxToppings, recommended ?? 0))));
  return {
    id: asString(src.id) || newPizzaId("sz"),
    name: name.slice(0, 80),
    maxToppings: max,
  };
}

function normalizeItem(raw: unknown): PizzaToppingItem | null {
  const src = asRecord(raw);
  const name = asString(src.name).trim();
  if (!name) return null;
  const sourceType: PizzaItemSource = src.sourceType === "product" ? "product" : "modifier";
  return {
    id: asString(src.id) || newPizzaId("it"),
    name: name.slice(0, 120),
    price: Math.max(0, asNumber(src.price, 0)),
    sourceType,
    sourceId: asString(src.sourceId) || undefined,
    groupId: asString(src.groupId) || undefined,
  };
}

function normalizeStep(raw: unknown, _index: number): PizzaBuilderStep {
  const src = asRecord(raw);
  const kind: PizzaStepKind = src.kind === "size" || src.type === "size" ? "size" : "toppings";
  const sizes = Array.isArray(src.sizes) ? src.sizes.map(normalizeSize) : kind === "size" ? defaultSizeRows() : [];
  const items = Array.isArray(src.items)
    ? (src.items.map(normalizeItem).filter(Boolean) as PizzaToppingItem[])
    : [];
  return {
    id: asString(src.id) || newPizzaId("st"),
    kind,
    title: asString(src.title, kind === "size" ? "Size" : "").slice(0, 80),
    sizes: kind === "size" ? (sizes.length ? sizes : defaultSizeRows()) : [],
    items: kind === "toppings" ? items : [],
  };
}

function normalizeQuantity(raw: unknown): PizzaQuantityLevel {
  const src = asRecord(raw);
  return {
    id: asString(src.id) || newPizzaId("qty"),
    name: (asString(src.name).trim() || "Normal").slice(0, 40),
    multiplier: Math.max(0, Math.min(10, asNumber(src.multiplier, 1))),
    isDefault: src.isDefault === true,
  };
}

export function normalizePizzaTemplate(raw: unknown): PizzaBuilderTemplate {
  const src = asRecord(raw);
  const stepsRaw = Array.isArray(src.steps) ? src.steps : [];
  let steps = stepsRaw.map((step, i) => normalizeStep(step, i));
  if (!steps.some((s) => s.kind === "size")) {
    steps = [defaultSizeStep(), ...steps];
  }
  if (steps.length === 1) {
    steps = [...steps, defaultToppingsStep(2)];
  }
  let quantityLevels = Array.isArray(src.quantityLevels)
    ? src.quantityLevels.map(normalizeQuantity)
    : defaultQuantityLevels();
  if (!quantityLevels.length) quantityLevels = defaultQuantityLevels();
  if (!quantityLevels.some((q) => q.isDefault)) {
    quantityLevels = quantityLevels.map((q, i) => ({ ...q, isDefault: i === 0 }));
  } else {
    let seen = false;
    quantityLevels = quantityLevels.map((q) => {
      if (q.isDefault && !seen) {
        seen = true;
        return q;
      }
      return { ...q, isDefault: false };
    });
  }
  const portionRaw = asString(src.portionType).toLowerCase();
  const portionType: PizzaPortionType =
    portionRaw === "half" || portionRaw === "half_half" ? "half" : portionRaw === "quarter" ? "quarter" : "whole";
  const applyRaw = asString(src.applyDiscount).toLowerCase();
  const linked = Array.isArray(src.linkedProductIds)
    ? [...new Set(src.linkedProductIds.map((id) => String(id || "").trim()).filter(Boolean))]
    : [];
  const ts = nowIso();
  return {
    id: asString(src.id) || newPizzaId("tpl"),
    name: asString(src.name).trim().slice(0, 120),
    portionType,
    steps,
    quantityLevels,
    freeToppingEnabled: src.freeToppingEnabled === true,
    freeToppingCount: Math.max(0, Math.min(50, Math.round(asNumber(src.freeToppingCount, 1)))),
    applyDiscount: applyRaw === "highest" ? "highest" : "lowest",
    linkedProductIds: linked,
    createdAt: asString(src.createdAt) || ts,
    updatedAt: asString(src.updatedAt) || ts,
  };
}

export function normalizePizzaBuilderSettings(raw: unknown): PizzaBuilderSettings {
  const src = asRecord(raw);
  const list = Array.isArray(src.templates) ? src.templates : Array.isArray(raw) ? (raw as unknown[]) : [];
  const templates = list.map(normalizePizzaTemplate);
  return { templates };
}

export function findTemplateForProduct(
  settings: PizzaBuilderSettings | PizzaBuilderTemplate[],
  productId: string
): PizzaBuilderTemplate | null {
  const id = String(productId || "").trim();
  if (!id) return null;
  const templates = Array.isArray(settings) ? settings : settings.templates;
  return templates.find((tpl) => tpl.linkedProductIds.includes(id)) || null;
}

export function portionFactor(portionType: PizzaPortionType, portion: PizzaPortionKey): number {
  if (portionType === "half") return portion === "whole" ? 1 : 0.5;
  if (portionType === "quarter") return portion === "whole" ? 1 : 0.25;
  return 1;
}

export function defaultQuantityLevel(template: PizzaBuilderTemplate): PizzaQuantityLevel {
  return template.quantityLevels.find((q) => q.isDefault) || template.quantityLevels[0];
}

export function sizeStep(template: PizzaBuilderTemplate): PizzaBuilderStep | undefined {
  return template.steps.find((s) => s.kind === "size");
}

export function toppingSteps(template: PizzaBuilderTemplate): PizzaBuilderStep[] {
  return template.steps.filter((s) => s.kind === "toppings");
}

export function pricePizzaSelection(
  template: PizzaBuilderTemplate,
  basePrice: number,
  toppings: PizzaPickedTopping[]
): { extras: PizzaPricedExtra[]; extrasTotal: number; unitPrice: number } {
  const priced = toppings.map((top, index) => {
    const factor = portionFactor(template.portionType, top.portion);
    const raw = Math.max(0, top.basePrice) * Math.max(0, top.multiplier) * factor;
    return {
      key: `${top.itemId}:${top.portion}:${index}`,
      itemId: top.itemId,
      name: formatToppingName(template, top),
      price: Math.round((raw + Number.EPSILON) * 100) / 100,
      portion: top.portion,
    };
  });

  if (template.freeToppingEnabled && template.freeToppingCount > 0 && priced.length) {
    const order = [...priced].sort((a, b) =>
      template.applyDiscount === "highest" ? b.price - a.price : a.price - b.price
    );
    const freeIds = new Set(order.slice(0, template.freeToppingCount).map((row) => row.key));
    for (const row of priced) {
      if (freeIds.has(row.key)) row.price = 0;
    }
  }

  const extras: PizzaPricedExtra[] = priced.map((row) => ({
    id: row.key,
    name: row.name,
    price: row.price,
    groupTitle: row.portion === "whole" ? undefined : row.portion,
  }));
  const extrasTotal = extras.reduce((sum, extra) => sum + extra.price, 0);
  const unitPrice = Math.round((Math.max(0, basePrice) + extrasTotal + Number.EPSILON) * 100) / 100;
  return { extras, extrasTotal: Math.round((extrasTotal + Number.EPSILON) * 100) / 100, unitPrice };
}

function formatToppingName(template: PizzaBuilderTemplate, top: PizzaPickedTopping): string {
  const qty = template.quantityLevels.find((q) => q.id === top.quantityLevelId);
  const qtyLabel = qty && !qty.isDefault ? qty.name : "";
  const portionLabel =
    template.portionType === "half" && (top.portion === "left" || top.portion === "right")
      ? top.portion === "left"
        ? "L"
        : "R"
      : template.portionType === "quarter" && top.portion.startsWith("q")
        ? top.portion.toUpperCase()
        : "";
  return [top.name, qtyLabel, portionLabel].filter(Boolean).join(" · ");
}

export function portionsForType(portionType: PizzaPortionType): PizzaPortionKey[] {
  if (portionType === "half") return ["left", "right"];
  if (portionType === "quarter") return ["q1", "q2", "q3", "q4"];
  return ["whole"];
}
