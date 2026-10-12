export type PizzaPortionType = 'whole' | 'half' | 'quarter';
export type PizzaDiscountOrder = 'lowest' | 'highest';
export type PizzaStepKind = 'size' | 'toppings';
export type PizzaItemSource = 'modifier' | 'product';
export type PizzaPortionKey = 'whole' | 'left' | 'right' | 'q1' | 'q2' | 'q3' | 'q4';

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
  createdAt?: string;
  updatedAt?: string;
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
  groupTitle?: string;
};

const SIZE_RECOMMENDED: Record<string, number> = {
  small: 6,
  medium: 8,
  large: 10,
};

export function newPizzaId(prefix = 'pz'): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}

export function recommendedCapacityForSize(name: string): number | null {
  const key = String(name || '')
    .trim()
    .toLowerCase();
  return SIZE_RECOMMENDED[key] ?? null;
}

export function defaultSizeRows(): PizzaSizeRow[] {
  return [
    { id: newPizzaId('sz'), name: 'Small', maxToppings: 6 },
    { id: newPizzaId('sz'), name: 'Medium', maxToppings: 8 },
    { id: newPizzaId('sz'), name: 'Large', maxToppings: 10 },
  ];
}

export function defaultQuantityLevels(): PizzaQuantityLevel[] {
  return [
    { id: newPizzaId('qty'), name: 'Light', multiplier: 0.5, isDefault: false },
    { id: newPizzaId('qty'), name: 'Normal', multiplier: 1, isDefault: true },
    { id: newPizzaId('qty'), name: 'Extra', multiplier: 2, isDefault: false },
  ];
}

export function defaultSizeStep(): PizzaBuilderStep {
  return { id: newPizzaId('st'), kind: 'size', title: 'Size', sizes: defaultSizeRows(), items: [] };
}

export function defaultToppingsStep(): PizzaBuilderStep {
  return { id: newPizzaId('st'), kind: 'toppings', title: '', sizes: [], items: [] };
}

export function createEmptyPizzaTemplate(): PizzaBuilderTemplate {
  return {
    id: newPizzaId('tpl'),
    name: '',
    portionType: 'whole',
    steps: [defaultSizeStep(), defaultToppingsStep(), defaultToppingsStep()],
    quantityLevels: defaultQuantityLevels(),
    freeToppingEnabled: false,
    freeToppingCount: 1,
    applyDiscount: 'lowest',
    linkedProductIds: [],
  };
}

export function findTemplateForProduct(
  templates: PizzaBuilderTemplate[] | undefined,
  productId: string
): PizzaBuilderTemplate | null {
  const id = String(productId || '').trim();
  if (!id || !templates?.length) return null;
  return templates.find((tpl) => tpl.linkedProductIds.includes(id)) || null;
}

export function portionFactor(portionType: PizzaPortionType, portion: PizzaPortionKey): number {
  if (portionType === 'half') return portion === 'whole' ? 1 : 0.5;
  if (portionType === 'quarter') return portion === 'whole' ? 1 : 0.25;
  return 1;
}

export function defaultQuantityLevel(template: PizzaBuilderTemplate): PizzaQuantityLevel {
  return template.quantityLevels.find((q) => q.isDefault) || template.quantityLevels[0];
}

export function sizeStep(template: PizzaBuilderTemplate): PizzaBuilderStep | undefined {
  return template.steps.find((s) => s.kind === 'size');
}

export function toppingSteps(template: PizzaBuilderTemplate): PizzaBuilderStep[] {
  return template.steps.filter((s) => s.kind === 'toppings');
}

export function portionsForType(portionType: PizzaPortionType): PizzaPortionKey[] {
  if (portionType === 'half') return ['left', 'right'];
  if (portionType === 'quarter') return ['q1', 'q2', 'q3', 'q4'];
  return ['whole'];
}

export function resolveSizePrice(
  productPrice: number,
  specifications: Array<{ name: string; price: number }> | undefined,
  sizeName: string
): number {
  const match = (specifications || []).find(
    (s) => s.name.trim().toLowerCase() === sizeName.trim().toLowerCase()
  );
  if (match && Number.isFinite(Number(match.price))) return Number(match.price);
  return Number(productPrice) || 0;
}

function formatToppingName(template: PizzaBuilderTemplate, top: PizzaPickedTopping): string {
  const qty = template.quantityLevels.find((q) => q.id === top.quantityLevelId);
  const qtyLabel = qty && !qty.isDefault ? qty.name : '';
  const portionLabel =
    template.portionType === 'half' && (top.portion === 'left' || top.portion === 'right')
      ? top.portion === 'left'
        ? 'L'
        : 'R'
      : template.portionType === 'quarter' && top.portion.startsWith('q')
        ? top.portion.toUpperCase()
        : '';
  return [top.name, qtyLabel, portionLabel].filter(Boolean).join(' · ');
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
      name: formatToppingName(template, top),
      price: Math.round((raw + Number.EPSILON) * 100) / 100,
    };
  });

  if (template.freeToppingEnabled && template.freeToppingCount > 0 && priced.length) {
    const order = [...priced].sort((a, b) =>
      template.applyDiscount === 'highest' ? b.price - a.price : a.price - b.price
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
  }));
  const extrasTotal = extras.reduce((sum, extra) => sum + extra.price, 0);
  const unitPrice = Math.round((Math.max(0, basePrice) + extrasTotal + Number.EPSILON) * 100) / 100;
  return {
    extras,
    extrasTotal: Math.round((extrasTotal + Number.EPSILON) * 100) / 100,
    unitPrice,
  };
}
