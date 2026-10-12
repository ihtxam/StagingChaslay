import { describe, expect, it } from "vitest";
import {
  createEmptyPizzaTemplate,
  findTemplateForProduct,
  normalizePizzaBuilderSettings,
  portionFactor,
  pricePizzaSelection,
  recommendedCapacityForSize,
} from "./pizza-builder-settings";

describe("pizza-builder-settings", () => {
  it("recommends topping capacity by size name", () => {
    expect(recommendedCapacityForSize("Small")).toBe(6);
    expect(recommendedCapacityForSize("medium")).toBe(8);
    expect(recommendedCapacityForSize("LARGE")).toBe(10);
    expect(recommendedCapacityForSize("Family")).toBeNull();
  });

  it("normalizes a missing payload into an empty template list", () => {
    expect(normalizePizzaBuilderSettings(null)).toEqual({ templates: [] });
    expect(normalizePizzaBuilderSettings({ templates: [] })).toEqual({ templates: [] });
  });

  it("fills size step, default quantity, and half/quarter portion types", () => {
    const settings = normalizePizzaBuilderSettings({
      templates: [
        {
          name: "Classic",
          portionType: "half_half",
          applyDiscount: "highest",
          freeToppingEnabled: true,
          freeToppingCount: 2,
          linkedProductIds: ["p1", "p1", ""],
          steps: [{ kind: "toppings", title: "Cheese", items: [{ name: "Mozzarella", price: 2 }] }],
          quantityLevels: [{ name: "Extra", multiplier: 2 }],
        },
      ],
    });
    const tpl = settings.templates[0];
    expect(tpl.name).toBe("Classic");
    expect(tpl.portionType).toBe("half");
    expect(tpl.applyDiscount).toBe("highest");
    expect(tpl.freeToppingEnabled).toBe(true);
    expect(tpl.freeToppingCount).toBe(2);
    expect(tpl.linkedProductIds).toEqual(["p1"]);
    expect(tpl.steps[0].kind).toBe("size");
    expect(tpl.steps.some((s) => s.kind === "toppings" && s.title === "Cheese")).toBe(true);
    expect(tpl.quantityLevels[0].isDefault).toBe(true);
  });

  it("finds a template linked to a product", () => {
    const empty = createEmptyPizzaTemplate();
    empty.linkedProductIds = ["abc"];
    expect(findTemplateForProduct({ templates: [empty] }, "abc")?.id).toBe(empty.id);
    expect(findTemplateForProduct({ templates: [empty] }, "zzz")).toBeNull();
  });

  it("prices toppings with quantity, half portions, and lowest-priced free allowance", () => {
    const tpl = createEmptyPizzaTemplate();
    tpl.portionType = "half";
    tpl.freeToppingEnabled = true;
    tpl.freeToppingCount = 1;
    tpl.applyDiscount = "lowest";
    const light = tpl.quantityLevels.find((q) => q.multiplier === 0.5)!;
    const extra = tpl.quantityLevels.find((q) => q.multiplier === 2)!;
    const result = pricePizzaSelection(tpl, 12, [
      {
        itemId: "mush",
        name: "Mushroom",
        basePrice: 2,
        quantityLevelId: light.id,
        multiplier: light.multiplier,
        portion: "left",
      },
      {
        itemId: "pep",
        name: "Pepperoni",
        basePrice: 4,
        quantityLevelId: extra.id,
        multiplier: extra.multiplier,
        portion: "right",
      },
    ]);
    // Mushroom: 2 * 0.5 * 0.5 = 0.5 (free, lowest)
    // Pepperoni: 4 * 2 * 0.5 = 4
    expect(result.extras.map((e) => e.price)).toEqual([0, 4]);
    expect(result.extrasTotal).toBe(4);
    expect(result.unitPrice).toBe(16);
    expect(portionFactor("quarter", "q1")).toBe(0.25);
  });
});
